import { describe, it, expect, vi } from 'vitest'
import { getUserPermissions } from '@/lib/permissoes/getUserPermissions'

type Vinculo = { id: string; escola_id: string; papel_id: string; created_at: string }

function makeSupabase({
  vinculos,
  selecao,
  perms,
}: {
  vinculos: Vinculo[]
  selecao?: { escola_id: string } | null
  perms: string[]
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'u1' } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'usuario_papel') {
        return {
          select: () => ({
            eq: () => ({
              eq: vi.fn().mockResolvedValue({ data: vinculos, error: null }),
            }),
          }),
        }
      }
      if (table === 'saas_unidade_ativa') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: selecao ?? null, error: null }),
            }),
          }),
        }
      }
      if (table === 'papel_permissoes') {
        return {
          select: () => ({
            eq: vi.fn().mockResolvedValue({
              data: perms.map(c => ({ chave: c })),
              error: null,
            }),
          }),
        }
      }
      throw new Error('unexpected table ' + table)
    }),
  } as any
}

describe('getUserPermissions', () => {
  it('retorna lista vazia para usuário sem nenhum vínculo', async () => {
    const sb = makeSupabase({ vinculos: [], perms: [] })
    const r = await getUserPermissions(sb)
    expect(r).toEqual([])
  })

  it('retorna lista vazia quando o único vínculo está suspenso (já filtrado na query)', async () => {
    // suspenso=false é aplicado no filtro da query; um usuário só-suspenso não retorna linhas
    const sb = makeSupabase({ vinculos: [], perms: ['produtos.ver'] })
    const r = await getUserPermissions(sb)
    expect(r).toEqual([])
  })

  it('retorna chaves do papel para usuário com vínculo único ativo', async () => {
    const sb = makeSupabase({
      vinculos: [{ id: 'v1', escola_id: 'esc-1', papel_id: 'p1', created_at: '2026-01-01T00:00:00.000Z' }],
      perms: ['produtos.ver', 'pedidos.ver'],
    })
    const r = await getUserPermissions(sb)
    expect(r.sort()).toEqual(['pedidos.ver', 'produtos.ver'])
  })

  it('retorna [] quando não há usuário autenticado', async () => {
    const sb: any = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: vi.fn(),
    }
    const r = await getUserPermissions(sb)
    expect(r).toEqual([])
  })

  it('multi-unidade: usa o papel da unidade ativa (seleção válida), não do mais antigo', async () => {
    const sb = makeSupabase({
      vinculos: [
        { id: 'v1', escola_id: 'esc-antiga', papel_id: 'p-antigo', created_at: '2026-01-01T00:00:00.000Z' },
        { id: 'v2', escola_id: 'esc-selecionada', papel_id: 'p-selecionado', created_at: '2026-02-01T00:00:00.000Z' },
      ],
      selecao: { escola_id: 'esc-selecionada' },
      perms: ['configuracoes.ver'],
    })
    const r = await getUserPermissions(sb)
    expect(r).toEqual(['configuracoes.ver'])
  })

  it('multi-unidade sem seleção: usa o papel do vínculo mais antigo', async () => {
    const sb = makeSupabase({
      vinculos: [
        { id: 'v2', escola_id: 'esc-novo', papel_id: 'p-novo', created_at: '2026-02-01T00:00:00.000Z' },
        { id: 'v1', escola_id: 'esc-antigo', papel_id: 'p-antigo', created_at: '2026-01-01T00:00:00.000Z' },
      ],
      selecao: null,
      perms: ['pedidos.ver'],
    })
    const r = await getUserPermissions(sb)
    expect(r).toEqual(['pedidos.ver'])
  })
})
