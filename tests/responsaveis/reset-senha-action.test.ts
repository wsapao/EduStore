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
import { enviarEmailResetSenhaAdmin } from '@/lib/email/send'
import { resetSenhaResponsavelAction } from '@/app/actions/admin'

// Builder thenable: cada chamada terminal (single) ou await consome o próximo
// resultado da fila, na ordem em que o código chama.
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
const RESP = { id: 'resp-9', nome: 'Tatiana Lira', email: 'taty@hotmail.com' }
const LINK = 'https://proj.supabase.co/auth/v1/verify?token=abc&redirect_to=/nova-senha'

function setupServer(user: any = ADMIN_USER, respResult: any = { data: RESP }) {
  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => queueBuilder([respResult])),
  }
  ;(createClient as any).mockResolvedValue(supabase)
  return supabase
}

function setupAdmin(generateResult: any) {
  const generateLink = vi.fn().mockResolvedValue(generateResult)
  ;(createAdminClient as any).mockReturnValue({ auth: { admin: { generateLink } } })
  return generateLink
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('resetSenhaResponsavelAction', () => {
  it('nega acesso para usuário sem role admin', async () => {
    setupServer({ id: 'u', app_metadata: {} })
    const res = await resetSenhaResponsavelAction(makeForm({ responsavel_id: 'resp-9' }))
    expect(res).toEqual({ success: false, error: 'Acesso negado.' })
  })

  it('retorna erro quando o responsável não tem e-mail', async () => {
    setupServer(ADMIN_USER, { data: { id: 'resp-9', nome: 'X', email: null } })
    const res = await resetSenhaResponsavelAction(makeForm({ responsavel_id: 'resp-9' }))
    expect(res.success).toBe(false)
  })

  it('sucesso: devolve o link e marca emailSent=true quando o e-mail é enviado', async () => {
    setupServer()
    const generateLink = setupAdmin({
      data: { properties: { action_link: LINK } },
      error: null,
    })
    ;(enviarEmailResetSenhaAdmin as any).mockResolvedValue(true)

    const res = await resetSenhaResponsavelAction(makeForm({ responsavel_id: 'resp-9' }))

    expect(res).toEqual({
      success: true,
      link: LINK,
      emailSent: true,
      email: 'taty@hotmail.com',
    })
    expect(generateLink).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'recovery', email: 'taty@hotmail.com' }),
    )
  })

  it('sucesso parcial: devolve o link com emailSent=false quando o Resend não envia', async () => {
    setupServer()
    setupAdmin({ data: { properties: { action_link: LINK } }, error: null })
    ;(enviarEmailResetSenhaAdmin as any).mockResolvedValue(false)

    const res = await resetSenhaResponsavelAction(makeForm({ responsavel_id: 'resp-9' }))

    expect(res).toEqual({
      success: true,
      link: LINK,
      emailSent: false,
      email: 'taty@hotmail.com',
    })
  })

  it('retorna erro quando generateLink falha', async () => {
    setupServer()
    setupAdmin({ data: null, error: { message: 'user not found' } })

    const res = await resetSenhaResponsavelAction(makeForm({ responsavel_id: 'resp-9' }))

    expect(res).toEqual({ success: false, error: 'user not found' })
    expect(enviarEmailResetSenhaAdmin).not.toHaveBeenCalled()
  })
})
