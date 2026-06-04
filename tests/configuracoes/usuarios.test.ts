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

describe('convidarUsuarioAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exige permissão configuracoes.gerenciar_usuarios', async () => {
    ;(requirePermission as any).mockRejectedValue(new Error('denied'))
    const r = await convidarUsuarioAction(fd({ email: 'a@b.com', papel_id: 'p1' }))
    expect(requirePermission).toHaveBeenCalledWith('configuracoes.gerenciar_usuarios')
    expect((r as any).error).toBeDefined()
  })

  it('rejeita email inválido', async () => {
    setupAuthOk()
    const r = await convidarUsuarioAction(fd({ email: 'invalido', papel_id: 'p1' }))
    expect((r as any).error).toMatch(/e-?mail/i)
  })

  it('rejeita papel_id vazio', async () => {
    setupAuthOk()
    const r = await convidarUsuarioAction(fd({ email: 'a@b.com', papel_id: '' }))
    expect((r as any).error).toMatch(/papel/i)
  })

  it('rejeita papel que não pertence à escola', async () => {
    setupAuthOk()
    const adminFromMock = vi.fn(() => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) }),
    }))
    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
      from: adminFromMock,
    })
    const r = await convidarUsuarioAction(fd({ email: 'a@b.com', papel_id: 'p-fora' }))
    expect((r as any).error).toMatch(/papel/i)
  })

  it('caminho feliz: invita + cria usuario_papel', async () => {
    setupAuthOk()
    const lookupPapel = vi.fn().mockResolvedValue({ data: { id: 'p1' }, error: null })
    const insertVinculo = vi.fn().mockResolvedValue({ error: null })

    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
      from: vi.fn((table: string) => {
        if (table === 'papeis') {
          return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: lookupPapel }) }) }) }
        }
        if (table === 'usuario_papel') return { insert: insertVinculo }
        throw new Error(table)
      }),
    })

    const invite = vi.fn().mockResolvedValue({ data: { user: { id: 'novo-1' } }, error: null })
    ;(createAdminClient as any).mockReturnValue({
      auth: { admin: { inviteUserByEmail: invite } },
    })

    const r = await convidarUsuarioAction(fd({ email: 'novo@escola.com', papel_id: 'p1' }))

    expect(invite).toHaveBeenCalledWith('novo@escola.com', expect.any(Object))
    expect(insertVinculo).toHaveBeenCalledWith({
      user_id: 'novo-1',
      escola_id: 'esc-1',
      papel_id: 'p1',
    })
    expect(r).toEqual({ success: true })
  })

  it('retorna erro se Supabase invite falhar', async () => {
    setupAuthOk()
    const lookupPapel = vi.fn().mockResolvedValue({ data: { id: 'p1' }, error: null })
    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
      from: vi.fn(() => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: lookupPapel }) }) }) })),
    })
    ;(createAdminClient as any).mockReturnValue({
      auth: { admin: { inviteUserByEmail: vi.fn().mockResolvedValue({ data: null, error: { message: 'já existe' } }) } },
    })
    const r = await convidarUsuarioAction(fd({ email: 'x@y.com', papel_id: 'p1' }))
    expect((r as any).error).toMatch(/convidar|email|j[áa] existe/i)
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
