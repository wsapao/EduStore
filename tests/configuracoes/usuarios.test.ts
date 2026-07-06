import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auditoria/log', () => ({ auditLog: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/permissoes', () => ({
  requirePermission: vi.fn(),
  PermissionDeniedError: class extends Error {},
}))
vi.mock('@/lib/escola/getEscolaIdParaAdmin', () => ({ getEscolaIdParaAdmin: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/permissoes'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import {
  convidarUsuarioAction,
  alterarPapelUsuarioAction,
  toggleSuspensaoUsuarioAction,
  removerUsuarioAction,
} from '@/app/actions/configuracoes/usuarios'

function fd(obj: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(obj)) f.append(k, v)
  return f
}

function setupAuthOk(currentUserId = 'admin-1') {
  ;(requirePermission as any).mockResolvedValue(undefined)
  ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
  ;(createClient as any).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: currentUserId } } }),
    },
    from: vi.fn(),
  })
}

const CPF_OK = '529.982.247-25'
const CPF_OK_LIMPO = '52998224725'

function fdConvite(over: Partial<Record<string, string>> = {}) {
  return fd({
    nome: 'Filipe Correia',
    email: 'novo@escola.com',
    cpf: CPF_OK,
    papel_id: 'p1',
    ...over,
  })
}

function mockUserClient({ papel = { id: 'p1' } as any } = {}) {
  const insertVinculo = vi.fn().mockResolvedValue({ error: null })
  ;(createClient as any).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
    from: vi.fn((table: string) => {
      if (table === 'papeis') {
        return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: papel, error: null }) }) }) }) }
      }
      if (table === 'usuario_papel') return { insert: insertVinculo }
      throw new Error(table)
    }),
  })
  return { insertVinculo }
}

function mockAdmin({
  contaPorCpf = null as any,
  contaPorEmail = null as any,
  vinculo = null as any,
  inviteResult = { data: { user: { id: 'novo-1' } }, error: null } as any,
} = {}) {
  const invite = vi.fn().mockResolvedValue(inviteResult)
  const updateEq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn(() => ({ eq: updateEq }))
  ;(createAdminClient as any).mockReturnValue({
    auth: { admin: { inviteUserByEmail: invite } },
    from: vi.fn((table: string) => {
      if (table === 'responsaveis') {
        return {
          select: () => ({
            eq: (col: string) => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: col === 'cpf' ? contaPorCpf : contaPorEmail,
                error: null,
              }),
            }),
          }),
          update,
        }
      }
      if (table === 'usuario_papel') {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: vinculo, error: null }) }) }),
          }),
        }
      }
      throw new Error(table)
    }),
  })
  return { invite, update, updateEq }
}

