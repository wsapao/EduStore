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
import { asaasGateway } from './asaas'

export function getGateway(): GatewayPagamento {
  if (process.env.ASAAS_API_KEY) {
    return asaasGateway
  }

  if (process.env.NODE_ENV === 'production' && process.env.PAGAMENTOS_PERMITIR_MOCK !== '1') {
    throw new Error(
      'Gateway de pagamento não configurado em produção. ' +
        'Defina ASAAS_API_KEY ou (temporariamente) PAGAMENTOS_PERMITIR_MOCK=1.',
    )
  }

  return mockGateway
}

export function isGatewayReal(): boolean {
  return !!process.env.ASAAS_API_KEY
}
