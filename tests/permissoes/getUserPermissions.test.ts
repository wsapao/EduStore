import { describe, it, expect, vi } from 'vitest'
import { getUserPermissions } from '@/lib/permissoes/getUserPermissions'

function makeSupabase({
  papelId,
  suspenso,
  perms,
}: { papelId: string | null; suspenso?: boolean; perms: string[] }) {
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
              maybeSingle: vi.fn().mockResolvedValue({
                data: papelId ? { papel_id: papelId, suspenso: !!suspenso } : null,
                error: null,
              }),
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
  it('retorna lista vazia para usuário sem papel', async () => {
    const sb = makeSupabase({ papelId: null, perms: [] })
    const r = await getUserPermissions(sb)
    expect(r).toEqual([])
  })

  it('retorna lista vazia para usuário suspenso mesmo com papel', async () => {
    const sb = makeSupabase({ papelId: 'p1', suspenso: true, perms: ['produtos.ver'] })
    const r = await getUserPermissions(sb)
    expect(r).toEqual([])
  })

  it('retorna chaves do papel para usuário ativo', async () => {
    const sb = makeSupabase({ papelId: 'p1', perms: ['produtos.ver','pedidos.ver'] })
    const r = await getUserPermissions(sb)
    expect(r.sort()).toEqual(['pedidos.ver','produtos.ver'])
  })

  it('retorna [] quando não há usuário autenticado', async () => {
    const sb: any = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: vi.fn(),
    }
    const r = await getUserPermissions(sb)
    expect(r).toEqual([])
  })
})