describe('convidarUsuarioAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exige permissão configuracoes.gerenciar_usuarios', async () => {
    ;(requirePermission as any).mockRejectedValue(new Error('denied'))
    const r = await convidarUsuarioAction(fdConvite())
    expect(requirePermission).toHaveBeenCalledWith('configuracoes.gerenciar_usuarios')
    expect((r as any).error).toBeDefined()
  })

  it('rejeita nome vazio', async () => {
    setupAuthOk()
    const r = await convidarUsuarioAction(fdConvite({ nome: '  ' }))
    expect((r as any).error).toMatch(/nome/i)
  })

  it('rejeita email inválido', async () => {
    setupAuthOk()
    const r = await convidarUsuarioAction(fdConvite({ email: 'invalido' }))
    expect((r as any).error).toMatch(/e-?mail/i)
  })

  it('rejeita CPF inválido', async () => {
    setupAuthOk()
    const r = await convidarUsuarioAction(fdConvite({ cpf: '111.111.111-11' }))
    expect((r as any).error).toMatch(/cpf/i)
  })

  it('rejeita CPF ausente', async () => {
    setupAuthOk()
    const r = await convidarUsuarioAction(fdConvite({ cpf: '' }))
    expect((r as any).error).toMatch(/cpf/i)
  })

  it('rejeita papel_id vazio', async () => {
    setupAuthOk()
    const r = await convidarUsuarioAction(fdConvite({ papel_id: '' }))
    expect((r as any).error).toMatch(/papel/i)
  })

  it('rejeita papel que não pertence à escola', async () => {
    setupAuthOk()
    mockUserClient({ papel: null })
    const r = await convidarUsuarioAction(fdConvite({ papel_id: 'p-fora' }))
    expect((r as any).error).toMatch(/papel/i)
  })

  it('caminho feliz: convida com nome+cpf nos metadados e cria usuario_papel', async () => {
    setupAuthOk()
    const { insertVinculo } = mockUserClient()
    const { invite } = mockAdmin()

    const r = await convidarUsuarioAction(fdConvite())

    expect(invite).toHaveBeenCalledWith('novo@escola.com', expect.objectContaining({
      data: { nome: 'Filipe Correia', cpf: CPF_OK_LIMPO },
    }))
    expect(insertVinculo).toHaveBeenCalledWith({
      user_id: 'novo-1',
      escola_id: 'esc-1',
      papel_id: 'p1',
    })
    expect(r).toEqual({ success: true })
  })

  it('CPF já cadastrado: vincula papel à conta existente sem convidar', async () => {
    setupAuthOk()
    const { insertVinculo } = mockUserClient()
    const { invite } = mockAdmin({ contaPorCpf: { id: 'u-existente', email: 'pai@escola.com' } })

    const r = await convidarUsuarioAction(fdConvite())

    expect(invite).not.toHaveBeenCalled()
    expect(insertVinculo).toHaveBeenCalledWith({
      user_id: 'u-existente',
      escola_id: 'esc-1',
      papel_id: 'p1',
    })
    expect((r as any).success).toBe(true)
    expect((r as any).info).toMatch(/conta existente|já usa/i)
  })

  it('e-mail já registrado no Auth: completa CPF vazio da conta e vincula papel', async () => {
    setupAuthOk()
    const { insertVinculo } = mockUserClient()
    const { update, updateEq } = mockAdmin({
      inviteResult: { data: null, error: { message: 'A user with this email address has already been registered' } },
      contaPorEmail: { id: 'u-filipe', cpf: '', email: 'novo@escola.com' },
    })

    const r = await convidarUsuarioAction(fdConvite())

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ cpf: CPF_OK_LIMPO }))
    expect(updateEq).toHaveBeenCalledWith('id', 'u-filipe')
    expect(insertVinculo).toHaveBeenCalledWith({
      user_id: 'u-filipe',
      escola_id: 'esc-1',
      papel_id: 'p1',
    })
    expect((r as any).success).toBe(true)
  })

  it('e-mail registrado com OUTRO CPF: recusa para não sobrescrever', async () => {
    setupAuthOk()
    mockUserClient()
    mockAdmin({
      inviteResult: { data: null, error: { message: 'already been registered' } },
      contaPorEmail: { id: 'u-x', cpf: '11144477735', email: 'novo@escola.com' },
    })

    const r = await convidarUsuarioAction(fdConvite())
    expect((r as any).error).toMatch(/outro cpf/i)
  })

  it('conta existente que já faz parte da equipe: não duplica vínculo', async () => {
    setupAuthOk()
    const { insertVinculo } = mockUserClient()
    mockAdmin({
      contaPorCpf: { id: 'u-existente', email: 'pai@escola.com' },
      vinculo: { user_id: 'u-existente' },
    })

    const r = await convidarUsuarioAction(fdConvite())
    expect(insertVinculo).not.toHaveBeenCalled()
    expect((r as any).success).toBe(true)
  })

  it('retorna erro se Supabase invite falhar por outro motivo', async () => {
    setupAuthOk()
    mockUserClient()
    mockAdmin({ inviteResult: { data: null, error: { message: 'smtp indisponível' } } })
    const r = await convidarUsuarioAction(fdConvite())
    expect((r as any).error).toMatch(/smtp indisponível/i)
  })
})

