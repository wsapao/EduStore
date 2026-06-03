import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/permissoes/getUserPermissions', () => ({ getUserPermissions: vi.fn() }))
vi.mock('@/lib/auditoria/log', () => ({ auditLog: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/email/send', () => ({ enviarEmailAvisoTrocaEmail: vi.fn().mockResolvedValue(undefined) }))

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserPermissions } from '@/lib/permissoes/getUserPermissions'
import { auditLog } from '@/lib/auditoria/log'
import { enviarEmailAvisoTrocaEmail } from '@/lib/email/send'
import { editarResponsavelAction } from '@/app/actions/responsaveis'

// Builder thenable: cada chamada terminal (single/maybeSingle) ou await consome
// o próximo resultado da fila, na ordem em que o código chama.
function queueBuilder(results: any[]) {
  let i = 0
  const next = () => results[i++] ?? { data: null, error: null }
  const builder: any = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') return (resolve: any) => resolve(next())
        if (prop === 'single' || prop === 'maybeSingle') return () => Promise.resolve(next())
        return () => builder
      },
    },
  )
  return builder
}

function makeForm(data: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(data)) fd.set(k, v)
  return fd
}

const ADMIN_USER = { id: 'admin-1', app_metadata: { role: 'admin' } }
const ALVO = {
  id: 'resp-9',
  nome: 'Maria',
  email: 'errado@exemplo.com',
  telefone: '11999999999',
  escola_id: 'esc-1',
  excluido_em: null,
}

function setupServerClient(user: any = ADMIN_USER, escolaId = 'esc-1') {
  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => queueBuilder([{ data: { escola_id: escolaId } }])),
  }
  ;(createClient as any).mockResolvedValue(supabase)
  return supabase
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(getUserPermissions as any).mockResolvedValue([])
})

describe('editarResponsavelAction', () => {
  it('nega acesso para usuário sem role admin e sem permissão', async () => {
    setupServerClient({ id: 'u', app_metadata: {} })
    ;(getUserPermissions as any).mockResolvedValue([])
    const res = await editarResponsavelAction(
      makeForm({ responsavel_id: 'resp-9', nome: 'Maria', email: 'a@b.com' }),
    )
    expect(res).toEqual({ success: false, error: 'Acesso negado.' })
  })

  it('troca o e-mail: atualiza tabela, chama Auth confirmado, audita e avisa', async () => {
    setupServerClient()
    const updateUserById = vi.fn().mockResolvedValue({ error: null })
    // Cada admin.from() retorna um builder com 1 resultado (consumido por .single/.maybeSingle/await)
    const adminFromResults = [
      { data: ALVO },     // 1ª chamada: select alvo .single()
      { data: null },     // 2ª chamada: checagem de duplicidade .maybeSingle()
      { error: null },    // 3ª chamada: update responsaveis (await .then)
    ]
    let adminFromCall = 0
    const admin = {
      from: vi.fn(() => queueBuilder([adminFromResults[adminFromCall++]])),
      auth: { admin: { updateUserById } },
    }
    ;(createAdminClient as any).mockReturnValue(admin)

    const res = await editarResponsavelAction(
      makeForm({
        responsavel_id: 'resp-9',
        nome: 'Maria Silva',
        email: 'certo@exemplo.com',
        telefone: '11988887777',
      }),
    )

    expect(res).toEqual({ success: true })
    expect(updateUserById).toHaveBeenCalledWith('resp-9', {
      email: 'certo@exemplo.com',
      email_confirm: true,
    })
    expect(auditLog).toHaveBeenCalledTimes(1)
    expect(enviarEmailAvisoTrocaEmail).toHaveBeenCalledTimes(2)
  })

  it('não chama o Auth quando o e-mail não muda', async () => {
    setupServerClient()
    const updateUserById = vi.fn()
    const adminFromResults = [
      { data: ALVO },   // 1ª chamada: select alvo .single()
      { error: null },  // 2ª chamada: update responsaveis (await .then)
    ]
    let adminFromCall = 0
    const admin = {
      from: vi.fn(() => queueBuilder([adminFromResults[adminFromCall++]])),
      auth: { admin: { updateUserById } },
    }
    ;(createAdminClient as any).mockReturnValue(admin)

    const res = await editarResponsavelAction(
      makeForm({ responsavel_id: 'resp-9', nome: 'Maria', email: 'errado@exemplo.com' }),
    )

    expect(res).toEqual({ success: true })
    expect(updateUserById).not.toHaveBeenCalled()
    expect(enviarEmailAvisoTrocaEmail).not.toHaveBeenCalled()
  })

  it('rejeita e-mail duplicado antes de tocar o Auth', async () => {
    setupServerClient()
    const updateUserById = vi.fn()
    const adminFromResults = [
      { data: ALVO },              // 1ª chamada: select alvo .single()
      { data: { id: 'outro' } },   // 2ª chamada: dup check .maybeSingle()
    ]
    let adminFromCall = 0
    const admin = {
      from: vi.fn(() => queueBuilder([adminFromResults[adminFromCall++]])),
      auth: { admin: { updateUserById } },
    }
    ;(createAdminClient as any).mockReturnValue(admin)

    const res = await editarResponsavelAction(
      makeForm({ responsavel_id: 'resp-9', nome: 'Maria', email: 'certo@exemplo.com' }),
    )

    expect(res.success).toBe(false)
    expect(updateUserById).not.toHaveBeenCalled()
  })
})
