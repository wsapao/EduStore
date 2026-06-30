import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/email/send', () => ({
  enviarEmailIngresso: vi.fn(),
  enviarEmailResetSenhaAdmin: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { definirSenhaResponsavelAction } from '@/app/actions/admin'

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
const RESP = { id: 'resp-9', email: 'taty@hotmail.com' }

function setupServer(user: any = ADMIN_USER, respResult: any = { data: RESP }) {
  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => queueBuilder([respResult])),
  }
  ;(createClient as any).mockResolvedValue(supabase)
  return supabase
}

function setupAdmin(updateResult: any = { error: null }) {
  const updateUserById = vi.fn().mockResolvedValue(updateResult)
  ;(createAdminClient as any).mockReturnValue({ auth: { admin: { updateUserById } } })
  return updateUserById
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('definirSenhaResponsavelAction', () => {
  it('nega acesso para usuário sem role admin', async () => {
    setupServer({ id: 'u', app_metadata: {} })
    const res = await definirSenhaResponsavelAction(
      makeForm({ responsavel_id: 'resp-9', senha: 'segredo123' }),
    )
    expect(res).toEqual({ success: false, error: 'Acesso negado.' })
  })

  it('rejeita senha com menos de 6 caracteres antes de tocar o Auth', async () => {
    setupServer()
    const updateUserById = setupAdmin()
    const res = await definirSenhaResponsavelAction(
      makeForm({ responsavel_id: 'resp-9', senha: '123' }),
    )
    expect(res.success).toBe(false)
    expect(updateUserById).not.toHaveBeenCalled()
  })

  it('define a senha e confirma o e-mail', async () => {
    setupServer()
    const updateUserById = setupAdmin({ error: null })

    const res = await definirSenhaResponsavelAction(
      makeForm({ responsavel_id: 'resp-9', senha: 'segredo123' }),
    )

    expect(res).toEqual({ success: true, email: 'taty@hotmail.com' })
    expect(updateUserById).toHaveBeenCalledWith('resp-9', {
      password: 'segredo123',
      email_confirm: true,
    })
  })

  it('retorna erro quando updateUserById falha', async () => {
    setupServer()
    setupAdmin({ error: { message: 'weak password' } })

    const res = await definirSenhaResponsavelAction(
      makeForm({ responsavel_id: 'resp-9', senha: 'segredo123' }),
    )

    expect(res).toEqual({ success: false, error: 'weak password' })
  })

  it('retorna erro quando o responsável não tem e-mail', async () => {
    setupServer(ADMIN_USER, { data: { id: 'resp-9', email: null } })
    const updateUserById = setupAdmin()
    const res = await definirSenhaResponsavelAction(
      makeForm({ responsavel_id: 'resp-9', senha: 'segredo123' }),
    )
    expect(res.success).toBe(false)
    expect(updateUserById).not.toHaveBeenCalled()
  })
})
