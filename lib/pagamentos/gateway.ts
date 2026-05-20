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
  const mainKey = process.env.ASAAS_API_KEY
  const cantinaKey = process.env.ASAAS_CANTINA_API_KEY

  if (contexto === 'cantina') {
    const key = cantinaKey || mainKey
    if (key) return createAsaasGateway(key)
  } else if (mainKey) {
    return createAsaasGateway(mainKey)
  }

  if (process.env.NODE_ENV === 'production') {
    // Fail-closed: nunca usar o mock (que sempre aprova) em produção.
    throw new Error(
      'Gateway de pagamento não configurado em produção. ' +
      'Defina ASAAS_API_KEY (e ASAAS_CANTINA_API_KEY se aplicável).',
    )
  }

  return mockGateway
}

export function isGatewayReal(): boolean {
  return !!(process.env.ASAAS_API_KEY || process.env.ASAAS_CANTINA_API_KEY)
}
