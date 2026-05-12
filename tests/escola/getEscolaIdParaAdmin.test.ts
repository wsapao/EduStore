import { describe, it, expect, vi } from 'vitest'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'

function makeSupabase({ vinculo, responsavel }: { vinculo?: { escola_id: string } | null; responsavel?: { escola_id: string } | null }) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
    },
    from: vi.fn((table: string) => {
      if (table === 'usuario_papel') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: vinculo ?? null, error: null }),
            }),
          }),
        }
      }
      if (table === 'responsaveis') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: responsavel ?? null, error: null }),
            }),
          }),
        }
      }
      throw new Error('unexpected table ' + table)
    }),
  } as any
}

describe('getEscolaIdParaAdmin', () => {
  it('retorna escola_id de usuario_papel quando existe', async () => {
    const sb = makeSupabase({ vinculo: { escola_id: 'esc-1' } })
    expect(await getEscolaIdParaAdmin(sb)).toBe('esc-1')
  })

  it('cai pra responsaveis quando nao tem vinculo em usuario_papel', async () => {
    const sb = makeSupabase({ vinculo: null, responsavel: { escola_id: 'esc-2' } })
    expect(await getEscolaIdParaAdmin(sb)).toBe('esc-2')
  })

  it('retorna null quando nao encontra escola em nenhuma fonte', async () => {
    const sb = makeSupabase({ vinculo: null, responsavel: null })
    expect(await getEscolaIdParaAdmin(sb)).toBeNull()
  })

  it('retorna null quando nao ha usuario autenticado', async () => {
    const sb: any = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    }
    expect(await getEscolaIdParaAdmin(sb)).toBeNull()
  })
})
