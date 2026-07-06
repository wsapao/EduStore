import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Map([['x-forwarded-for', '1.2.3.4']])),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/ratelimit', () => ({ ratelimit: { check: vi.fn() } }))

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ratelimit } from '@/lib/ratelimit'
import { loginAction, recuperarSenhaAction } from '@/app/actions/auth'

function fd(obj: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(obj)) f.append(k, v)
  return f
}

function setup({
  signInError = null,
  appRole = undefined as string | undefined,
  rpcEmail = null as string | null,
} = {}) {
  ;(ratelimit.check as any).mockResolvedValue({ allowed: true, retryAfter: 0 })

  const signInWithPassword = vi.fn().mockResolvedValue(
    signInError
      ? { data: { user: null }, error: { message: signInError } }
      : { data: { user: { id: 'u-1', app_metadata: appRole ? { role: appRole } : {} } }, error: null }
  )
  const resetPasswordForEmail = vi.fn().mockResolvedValue({ data: {}, error: null })
  ;(createClient as any).mockResolvedValue({
    auth: { signInWithPassword, resetPasswordForEmail },
  })

  const rpc = vi.fn().mockResolvedValue({ data: rpcEmail, error: null })
  ;(createAdminClient as any).mockReturnValue({ rpc })

  return { signInWithPassword, resetPasswordForEmail, rpc }
}

describe('loginAction — CPF ou e-mail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('login por CPF resolve o e-mail via RPC get_email_by_cpf', async () => {
    const { signInWithPassword, rpc } = setup({ rpcEmail: 'pai@escola.com' })
    await loginAction(fd({ cpf: '529.982.247-25', senha: 'segredo123' }))
    expect(rpc).toHaveBeenCalledWith('get_email_by_cpf', { p_cpf: '52998224725' })
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'pai@escola.com', password: 'segredo123' })
    expect(redirect).toHaveBeenCalledWith('/loja')
  })

  it('login por e-mail NÃO consulta a RPC e autentica direto', async () => {
    const { signInWithPassword, rpc } = setup()
    await loginAction(fd({ cpf: 'F.Correia1990@Gmail.com ', senha: 'segredo123' }))
    expect(rpc).not.toHaveBeenCalled()
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'f.correia1990@gmail.com',
      password: 'segredo123',
    })
  })

  it('admin logando por e-mail é redirecionado para /admin', async () => {
    setup({ appRole: 'admin' })
    await loginAction(fd({ cpf: 'admin@escola.com', senha: 'segredo123' }))
    expect(redirect).toHaveBeenCalledWith('/admin')
  })

  it('e-mail com formato inválido retorna erro genérico sem tentar autenticar', async () => {
    const { signInWithPassword } = setup()
    const r = await loginAction(fd({ cpf: 'foo@', senha: 'x' }))
    expect((r as any).error).toBeDefined()
    expect(signInWithPassword).not.toHaveBeenCalled()
  })

  it('CPF sem conta retorna erro genérico', async () => {
    const { signInWithPassword } = setup({ rpcEmail: null })
    const r = await loginAction(fd({ cpf: '529.982.247-25', senha: 'x' }))
    expect((r as any).error).toMatch(/incorret/i)
    expect(signInWithPassword).not.toHaveBeenCalled()
  })

  it('senha errada com e-mail retorna erro genérico', async () => {
    setup({ signInError: 'Invalid login credentials' })
    const r = await loginAction(fd({ cpf: 'pai@escola.com', senha: 'errada' }))
    expect((r as any).error).toMatch(/incorret/i)
  })

  it('rate limit usa o e-mail como chave quando login é por e-mail', async () => {
    setup()
    await loginAction(fd({ cpf: 'pai@escola.com', senha: 'x' }))
    const chaves = (ratelimit.check as any).mock.calls.map((c: any[]) => c[0])
    expect(chaves).toContain('login:email:pai@escola.com')
  })
})

describe('recuperarSenhaAction — CPF ou e-mail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('com e-mail envia reset direto, sem RPC', async () => {
    const { resetPasswordForEmail, rpc } = setup()
    const r = await recuperarSenhaAction(fd({ cpf: 'Pai@Escola.com' }))
    expect(rpc).not.toHaveBeenCalled()
    expect(resetPasswordForEmail).toHaveBeenCalledWith('pai@escola.com', expect.any(Object))
    expect(r).toEqual({ success: true })
  })

  it('com CPF resolve e-mail via RPC antes de enviar', async () => {
    const { resetPasswordForEmail, rpc } = setup({ rpcEmail: 'pai@escola.com' })
    await recuperarSenhaAction(fd({ cpf: '529.982.247-25' }))
    expect(rpc).toHaveBeenCalledWith('get_email_by_cpf', { p_cpf: '52998224725' })
    expect(resetPasswordForEmail).toHaveBeenCalledWith('pai@escola.com', expect.any(Object))
  })

  it('CPF inexistente ainda retorna sucesso genérico (anti-enumeração)', async () => {
    const { resetPasswordForEmail } = setup({ rpcEmail: null })
    const r = await recuperarSenhaAction(fd({ cpf: '529.982.247-25' }))
    expect(resetPasswordForEmail).not.toHaveBeenCalled()
    expect(r).toEqual({ success: true })
  })
})
