import { describe, it, expect } from 'vitest'
import {
  COLUNAS_COMPRAS,
  filtrarCompras,
  resumoCompras,
  formatarDataHora,
  formatarValor,
  montarCsvCompras,
  type CompraRow,
  type FiltrosCompras,
} from '@/lib/relatorio/compras'

function row(overrides: Partial<CompraRow> = {}): CompraRow {
  return {
    item_id: 'i1',
    aluno_nome: 'Maria Silva',
    aluno_serie: '6º Ano',
    aluno_turma: 'A',
    responsavel_nome: 'João Silva',
    responsavel_email: 'joao@example.com',
    responsavel_telefone: '81999990000',
    variante: null,
    pedido_numero: 'PED-2026-000001',
    pedido_status: 'pago',
    data_pagamento: '2026-07-01T13:00:00+00:00',
    preco_unitario: 115,
    estornado: false,
    ...overrides,
  }
}

const FILTRO_PADRAO: FiltrosCompras = {
  serie: null,
  turma: null,
  status: 'pago',
  incluirEstornados: false,
}

describe('filtrarCompras', () => {
  it('mantém só pagos não estornados por padrão', () => {
    const rows = [
      row({ item_id: 'a' }),
      row({ item_id: 'b', pedido_status: 'pendente' }),
      row({ item_id: 'c', pedido_status: 'cancelado' }),
      row({ item_id: 'd', estornado: true }),
    ]
    expect(filtrarCompras(rows, FILTRO_PADRAO).map(r => r.item_id)).toEqual(['a'])
  })

  it('inclui estornados quando incluirEstornados=true', () => {
    const rows = [row({ item_id: 'a' }), row({ item_id: 'd', estornado: true })]
    const out = filtrarCompras(rows, { ...FILTRO_PADRAO, incluirEstornados: true })
    expect(out.map(r => r.item_id)).toEqual(['a', 'd'])
  })

  it('status=todos devolve todos os status', () => {
    const rows = [
      row({ item_id: 'a' }),
      row({ item_id: 'b', pedido_status: 'pendente' }),
      row({ item_id: 'c', pedido_status: 'cancelado' }),
    ]
    const out = filtrarCompras(rows, { ...FILTRO_PADRAO, status: 'todos' })
    expect(out).toHaveLength(3)
  })

  it('filtra por série e turma combinadas', () => {
    const rows = [
      row({ item_id: 'a', aluno_serie: '6º Ano', aluno_turma: 'A' }),
      row({ item_id: 'b', aluno_serie: '6º Ano', aluno_turma: 'B' }),
      row({ item_id: 'c', aluno_serie: '7º Ano', aluno_turma: 'A' }),
    ]
    const out = filtrarCompras(rows, { ...FILTRO_PADRAO, serie: '6º Ano', turma: 'A' })
    expect(out.map(r => r.item_id)).toEqual(['a'])
  })
})

describe('resumoCompras', () => {
  it('soma quantidade e valor', () => {
    const rows = [row(), row({ item_id: 'i2', preco_unitario: 10.5 })]
    expect(resumoCompras(rows)).toEqual({ qtd: 2, total: 125.5 })
  })

  it('lida com preco vindo como string do PostgREST', () => {
    const rows = [row({ preco_unitario: '115.00' as unknown as number })]
    expect(resumoCompras(rows)).toEqual({ qtd: 1, total: 115 })
  })
})

describe('formatarDataHora', () => {
  it('formata em pt-BR no fuso de Recife', () => {
    expect(formatarDataHora('2026-07-01T13:00:00+00:00')).toBe('01/07/26 10:00')
  })

  it('devolve travessão para null', () => {
    expect(formatarDataHora(null)).toBe('—')
  })
})

describe('formatarValor', () => {
  it('usa vírgula decimal com 2 casas', () => {
    expect(formatarValor(115)).toBe('115,00')
    expect(formatarValor('99.9' as unknown as number)).toBe('99,90')
  })
})

describe('montarCsvCompras', () => {
  it('gera header e linhas só das colunas escolhidas', () => {
    const csv = montarCsvCompras([row()], ['aluno_nome', 'aluno_serie', 'preco_unitario'])
    const linhas = csv.split('\n')
    expect(linhas[0]).toBe('Aluno,Série,Valor')
    expect(linhas[1]).toBe('"Maria Silva","6º Ano","115,00"')
  })

  it('escapa aspas duplas e trata nulos', () => {
    const csv = montarCsvCompras(
      [row({ aluno_nome: 'Ana "Aninha" Souza', aluno_turma: null })],
      ['aluno_nome', 'aluno_turma'],
    )
    expect(csv.split('\n')[1]).toBe('"Ana ""Aninha"" Souza",""')
  })

  it('formata data de pagamento na coluna', () => {
    const csv = montarCsvCompras([row()], ['pedido_numero', 'data_pagamento'])
    expect(csv.split('\n')[1]).toBe('"PED-2026-000001","01/07/26 10:00"')
  })

  it('toda coluna declarada em COLUNAS_COMPRAS é exportável sem erro', () => {
    const todas = COLUNAS_COMPRAS.map(c => c.key)
    const csv = montarCsvCompras([row()], todas)
    expect(csv.split('\n')[0].split(',')).toHaveLength(todas.length)
  })
})
