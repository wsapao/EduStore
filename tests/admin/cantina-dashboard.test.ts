import { describe, expect, it } from 'vitest'

import { summarizeCantinaMovementsMonth } from '@/lib/cantina/dashboard'

describe('summarizeCantinaMovementsMonth', () => {
  it('soma recargas, consumo e estornos usando o valor absoluto por tipo', () => {
    const summary = summarizeCantinaMovementsMonth([
      { tipo: 'recarga', valor: 25.2 },
      { tipo: 'consumo', valor: 8.5 },
      { tipo: 'estorno', valor: 5 },
      { tipo: 'estorno', valor: -2.75 },
      { tipo: 'ajuste_manual', valor: 99 },
      { tipo: null, valor: null },
    ])

    expect(summary).toEqual({
      recargasMes: 25.2,
      consumoMes: 8.5,
      estornosMes: 7.75,
    })
  })

  it('retorna zero quando não há movimentos do mês', () => {
    expect(summarizeCantinaMovementsMonth([])).toEqual({
      recargasMes: 0,
      consumoMes: 0,
      estornosMes: 0,
    })
  })
})
