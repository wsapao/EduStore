import { describe, expect, it } from 'vitest'

import {
  formatGatewayId,
  getRecargaMetodoMeta,
  getRecargaPrimaryEvent,
  getRecargaStatusMeta,
} from '@/lib/cantina/recargas'

describe('cantina recargas helpers', () => {
  it('mapeia status para labels e tons do tema claro', () => {
    expect(getRecargaStatusMeta('confirmada')).toMatchObject({
      label: 'Confirmada',
      tone: 'success',
    })

    expect(getRecargaStatusMeta('estornada')).toMatchObject({
      label: 'Estornada',
      tone: 'violet',
    })
  })

  it('mapeia metodo de pagamento para label amigavel', () => {
    expect(getRecargaMetodoMeta('pix')).toMatchObject({
      label: 'PIX',
      icon: '⚡',
      tone: 'warning',
    })

    expect(getRecargaMetodoMeta('cartao')).toMatchObject({
      label: 'Cartão',
      icon: '💳',
      tone: 'info',
    })
  })

  it('prioriza o evento principal conforme o status atual da recarga', () => {
    expect(getRecargaPrimaryEvent({
      status: 'estornada',
      created_at: '2026-05-18T10:00:00.000Z',
      confirmada_em: '2026-05-18T10:02:00.000Z',
      cancelada_em: null,
      estornada_em: '2026-05-18T10:05:00.000Z',
    })).toEqual({
      label: 'Estornada em',
      value: '2026-05-18T10:05:00.000Z',
    })
  })

  it('encurta o gateway id sem perder rastreabilidade', () => {
    expect(formatGatewayId('pay_1234567890abcdef')).toBe('pay_1234...cdef')
    expect(formatGatewayId(null)).toBe('Não informado')
  })
})
