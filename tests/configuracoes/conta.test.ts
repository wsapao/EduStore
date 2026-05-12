import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { atualizarPerfilContaAction } from '@/app/actions/configuracoes/conta'
import {
  iniciarMfaAction,
  verificarMfaAction,
  desativarMfaAction,
  listarFatoresMfaAction,
} from '@/app/actions/configuracoes/conta'

function fd(obj: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(obj)) f.append(k, v)
  return f
}

describe('atualizarPerfilContaAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejeita se não autenticado', async () => {
    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })
    const r = await atualizarPerfilContaAction(fd({ nome: 'João' }))
    expect(r).toEqual({ error: 'Não autenticado.' })
  })

  it('rejeita nome com menos de 3 caracteres', async () => {
    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
    })
    const r = await atualizarPerfilContaAction(fd({ nome: 'Jo' }))
    expect(r.error).toMatch(/3 caracteres/)
  })

  it('atualiza user_metadata.nome via auth.updateUser', async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null })
    ;(createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
        updateUser,
      },
    })
    const r = await atualizarPerfilContaAction(fd({ nome: 'João Silva' }))
    expect(r).toEqual({ success: true })
    expect(updateUser).toHaveBeenCalledWith({ data: { nome: 'João Silva' } })
  })

  it('retorna erro se updateUser falhar', async () => {
    ;(createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
        updateUser: vi.fn().mockResolvedValue({ error: { message: 'boom' } }),
      },
    })
    const r = await atualizarPerfilContaAction(fd({ nome: 'João' }))
    expect(r.error).toMatch(/atualizar/i)
  })
})

describe('MFA actions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('iniciarMfaAction retorna { factorId, qrCode, secret } no sucesso', async () => {
    const enroll = vi.fn().mockResolvedValue({
      data: { id: 'fac1', totp: { qr_code: '<svg/>', secret: 'ABCDEF' } },
      error: null,
    })
    ;(createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
        mfa: { enroll },
      },
    })
    const r = await iniciarMfaAction()
    expect(r).toEqual({ factorId: 'fac1', qrCode: '<svg/>', secret: 'ABCDEF' })
    expect(enroll).toHaveBeenCalledWith({ factorType: 'totp' })
  })

  it('iniciarMfaAction retorna erro se enroll falhar', async () => {
    ;(createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
        mfa: { enroll: vi.fn().mockResolvedValue({ data: null, error: { message: 'x' } }) },
      },
    })
    const r = await iniciarMfaAction()
    expect(r).toHaveProperty('error')
  })

  it('verificarMfaAction chama challenge + verify', async () => {
    const challenge = vi.fn().mockResolvedValue({ data: { id: 'chl1' }, error: null })
    const verify = vi.fn().mockResolvedValue({ data: {}, error: null })
    ;(createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
        mfa: { challenge, verify },
      },
    })
    const r = await verificarMfaAction({ factorId: 'fac1', codigo: '123456' })
    expect(r).toEqual({ success: true })
    expect(challenge).toHaveBeenCalledWith({ factorId: 'fac1' })
    expect(verify).toHaveBeenCalledWith({ factorId: 'fac1', challengeId: 'chl1', code: '123456' })
  })

  it('verificarMfaAction retorna erro se código for inválido', async () => {
    ;(createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
        mfa: {
          challenge: vi.fn().mockResolvedValue({ data: { id: 'chl1' }, error: null }),
          verify: vi.fn().mockResolvedValue({ data: null, error: { message: 'invalid' } }),
        },
      },
    })
    const r = await verificarMfaAction({ factorId: 'fac1', codigo: '000000' })
    expect(r.error).toMatch(/c[óo]digo/i)
  })

  it('desativarMfaAction chama unenroll', async () => {
    const unenroll = vi.fn().mockResolvedValue({ error: null })
    ;(createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
        mfa: { unenroll },
      },
    })
    const r = await desativarMfaAction({ factorId: 'fac1' })
    expect(r).toEqual({ success: true })
    expect(unenroll).toHaveBeenCalledWith({ factorId: 'fac1' })
  })

  it('listarFatoresMfaAction retorna lista de TOTP factors verificados', async () => {
    ;(createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
        mfa: {
          listFactors: vi.fn().mockResolvedValue({
            data: { totp: [{ id: 'fac1', friendly_name: 'Authenticator', status: 'verified' }], all: [] },
            error: null,
          }),
        },
      },
    })
    const r = await listarFatoresMfaAction()
    expect(r.factors).toHaveLength(1)
    expect(r.factors![0].id).toBe('fac1')
  })
})

import { encerrarOutrasSessoesAction } from '@/app/actions/configuracoes/conta'

describe('encerrarOutrasSessoesAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('chama signOut com scope "others"', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null })
    ;(createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
        signOut,
      },
    })
    const r = await encerrarOutrasSessoesAction()
    expect(r).toEqual({ success: true })
    expect(signOut).toHaveBeenCalledWith({ scope: 'others' })
  })

  it('retorna erro se signOut falhar', async () => {
    ;(createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
        signOut: vi.fn().mockResolvedValue({ error: { message: 'x' } }),
      },
    })
    const r = await encerrarOutrasSessoesAction()
    expect(r.error).toBeDefined()
  })
})
