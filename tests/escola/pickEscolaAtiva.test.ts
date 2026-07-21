import { describe, it, expect } from 'vitest'
import { pickEscolaAtiva, type VinculoAtivo } from '@/lib/escola/pickEscolaAtiva'

function vinculo(overrides: Partial<VinculoAtivo> = {}): VinculoAtivo {
  return {
    escolaId: 'esc-1',
    papelId: 'papel-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    vinculoId: 'v1',
    ...overrides,
  }
}

describe('pickEscolaAtiva', () => {
  it('retorna null quando não há vínculos', () => {
    expect(pickEscolaAtiva([], null)).toBeNull()
  })

  it('sem seleção, retorna o vínculo mais antigo por created_at', () => {
    const antigo = vinculo({ escolaId: 'esc-antigo', vinculoId: 'v1', createdAt: '2026-01-01T00:00:00.000Z' })
    const novo = vinculo({ escolaId: 'esc-novo', vinculoId: 'v2', createdAt: '2026-02-01T00:00:00.000Z' })
    expect(pickEscolaAtiva([novo, antigo], null)).toEqual(antigo)
  })

  it('com seleção válida (vínculo existe para a escola selecionada), retorna esse vínculo', () => {
    const antigo = vinculo({ escolaId: 'esc-antigo', vinculoId: 'v1', createdAt: '2026-01-01T00:00:00.000Z' })
    const selecionado = vinculo({ escolaId: 'esc-selecionada', vinculoId: 'v2', createdAt: '2026-02-01T00:00:00.000Z' })
    expect(pickEscolaAtiva([antigo, selecionado], 'esc-selecionada')).toEqual(selecionado)
  })

  it('com seleção inválida (sem vínculo não-suspenso na escola selecionada), cai pro mais antigo', () => {
    const antigo = vinculo({ escolaId: 'esc-antigo', vinculoId: 'v1', createdAt: '2026-01-01T00:00:00.000Z' })
    const outro = vinculo({ escolaId: 'esc-outro', vinculoId: 'v2', createdAt: '2026-02-01T00:00:00.000Z' })
    expect(pickEscolaAtiva([antigo, outro], 'esc-nao-vinculada')).toEqual(antigo)
  })

  it('empate em created_at desempata pelo menor vinculoId (comparação bytewise)', () => {
    const a = vinculo({ escolaId: 'esc-a', vinculoId: 'aaa', createdAt: '2026-01-01T00:00:00.000Z' })
    const b = vinculo({ escolaId: 'esc-b', vinculoId: 'bbb', createdAt: '2026-01-01T00:00:00.000Z' })
    expect(pickEscolaAtiva([b, a], null)).toEqual(a)
  })

  it('vínculo único sempre resolve pra ele mesmo, com ou sem seleção', () => {
    const unico = vinculo()
    expect(pickEscolaAtiva([unico], null)).toEqual(unico)
    expect(pickEscolaAtiva([unico], 'esc-1')).toEqual(unico)
    expect(pickEscolaAtiva([unico], 'esc-outra-nao-vinculada')).toEqual(unico)
  })
})
