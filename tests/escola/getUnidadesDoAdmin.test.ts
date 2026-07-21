import { describe, it, expect, vi } from 'vitest'
import { getUnidadesDoAdmin } from '@/lib/escola/getUnidadesDoAdmin'

type Vinculo = { id: string; escola_id: string; papel_id: string; created_at: string; escola: { nome: string } | null }

function makeSupabase({
  user = { id: 'u1' },
  vinculos,
  selecao,
}: {
  user?: { id: string } | null
  vinculos?: Vinculo[]
  selecao?: { escola_id: string } | null
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
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
      throw new Error('unexpected table ' + table)
    }),
  } as any
}

describe('getUnidadesDoAdmin', () => {
  it('retorna lista vazia e escolaAtivaId null quando não há usuário autenticado', async () => {
    const sb = makeSupabase({ user: null })
    expect(await getUnidadesDoAdmin(sb)).toEqual({ escolas: [], escolaAtivaId: null })
    expect(sb.from).not.toHaveBeenCalled()
  })

  it('retorna lista vazia e escolaAtivaId null quando não há vínculo em usuario_papel', async () => {
    const sb = makeSupabase({ vinculos: [] })
    expect(await getUnidadesDoAdmin(sb)).toEqual({ escolas: [], escolaAtivaId: null })
  })

  it('com 1 vínculo retorna a escola única como ativa', async () => {
    const sb = makeSupabase({
      vinculos: [
        { id: 'v1', escola_id: 'esc-1', papel_id: 'p1', created_at: '2026-01-01T00:00:00.000Z', escola: { nome: 'Colégio Horizonte' } },
      ],
    })
    expect(await getUnidadesDoAdmin(sb)).toEqual({
      escolas: [{ id: 'esc-1', nome: 'Colégio Horizonte' }],
      escolaAtivaId: 'esc-1',
    })
  })

  it('com 2+ vínculos ordena as escolas por nome', async () => {
    const sb = makeSupabase({
      vinculos: [
        { id: 'v1', escola_id: 'esc-sj', papel_id: 'p1', created_at: '2026-01-01T00:00:00.000Z', escola: { nome: 'São Judas I' } },
        { id: 'v2', escola_id: 'esc-h', papel_id: 'p1', created_at: '2026-02-01T00:00:00.000Z', escola: { nome: 'Colégio Horizonte' } },
      ],
      selecao: null,
    })
    const res = await getUnidadesDoAdmin(sb)
    expect(res.escolas).toEqual([
      { id: 'esc-h', nome: 'Colégio Horizonte' },
      { id: 'esc-sj', nome: 'São Judas I' },
    ])
    // Sem seleção: pickEscolaAtiva cai pro vínculo mais antigo (esc-sj).
    expect(res.escolaAtivaId).toBe('esc-sj')
  })

  it('com seleção válida em saas_unidade_ativa, escolaAtivaId acompanha a seleção', async () => {
    const sb = makeSupabase({
      vinculos: [
        { id: 'v1', escola_id: 'esc-sj', papel_id: 'p1', created_at: '2026-01-01T00:00:00.000Z', escola: { nome: 'São Judas I' } },
        { id: 'v2', escola_id: 'esc-h', papel_id: 'p1', created_at: '2026-02-01T00:00:00.000Z', escola: { nome: 'Colégio Horizonte' } },
      ],
      selecao: { escola_id: 'esc-h' },
    })
    const res = await getUnidadesDoAdmin(sb)
    expect(res.escolaAtivaId).toBe('esc-h')
  })

  it('escolaAtivaId concorda com getEscolaIdParaAdmin no mesmo cenário multi-unidade', async () => {
    const vinculos: Vinculo[] = [
      { id: 'v1', escola_id: 'esc-antigo', papel_id: 'p1', created_at: '2026-01-01T00:00:00.000Z', escola: { nome: 'Escola Antiga' } },
      { id: 'v2', escola_id: 'esc-selecionada', papel_id: 'p1', created_at: '2026-02-01T00:00:00.000Z', escola: { nome: 'Escola Selecionada' } },
    ]
    const selecao = { escola_id: 'esc-selecionada' }

    const { getEscolaIdParaAdmin } = await import('@/lib/escola/getEscolaIdParaAdmin')
    const sbParaAdmin = makeSupabase({ vinculos, selecao })
    const idViaGetEscolaIdParaAdmin = await getEscolaIdParaAdmin(sbParaAdmin)

    const sbUnidades = makeSupabase({ vinculos, selecao })
    const { escolaAtivaId } = await getUnidadesDoAdmin(sbUnidades)

    expect(escolaAtivaId).toBe(idViaGetEscolaIdParaAdmin)
    expect(escolaAtivaId).toBe('esc-selecionada')
  })
})
