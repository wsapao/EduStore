import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/permissoes', () => ({
  requirePermission: vi.fn(),
  PermissionDeniedError: class extends Error {},
  isValidPermissionKey: (k: string) => ['produtos.ver', 'pedidos.ver', 'pdv.usar'].includes(k),
}))
vi.mock('@/lib/escola/getEscolaIdParaAdmin', () => ({ getEscolaIdParaAdmin: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/permissoes'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import {
  criarPapelAction,
  atualizarPapelAction,
  duplicarPapelAction,
  excluirPapelAction,
} from '@/app/actions/configuracoes/papeis'

function fd(obj: Record<string, string | string[]>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) v.forEach(x => f.append(k, x))
    else f.append(k, v)
  }
  return f
}

function setupAuthOk(escolaId = 'esc-1') {
  ;(requirePermission as any).mockResolvedValue(undefined)
  ;(getEscolaIdParaAdmin as any).mockResolvedValue(escolaId)
}

describe('criarPapelAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exige permissão configuracoes.gerenciar_papeis', async () => {
    ;(requirePermission as any).mockRejectedValue(new Error('denied'))
    const r = await criarPapelAction(fd({ nome: 'X' }))
    expect(requirePermission).toHaveBeenCalledWith('configuracoes.gerenciar_papeis')
    expect((r as any).error).toBeDefined()
  })

  it('rejeita nome com menos de 2 caracteres', async () => {
    setupAuthOk()
    ;(createClient as any).mockResolvedValue({ from: vi.fn() })
    const r = await criarPapelAction(fd({ nome: 'A' }))
    expect((r as any).error).toMatch(/nome/i)
  })

  it('rejeita chaves de permissão desconhecidas', async () => {
    setupAuthOk()
    ;(createClient as any).mockResolvedValue({ from: vi.fn() })
    const r = await criarPapelAction(fd({ nome: 'Custom', chaves: ['produtos.ver', 'foo.bar'] }))
    expect((r as any).error).toMatch(/permiss[ãa]o|chave/i)
  })

  it('rejeita quando já existe outro papel com o mesmo nome na escola', async () => {
    setupAuthOk()
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'p9' }, error: null })
    ;(createClient as any).mockResolvedValue({
      from: vi.fn(() => ({
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }),
      })),
    })
    const r = await criarPapelAction(fd({ nome: 'Admin' }))
    expect((r as any).error).toMatch(/j[áa] existe/i)
  })

  it('cria papel + permissões e retorna papelId', async () => {
    setupAuthOk()
    const insertPapel = vi.fn().mockReturnValue({ select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'novo-1' }, error: null }) }) })
    const insertPerms = vi.fn().mockResolvedValue({ error: null })
    const checkExisting = vi.fn().mockResolvedValue({ data: null, error: null })

    ;(createClient as any).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'papeis') {
          return {
            insert: insertPapel,
            select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: checkExisting }) }) }),
          }
        }
        if (table === 'papel_permissoes') return { insert: insertPerms }
        throw new Error('unexpected table ' + table)
      }),
    })

    const r = await criarPapelAction(fd({
      nome: 'Operador Custom',
      descricao: 'Variação interna',
      chaves: ['pdv.usar', 'pedidos.ver'],
    }))

    expect(insertPapel).toHaveBeenCalledWith(expect.objectContaining({
      escola_id: 'esc-1',
      nome: 'Operador Custom',
      descricao: 'Variação interna',
      preset: false,
      chave_preset: null,
    }))
    expect(insertPerms).toHaveBeenCalledWith([
      { papel_id: 'novo-1', chave: 'pdv.usar' },
      { papel_id: 'novo-1', chave: 'pedidos.ver' },
    ])
    expect(r).toEqual({ success: true, papelId: 'novo-1' })
  })

  it('aceita criação sem permissões marcadas (papel vazio)', async () => {
    setupAuthOk()
    const insertPapel = vi.fn().mockReturnValue({ select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'p2' }, error: null }) }) })
    const insertPerms = vi.fn().mockResolvedValue({ error: null })
    ;(createClient as any).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'papeis') {
          return {
            insert: insertPapel,
            select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) }),
          }
        }
        if (table === 'papel_permissoes') return { insert: insertPerms }
        throw new Error('unexpected table ' + table)
      }),
    })

    const r = await criarPapelAction(fd({ nome: 'Vazio' }))
    expect(r).toEqual({ success: true, papelId: 'p2' })
    expect(insertPerms).not.toHaveBeenCalled()
  })
})

