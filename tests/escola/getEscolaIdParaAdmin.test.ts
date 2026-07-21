import { describe, it, expect, vi } from 'vitest'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'

type Vinculo = { id: string; escola_id: string; papel_id: string; created_at: string }

function makeSupabase({
  vinculos,
  selecao,
  responsavel,
}: {
  vinculos?: Vinculo[]
  selecao?: { escola_id: string } | null
  responsavel?: { escola_id: string } | null
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
    },
    from: vi.fn((table: string) => {
      if (table === 'usuario_papel') {
        return {
          select: () => ({
            eq: () => ({
              eq: vi.fn().mockResolvedValue({ data: vinculos ?? [], error: null }),
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
  it('retorna escola_id do vínculo único em usuario_papel quando existe', async () => {
    const sb = makeSupabase({
      vinculos: [{ id: 'v1', escola_id: 'esc-1', papel_id: 'p1', created_at: '2026-01-01T00:00:00.000Z' }],
    })
    expect(await getEscolaIdParaAdmin(sb)).toBe('esc-1')
  })

  it('cai pra responsaveis quando nao tem vinculo em usuario_papel', async () => {
    const sb = makeSupabase({ vinculos: [], responsavel: { escola_id: 'esc-2' } })
    expect(await getEscolaIdParaAdmin(sb)).toBe('esc-2')
  })

  it('retorna null quando nao encontra escola em nenhuma fonte', async () => {
    const sb = makeSupabase({ vinculos: [], responsavel: null })
    expect(await getEscolaIdParaAdmin(sb)).toBeNull()
  })

  it('retorna null quando nao ha usuario autenticado', async () => {
    const sb: any = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    }
    expect(await getEscolaIdParaAdmin(sb)).toBeNull()
  })

  it('multi-unidade sem seleção: resolve pro vínculo mais antigo', async () => {
    const sb = makeSupabase({
      vinculos: [
        { id: 'v2', escola_id: 'esc-novo', papel_id: 'p1', created_at: '2026-02-01T00:00:00.000Z' },
        { id: 'v1', escola_id: 'esc-antigo', papel_id: 'p1', created_at: '2026-01-01T00:00:00.000Z' },
      ],
      selecao: null,
    })
    expect(await getEscolaIdParaAdmin(sb)).toBe('esc-antigo')
  })

  it('multi-unidade com seleção válida: resolve pra escola selecionada', async () => {
    const sb = makeSupabase({
      vinculos: [
        { id: 'v1', escola_id: 'esc-antigo', papel_id: 'p1', created_at: '2026-01-01T00:00:00.000Z' },
        { id: 'v2', escola_id: 'esc-selecionada', papel_id: 'p1', created_at: '2026-02-01T00:00:00.000Z' },
      ],
      selecao: { escola_id: 'esc-selecionada' },
    })
    expect(await getEscolaIdParaAdmin(sb)).toBe('esc-selecionada')
  })

  it('multi-unidade com seleção sem vínculo não-suspenso: cai pro mais antigo', async () => {
    const sb = makeSupabase({
      vinculos: [
        { id: 'v1', escola_id: 'esc-antigo', papel_id: 'p1', created_at: '2026-01-01T00:00:00.000Z' },
      ],
      selecao: { escola_id: 'esc-nao-vinculada' },
    })
    expect(await getEscolaIdParaAdmin(sb)).toBe('esc-antigo')
  })
})
