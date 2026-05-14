import { describe, expect, it } from 'vitest'

import {
  buildCategoriasHome,
  isLojaDisponivelAgora,
  normalizeLojaFuncionamento,
  pickProdutosDestaque,
  type LojaFuncionamentoSlot,
} from '@/lib/loja-online/config'

const MONDAY_MORNING = new Date('2026-05-11T10:30:00-03:00')
const MONDAY_NIGHT = new Date('2026-05-11T20:00:00-03:00')

describe('normalizeLojaFuncionamento', () => {
  it('retorna array vazio para valores ausentes ou invalidos', () => {
    expect(normalizeLojaFuncionamento(null)).toEqual([])
    expect(normalizeLojaFuncionamento({})).toEqual([])
    expect(normalizeLojaFuncionamento('foo')).toEqual([])
  })

  it('mantem apenas slots validos e ordena por dia/inicio', () => {
    const raw = [
      { dia: 2, inicio: '13:00', fim: '18:00' },
      { dia: 1, inicio: '07:00', fim: '12:00' },
      { dia: 9, inicio: '07:00', fim: '12:00' },
      { dia: 1, inicio: '12:00', fim: '12:00' },
      { dia: 1, inicio: 'ab:cd', fim: '13:00' },
    ]

    expect(normalizeLojaFuncionamento(raw)).toEqual<LojaFuncionamentoSlot[]>([
      { dia: 1, inicio: '07:00', fim: '12:00' },
      { dia: 2, inicio: '13:00', fim: '18:00' },
    ])
  })
})

describe('isLojaDisponivelAgora', () => {
  it('considera a loja aberta 24h quando nao ha horario configurado', () => {
    expect(isLojaDisponivelAgora([], MONDAY_MORNING)).toBe(true)
  })

  it('retorna true quando agora esta dentro da janela configurada', () => {
    const slots: LojaFuncionamentoSlot[] = [
      { dia: 1, inicio: '07:00', fim: '18:00' },
    ]

    expect(isLojaDisponivelAgora(slots, MONDAY_MORNING)).toBe(true)
  })

  it('retorna false quando agora esta fora da janela configurada', () => {
    const slots: LojaFuncionamentoSlot[] = [
      { dia: 1, inicio: '07:00', fim: '18:00' },
    ]

    expect(isLojaDisponivelAgora(slots, MONDAY_NIGHT)).toBe(false)
  })
})

describe('buildCategoriasHome', () => {
  it('usa todas as categorias encontradas quando config e nula', () => {
    expect(
      buildCategoriasHome({
        categoriasConfig: null,
        categoriasDescobertas: ['uniforme', 'eventos', 'uniforme', 'materiais'],
      }),
    ).toEqual(['uniforme', 'eventos', 'materiais'])
  })

  it('filtra e preserva a ordem configurada', () => {
    expect(
      buildCategoriasHome({
        categoriasConfig: ['materiais', 'uniforme', 'materiais', 'inexistente'],
        categoriasDescobertas: ['uniforme', 'eventos', 'materiais'],
      }),
    ).toEqual(['materiais', 'uniforme'])
  })
})

describe('pickProdutosDestaque', () => {
  const produtos = Array.from({ length: 8 }, (_, index) => ({
    id: `prod-${index + 1}`,
    nome: `Produto ${index + 1}`,
  }))

  it('limita os destaques a 6 itens e preserva a ordem dos ids', () => {
    expect(
      pickProdutosDestaque(
        ['prod-3', 'prod-1', 'prod-7', 'prod-2', 'prod-8', 'prod-4', 'prod-5'],
        produtos,
      ).map((produto) => produto.id),
    ).toEqual(['prod-3', 'prod-1', 'prod-7', 'prod-2', 'prod-8', 'prod-4'])
  })

  it('ignora ids inexistentes e duplicados', () => {
    expect(
      pickProdutosDestaque(
        ['prod-2', 'prod-x', 'prod-2', 'prod-1'],
        produtos,
      ).map((produto) => produto.id),
    ).toEqual(['prod-2', 'prod-1'])
  })
})