describe('atualizarPapelAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exige permissão configuracoes.gerenciar_papeis', async () => {
    ;(requirePermission as any).mockRejectedValue(new Error('denied'))
    const r = await atualizarPapelAction('p1', fd({ nome: 'X' }))
    expect((r as any).error).toBeDefined()
  })

  it('rejeita papel não encontrado', async () => {
    setupAuthOk()
    ;(createClient as any).mockResolvedValue({
      from: vi.fn(() => ({
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) }),
      })),
    })
    const r = await atualizarPapelAction('p404', fd({ nome: 'Algum nome' }))
    expect((r as any).error).toMatch(/n[ãa]o encontrado/i)
  })

  it('rejeita nome duplicado em outro papel da mesma escola', async () => {
    setupAuthOk()
    const lookupPapel = vi.fn().mockResolvedValue({ data: { id: 'p1', preset: false, chave_preset: null }, error: null })
    const lookupDup = vi.fn().mockResolvedValue({ data: { id: 'p9' }, error: null })

    let papeisCount = 0
    ;(createClient as any).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'papeis') {
          papeisCount++
          if (papeisCount === 1) {
            return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: lookupPapel }) }) }) }
          }
          return {
            select: () => ({
              eq: () => ({ eq: () => ({ neq: () => ({ maybeSingle: lookupDup }) }) }),
            }),
          }
        }
        throw new Error('unexpected table ' + table)
      }),
    })

    const r = await atualizarPapelAction('p1', fd({ nome: 'Existente' }))
    expect((r as any).error).toMatch(/j[áa] existe/i)
  })

  it('atualiza nome/descricao + substitui permissões', async () => {
    setupAuthOk()
    const lookupPapel = vi.fn().mockResolvedValue({ data: { id: 'p1', preset: false, chave_preset: null }, error: null })
    const lookupDup = vi.fn().mockResolvedValue({ data: null, error: null })
    const updateEq = vi.fn(() => ({ select: vi.fn().mockResolvedValue({ data: [{ id: 'p1' }], error: null }) }))
    const updatePapel = vi.fn(() => ({ eq: updateEq }))
    const deleteEq = vi.fn().mockResolvedValue({ error: null })
    const insertPerms = vi.fn().mockResolvedValue({ error: null })

    let papeisCount = 0
    ;(createClient as any).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'papeis') {
          papeisCount++
          if (papeisCount === 1) {
            return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: lookupPapel }) }) }) }
          }
          if (papeisCount === 2) {
            return { select: () => ({ eq: () => ({ eq: () => ({ neq: () => ({ maybeSingle: lookupDup }) }) }) }) }
          }
          return { update: updatePapel }
        }
        if (table === 'papel_permissoes') {
          return {
            delete: () => ({ eq: deleteEq }),
            insert: insertPerms,
          }
        }
        throw new Error('unexpected table ' + table)
      }),
    })

    const r = await atualizarPapelAction('p1', fd({
      nome: 'Atualizado',
      descricao: 'Nova descrição',
      chaves: ['produtos.ver', 'pedidos.ver'],
    }))

    expect(r).toEqual({ success: true })
    expect(updateEq).toHaveBeenCalledWith('id', 'p1')
    expect(deleteEq).toHaveBeenCalledWith('papel_id', 'p1')
    expect(insertPerms).toHaveBeenCalledWith([
      { papel_id: 'p1', chave: 'produtos.ver' },
      { papel_id: 'p1', chave: 'pedidos.ver' },
    ])
  })

  it('em preset, ignora preset/chave_preset no update mas permite alterar nome/perms', async () => {
    setupAuthOk()
    const lookupPapel = vi.fn().mockResolvedValue({ data: { id: 'p1', preset: true, chave_preset: 'admin' }, error: null })
    const lookupDup = vi.fn().mockResolvedValue({ data: null, error: null })
    const updateEq = vi.fn(() => ({ select: vi.fn().mockResolvedValue({ data: [{ id: 'p1' }], error: null }) }))
    const updateFn = vi.fn(() => ({ eq: updateEq }))
    let papeisCount = 0
    ;(createClient as any).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'papeis') {
          papeisCount++
          if (papeisCount === 1) return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: lookupPapel }) }) }) }
          if (papeisCount === 2) return { select: () => ({ eq: () => ({ eq: () => ({ neq: () => ({ maybeSingle: lookupDup }) }) }) }) }
          return { update: updateFn }
        }
        if (table === 'papel_permissoes') {
          return {
            delete: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            insert: vi.fn().mockResolvedValue({ error: null }),
          }
        }
        throw new Error(table)
      }),
    })

    await atualizarPapelAction('p1', fd({ nome: 'Admin renomeado', chaves: ['produtos.ver'] }))
    const payload = (updateFn.mock.calls[0] as unknown[])[0] as any
    expect(payload).not.toHaveProperty('preset')
    expect(payload).not.toHaveProperty('chave_preset')
    expect(payload).toMatchObject({ nome: 'Admin renomeado' })
  })
})