describe('alterarPapelUsuarioAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exige permissão', async () => {
    ;(requirePermission as any).mockRejectedValue(new Error('denied'))
    const r = await alterarPapelUsuarioAction('u-2', 'p-2')
    expect((r as any).error).toBeDefined()
  })

  it('rejeita auto-edição (admin tentando mudar próprio papel)', async () => {
    setupAuthOk('admin-1')
    const r = await alterarPapelUsuarioAction('admin-1', 'p-outro')
    expect((r as any).error).toMatch(/pr[óo]prio/i)
  })

  it('rejeita rebaixar último admin', async () => {
    setupAuthOk('admin-1')
    const lookupAlvo = vi.fn().mockResolvedValue({
      data: { user_id: 'u-2', papel: { chave_preset: 'admin' } },
      error: null,
    })
    const lookupNovo = vi.fn().mockResolvedValue({
      data: { id: 'p-novo', chave_preset: 'gerente', escola_id: 'esc-1' },
      error: null,
    })
    const lookupPapelAdmin = vi.fn().mockResolvedValue({
      data: { id: 'p-admin' },
      error: null,
    })
    const countAdmins = vi.fn().mockResolvedValue({ count: 1, error: null })

    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
      from: vi.fn((table: string) => {
        if (table === 'usuario_papel') {
          // chama 1: lookup alvo (com select que faz join), chama 2: count admins ativos
          return {
            select: (sel?: string) => {
              if (sel?.includes('papel')) {
                return { eq: () => ({ eq: () => ({ maybeSingle: lookupAlvo }) }) }
              }
              return { eq: () => ({ eq: () => ({ eq: () => countAdmins }) }) }
            },
          }
        }
        if (table === 'papeis') {
          return {
            select: () => ({
              eq: (col: string, val: string) => ({
                eq: (col2: string, val2: string) => {
                  if (val2 === 'admin') return { maybeSingle: lookupPapelAdmin }
                  return { maybeSingle: lookupNovo }
                },
              }),
            }),
          }
        }
        throw new Error(table)
      }),
    })

    const r = await alterarPapelUsuarioAction('u-2', 'p-novo')
    expect((r as any).error).toMatch(/[úu]ltimo admin/i)
  })

  it('atualiza papel quando autorizado', async () => {
    setupAuthOk('admin-1')
    const lookupAlvo = vi.fn().mockResolvedValue({
      data: { user_id: 'u-2', papel: { chave_preset: 'gerente' } },
      error: null,
    })
    const lookupNovo = vi.fn().mockResolvedValue({
      data: { id: 'p-novo', chave_preset: 'financeiro', escola_id: 'esc-1' },
      error: null,
    })
    const eqUpdate = vi.fn(() => ({ select: vi.fn().mockResolvedValue({ data: [{ user_id: 'ok' }], error: null }) }))
    const updateChain = vi.fn(() => ({ eq: () => ({ eq: eqUpdate }) }))

    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
      from: vi.fn((table: string) => {
        if (table === 'usuario_papel') {
          return {
            select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: lookupAlvo }) }) }),
            update: updateChain,
          }
        }
        if (table === 'papeis') {
          return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: lookupNovo }) }) }) }
        }
        throw new Error(table)
      }),
    })

    const r = await alterarPapelUsuarioAction('u-2', 'p-novo')
    expect(r).toEqual({ success: true })
    expect(updateChain).toHaveBeenCalledWith({ papel_id: 'p-novo' })
  })
})

describe('toggleSuspensaoUsuarioAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejeita auto-suspensão', async () => {
    setupAuthOk('admin-1')
    const r = await toggleSuspensaoUsuarioAction('admin-1', true)
    expect((r as any).error).toMatch(/pr[óo]prio/i)
  })

  it('rejeita suspender último admin', async () => {
    setupAuthOk('admin-1')
    const lookupAlvo = vi.fn().mockResolvedValue({
      data: { user_id: 'u-2', papel: { chave_preset: 'admin' }, suspenso: false },
      error: null,
    })
    const lookupPapelAdmin = vi.fn().mockResolvedValue({
      data: { id: 'p-admin' },
      error: null,
    })
    const countAdmins = vi.fn().mockResolvedValue({ count: 1, error: null })
    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
      from: vi.fn((table: string) => {
        if (table === 'usuario_papel') {
          return {
            select: (sel?: string) => {
              if (sel?.includes('papel')) {
                return { eq: () => ({ eq: () => ({ maybeSingle: lookupAlvo }) }) }
              }
              return { eq: () => ({ eq: () => ({ eq: () => countAdmins }) }) }
            },
          }
        }
        if (table === 'papeis') {
          return {
            select: () => ({
              eq: () => ({ eq: () => ({ maybeSingle: lookupPapelAdmin }) }),
            }),
          }
        }
        throw new Error(table)
      }),
    })
    const r = await toggleSuspensaoUsuarioAction('u-2', true)
    expect((r as any).error).toMatch(/[úu]ltimo admin/i)
  })

  it('suspende com sucesso', async () => {
    setupAuthOk('admin-1')
    const lookupAlvo = vi.fn().mockResolvedValue({
      data: { user_id: 'u-2', papel: { chave_preset: 'gerente' }, suspenso: false },
      error: null,
    })
    const eqUpdate = vi.fn(() => ({ select: vi.fn().mockResolvedValue({ data: [{ user_id: 'ok' }], error: null }) }))
    const updateChain = vi.fn(() => ({ eq: () => ({ eq: eqUpdate }) }))
    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
      from: vi.fn((table: string) => {
        if (table === 'usuario_papel') {
          return {
            select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: lookupAlvo }) }) }),
            update: updateChain,
          }
        }
        throw new Error(table)
      }),
    })
    const r = await toggleSuspensaoUsuarioAction('u-2', true)
    expect(r).toEqual({ success: true })
    expect(updateChain).toHaveBeenCalledWith(expect.objectContaining({
      suspenso: true,
      suspenso_em: expect.any(String),
      suspenso_por: 'admin-1',
    }))
  })

  it('reativa limpa suspenso/em/por', async () => {
    setupAuthOk('admin-1')
    const lookupAlvo = vi.fn().mockResolvedValue({
      data: { user_id: 'u-2', papel: { chave_preset: 'gerente' }, suspenso: true },
      error: null,
    })
    const eqUpdate = vi.fn(() => ({ select: vi.fn().mockResolvedValue({ data: [{ user_id: 'ok' }], error: null }) }))
    const updateChain = vi.fn(() => ({ eq: () => ({ eq: eqUpdate }) }))
    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
      from: vi.fn((table: string) => {
        if (table === 'usuario_papel') {
          return {
            select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: lookupAlvo }) }) }),
            update: updateChain,
          }
        }
        throw new Error(table)
      }),
    })
    const r = await toggleSuspensaoUsuarioAction('u-2', false)
    expect(r).toEqual({ success: true })
    expect(updateChain).toHaveBeenCalledWith({
      suspenso: false,
      suspenso_em: null,
      suspenso_por: null,
    })
  })
})

describe('removerUsuarioAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejeita auto-remoção', async () => {
    setupAuthOk('admin-1')
    const r = await removerUsuarioAction('admin-1')
    expect((r as any).error).toMatch(/pr[óo]prio/i)
  })

  it('rejeita remover último admin', async () => {
    setupAuthOk('admin-1')
    const lookupAlvo = vi.fn().mockResolvedValue({
      data: { user_id: 'u-2', papel: { chave_preset: 'admin' } },
      error: null,
    })
    const lookupPapelAdmin = vi.fn().mockResolvedValue({
      data: { id: 'p-admin' },
      error: null,
    })
    const countAdmins = vi.fn().mockResolvedValue({ count: 1, error: null })
    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
      from: vi.fn((table: string) => {
        if (table === 'usuario_papel') {
          return {
            select: (sel?: string) => {
              if (sel?.includes('papel')) {
                return { eq: () => ({ eq: () => ({ maybeSingle: lookupAlvo }) }) }
              }
              return { eq: () => ({ eq: () => ({ eq: () => countAdmins }) }) }
            },
          }
        }
        if (table === 'papeis') {
          return {
            select: () => ({
              eq: () => ({ eq: () => ({ maybeSingle: lookupPapelAdmin }) }),
            }),
          }
        }
        throw new Error(table)
      }),
    })
    const r = await removerUsuarioAction('u-2')
    expect((r as any).error).toMatch(/[úu]ltimo admin/i)
  })

  it('remove o vínculo com sucesso', async () => {
    setupAuthOk('admin-1')
    const lookupAlvo = vi.fn().mockResolvedValue({
      data: { user_id: 'u-2', papel: { chave_preset: 'gerente' } },
      error: null,
    })
    const eqDelete = vi.fn(() => ({ select: vi.fn().mockResolvedValue({ data: [{ user_id: 'ok' }], error: null }) }))
    const deleteChain = vi.fn(() => ({ eq: () => ({ eq: eqDelete }) }))
    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
      from: vi.fn(() => ({
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: lookupAlvo }) }) }),
        delete: deleteChain,
      })),
    })
    const r = await removerUsuarioAction('u-2')
    expect(r).toEqual({ success: true })
    expect(deleteChain).toHaveBeenCalled()
  })
})
