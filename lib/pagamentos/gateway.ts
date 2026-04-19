/**
 * Seletor de gateway de pagamento.
 *
 * Se ASAAS_API_KEY estiver configurada → usa o gateway real (Asaas).
 * Caso contrário               → usa o gateway mock (desenvolvimento).
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
  return mockGateway
}
