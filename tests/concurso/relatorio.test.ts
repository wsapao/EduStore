import { describe, expect, it } from 'vitest'
import { resumoFinanceiro, gerarCSV, type InscricaoRow } from '@/lib/concurso/relatorio'

const rows: InscricaoRow[] = [
  { numero: 'CB2027-0001', aluno_nome: 'A', serie_2026: '5º ano EF', modalidade: 'futsal',
    resp1_nome: 'R1', resp1_cpf: '1', resp1_email: 'a@a.com', resp1_telefone: null,
    status_pagamento: 'pago', valor: 25, valor_liquido: 24.01, created_at: '2026-07-10T12:00:00Z',
    pago_em: '2026-07-10T12:05:00Z' },
  { numero: 'CB2027-0002', aluno_nome: 'B', serie_2026: '6º ano EF', modalidade: 'judo',
    resp1_nome: 'R2', resp1_cpf: '2', resp1_email: 'b@b.com', resp1_telefone: null,
    status_pagamento: 'pendente', valor: 25, valor_liquido: null, created_at: '2026-07-11T12:00:00Z',
    pago_em: null },
]

describe('resumoFinanceiro', () => {
  it('soma apenas pagos e conta por status/modalidade', () => {
    const r = resumoFinanceiro(rows)
    expect(r.totalBruto).toBe(25)
    expect(r.totalLiquido).toBe(24.01)
    expect(r.porStatus).toEqual({ pago: 1, pendente: 1 })
    expect(r.porModalidade).toEqual({ futsal: 1, judo: 1 })
  })

  it('retorna zeros e mapas vazios para lista vazia', () => {
    const r = resumoFinanceiro([])
    expect(r.totalBruto).toBe(0)
    expect(r.totalLiquido).toBe(0)
    expect(r.totalTaxa).toBe(0)
    expect(r.porStatus).toEqual({})
    expect(r.porModalidade).toEqual({})
  })
})

describe('gerarCSV', () => {
  it('gera cabeçalho + linhas com separador ; e valores escapados', () => {
    const csv = gerarCSV(rows)
    const linhas = csv.split('\n')
    expect(linhas[0]).toContain('numero;aluno_nome')
    expect(linhas).toHaveLength(3)
    expect(linhas[1]).toContain('CB2027-0001')
  })
  it('escapa ponto-e-vírgula e aspas', () => {
    const csv = gerarCSV([{ ...rows[0], aluno_nome: 'A;B "C"' }])
    expect(csv.split('\n')[1]).toContain('"A;B ""C"""')
  })
  it('escapa valor contendo \\r avulso (sem \\n)', () => {
    const csv = gerarCSV([{ ...rows[0], aluno_nome: 'A\rB' }])
    expect(csv.split('\n')[1]).toContain('"A\rB"')
  })
})