describe('duplicarPapelAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('cria cópia com nome "<original> (cópia)" e copia permissões', async () => {
    setupAuthOk()
    const lookupOriginal = vi.fn().mockResolvedValue({
      data: { id: 'p1', escola_id: 'esc-1', nome: 'Gerente', descricao: 'desc' },
      error: null,
    })
    const listarPerms = vi.fn().mockResolvedValue({
      data: [{ chave: 'produtos.ver' }, { chave: 'pedidos.ver' }],
      error: null,
    })
    const insertPapel = vi.fn().mockReturnValue({ select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'p1-copy' }, error: null }) }) })
    const insertPerms = vi.fn().mockResolvedValue({ error: null })

    ;(createClient as any).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'papeis') {
          return {
            select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: lookupOriginal }) }) }),
            insert: insertPapel,
          }
        }
        if (table === 'papel_permissoes') {
          return {
            select: () => ({ eq: listarPerms }),
            insert: insertPerms,
          }
        }
        throw new Error(table)
      }),
    })

    const r = await duplicarPapelAction('p1')

    expect(insertPapel).toHaveBeenCalledWith(expect.objectContaining({
      escola_id: 'esc-1',
      nome: 'Gerente (cópia)',
      preset: false,
      chave_preset: null,
    }))
    expect(insertPerms).toHaveBeenCalledWith([
      { papel_id: 'p1-copy', chave: 'produtos.ver' },
      { papel_id: 'p1-copy', chave: 'pedidos.ver' },
    ])
    expect(r).toEqual({ success: true, papelId: 'p1-copy' })
  })
})

describe('excluirPapelAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejeita exclusão de preset', async () => {
    setupAuthOk()
    const lookup = vi.fn().mockResolvedValue({
      data: { id: 'p1', preset: true },
      error: null,
    })
    ;(createClient as any).mockResolvedValue({
      from: vi.fn(() => ({
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: lookup }) }) }),
      })),
    })
    const r = await excluirPapelAction('p1')
    expect((r as any).error).toMatch(/preset/i)
  })

  it('rejeita exclusão de papel em uso', async () => {
    setupAuthOk()
    const lookupPapel = vi.fn().mockResolvedValue({ data: { id: 'p1', preset: false }, error: null })
    const countUsos = vi.fn().mockResolvedValue({ count: 3, error: null })

    ;(createClient as any).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'papeis') {
          return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: lookupPapel }) }) }) }
        }
        if (table === 'usuario_papel') {
          return { select: () => ({ eq: countUsos }) }
        }
        throw new Error(table)
      }),
    })

    const r = await excluirPapelAction('p1')
    expect((r as any).error).toMatch(/em uso|usu[áa]rio/i)
  })

  it('exclui papel customizado sem usuários', async () => {
    setupAuthOk()
    const lookupPapel = vi.fn().mockResolvedValue({ data: { id: 'p1', preset: false }, error: null })
    const countUsos = vi.fn().mockResolvedValue({ count: 0, error: null })
    const delEq = vi.fn(() => ({ select: vi.fn().mockResolvedValue({ data: [{ id: 'p1' }], error: null }) }))

    ;(createClient as any).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'papeis') {
          return {
            select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: lookupPapel }) }) }),
            delete: () => ({ eq: delEq }),
          }
        }
        if (table === 'usuario_papel') {
          return { select: () => ({ eq: countUsos }) }
        }
        throw new Error(table)
      }),
    })

    const r = await excluirPapelAction('p1')
    expect(r).toEqual({ success: true })
    expect(delEq).toHaveBeenCalledWith('id', 'p1')
  })
})
