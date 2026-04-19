import type { MetodoPagamento } from '@/types/database'

// ── Entrada ──────────────────────────────────────────────────────────────────

export interface ItemPedidoInput {
  produto_id: string
  aluno_id: string
  preco_unitario: number
  nome: string        // para exibição no gateway
}

export interface DadosCartao {
  numero: string
  nome: string
  validade: string   // MM/AA
  cvv: string
  parcelas: number
}

export interface CriarPagamentoInput {
  metodo: MetodoPagamento
  total: number
  parcelas?: number
  dadosCartao?: DadosCartao
  responsavel: {
    nome: string
    email: string
    cpf: string
  }
  descricao: string
  referencia: string  // pedido_id
}

// ── Saída ─────────────────────────────────────────────────────────────────────

export interface ResultadoPix {
  metodo: 'pix'
  gateway_id: string
  qr_code: string        // texto copia-e-cola
  qr_code_imagem: string // base64 data URL
  tx_id: string
  expiracao: string      // ISO date
  status: 'aguardando'
}

export interface ResultadoCartao {
  metodo: 'cartao'
  gateway_id: string
  status: 'confirmado' | 'falhou'
  parcelas: number
  bandeira?: string
  ultimos_digitos?: string
}

export interface ResultadoBoleto {
  metodo: 'boleto'
  gateway_id: string
  codigo: string
  linha_digitavel: string
  vencimento: string  // ISO date
  url: string
  status: 'aguardando'
}

export type ResultadoPagamento = ResultadoPix | ResultadoCartao | ResultadoBoleto

// ── Interface do gateway ──────────────────────────────────────────────────────

export interface GatewayPagamento {
  criarPagamento(input: CriarPagamentoInput): Promise<ResultadoPagamento>
  consultarStatus(gateway_id: string): Promise<'aguardando' | 'confirmado' | 'falhou' | 'expirado' | 'reembolsado'>
}
