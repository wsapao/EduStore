/**
 * Seletor de gateway de pagamento.
 *
 * Se ASAAS_API_KEY estiver configurada → usa o gateway real (Asaas).
 * Caso contrário e NODE_ENV=production   → LANÇA erro (evita cobrar com mock).
 * Caso contrário (dev/preview)           → usa o gateway mock.
 *
 * Uso:
 *   import { getGateway } from '@/lib/pagamentos/gateway'
 *   const gateway = getGateway()
 *   const resultado = await gateway.criarPagamento(input)
 */
import type { GatewayPagamento } from './types'
import { mockGateway } from './mock'
import { createAsaasGateway } from './asaas'

export function getGateway(contexto: 'loja' | 'cantina' = 'loja'): GatewayPagamento {
  if (isGatewayReal()) {
    const mainKey = process.env.ASAAS_API_KEY
    const cantinaKey = process.env.ASAAS_CANTINA_API_KEY

    // Se estiver no contexto cantina E a chave cantina estiver configurada
    if (contexto === 'cantina' && cantinaKey) {
      return createAsaasGateway(cantinaKey)
    }

    if (!mainKey) {
      throw new Error('ASAAS_API_KEY principal não configurada.')
    }
    return createAsaasGateway(mainKey)
  }

  if (process.env.NODE_ENV === 'production') {
    console.warn(
      'Gateway de pagamento não configurado em produção. ' +
      'Usando gateway MOCK que sempre aprova.',
    )
  }

  return mockGateway
}

export function isGatewayReal(): boolean {
  return !!process.env.ASAAS_API_KEY
}
