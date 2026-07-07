import { describe, it, expect } from 'vitest'
import {
  agruparItensEmail,
  formatarAlunoLabel,
  textoParaHtml,
  escapeHtml,
  fmtBRL,
  fmtDataCurta,
  fmtDataHora,
  type ItemEmailUnitario,
} from '@/lib/email/pedido-helpers'

const unidade = (over: Partial<ItemEmailUnitario> = {}): ItemEmailUnitario => ({
  produtoId: 'p1',
  alunoId: 'a1',
  nome: 'Camiseta Educação Física',
  imagemUrl: null,
  alunoLabel: 'João Pedro · 6º ano B',
  variante: 'Tamanho M',
  precoUnitario: 45,
  ...over,
})

describe('agruparItensEmail', () => {
  it('agrupa unidades iguais somando a quantidade', () => {
    const r = agruparItensEmail([unidade(), unidade()])
    expect(r).toHaveLength(1)
    expect(r[0].quantidade).toBe(2)
    expect(r[0].precoUnitario).toBe(45)
  })

  it('separa por variante', () => {
    const r = agruparItensEmail([unidade(), unidade({ variante: 'Tamanho G' })])
    expect(r).toHaveLength(2)
  })

  it('separa por aluno', () => {
    const r = agruparItensEmail([unidade(), unidade({ alunoId: 'a2', alunoLabel: 'Ana · 3º ano A' })])
    expect(r).toHaveLength(2)
  })

  it('preserva a ordem de aparição', () => {
    const r = agruparItensEmail([
      unidade({ produtoId: 'p2', nome: 'Apostila' }),
      unidade(),
      unidade({ produtoId: 'p2', nome: 'Apostila' }),
    ])
    expect(r.map(i => i.nome)).toEqual(['Apostila', 'Camiseta Educação Física'])
    expect(r[0].quantidade).toBe(2)
  })
})

describe('formatarAlunoLabel', () => {
  it('junta nome, série e turma', () => {
    expect(formatarAlunoLabel('João', '6º ano', 'B')).toBe('João · 6º ano B')
  })
  it('omite detalhe quando não há série nem turma', () => {
    expect(formatarAlunoLabel('João', null, null)).toBe('João')
  })
  it('funciona só com série', () => {
    expect(formatarAlunoLabel('João', '6º ano', null)).toBe('João · 6º ano')
  })
})

describe('textoParaHtml / escapeHtml', () => {
  it('escapa HTML — <script> não sobrevive', () => {
    expect(textoParaHtml('<script>alert(1)</script>')).not.toContain('<script>')
    expect(textoParaHtml('<b>x</b>')).toBe('&lt;b&gt;x&lt;/b&gt;')
  })
  it('converte quebras de linha em <br>', () => {
    expect(textoParaHtml('a\nb\r\nc')).toBe('a<br>b<br>c')
  })
  it('escapeHtml não mexe em quebras de linha', () => {
    expect(escapeHtml('a\nb')).toBe('a\nb')
  })
})

describe('formatadores', () => {
  it('fmtBRL formata em reais', () => {
    expect(fmtBRL(240.35)).toBe('R$ 240,35')
  })
  it('fmtDataCurta não sofre shift de fuso em data pura', () => {
    expect(fmtDataCurta('2026-05-20')).toBe('20/05/2026')
  })
  it('fmtDataHora formata timestamp em horário de Brasília', () => {
    expect(fmtDataHora('2026-07-06T17:32:00Z')).toBe('06/07/2026 às 14:32')
  })
})
