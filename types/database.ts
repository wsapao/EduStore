export type MetodoPagamento = 'pix' | 'cartao' | 'boleto'
export type CategoriaProduto = string
export type StatusPedido = 'pendente' | 'pago' | 'cancelado' | 'reembolsado'
export type StatusPagamento = 'aguardando' | 'confirmado' | 'falhou' | 'expirado' | 'reembolsado'

export interface Escola {
  id: string
  nome: string
  cnpj: string | null
  cor_primaria: string
  logo_url: string | null
  dominio: string | null
  ativo: boolean
  created_at: string
}

export interface Responsavel {
  id: string
  nome: string
  email: string
  cpf: string
  telefone: string | null
  escola_id: string | null
  ativo: boolean
  excluido_em: string | null
  created_at: string
}

export interface Aluno {
  id: string
  nome: string
  serie: string
  turma: string | null
  escola_id: string
  ativo: boolean
  created_at: string
}

export interface Produto {
  id: string
  escola_id: string
  nome: string
  descricao: string | null
  preco: number
  categoria: CategoriaProduto
  metodos_aceitos: MetodoPagamento[]
  max_parcelas: number
  prazo_compra: string | null
  data_evento: string | null
  hora_evento: string | null   // time → string HH:mm:ss
  local_evento: string | null
  gera_ingresso: boolean
  capacidade: number | null
  series: string[] | null
  variantes: string[] | null
  icon: string | null
  imagem_url: string | null
  preco_promocional: number | null
  aceita_vouchers: boolean
  estoque: number | null
  ativo: boolean
  esgotado: boolean
  created_at: string
}

export interface Categoria {
  id: string
  escola_id: string
  nome: string
  icone: string
  ativo: boolean
  created_at: string
}

export interface Voucher {
  id: string
  escola_id: string
  codigo: string
  tipo_desconto: 'percentual' | 'fixo'
  valor: number
  limite_usos: number | null
  usos_atuais: number
  compra_minima: number | null
  data_validade: string | null
  produto_id: string | null
  ativo: boolean
  created_at: string
}

export interface ProdutoVariante {
  id: string
  produto_id: string
  nome: string
  disponivel: boolean
  estoque: number | null
  reservado?: number | null
  ordem: number
  created_at: string
}

export interface Pedido {
  id: string
  numero: string
  responsavel_id: string
  escola_id: string
  status: StatusPedido
  metodo_pagamento: MetodoPagamento | null
  total: number
  data_criacao: string
  data_pagamento: string | null
  created_at: string
}

export interface ItemPedido {
  id: string
  pedido_id: string
  produto_id: string
  aluno_id: string
  variante_id?: string | null
  variante: string | null
  preco_unitario: number
  created_at: string
}

export interface Pagamento {
  id: string
  pedido_id: string
  gateway_id: string | null
  metodo: MetodoPagamento
  status: StatusPagamento
  total: number
  parcelas: number
  pix_qr_code: string | null
  pix_qr_code_imagem: string | null
  pix_tx_id: string | null
  pix_expiracao: string | null
  boleto_codigo: string | null
  boleto_linha_digitavel: string | null
  boleto_vencimento: string | null
  boleto_url: string | null
  webhook_confirmado_em: string | null
  created_at: string
}

export type StatusIngresso = 'emitido' | 'usado' | 'cancelado' | 'expirado'

export interface Ingresso {
  id: string
  token: string
  item_pedido_id: string
  produto_id: string
  aluno_id: string
  responsavel_id: string
  status: StatusIngresso
  usado_em: string | null
  validado_por: string | null
  created_at: string
}

// Tipos compostos para views
export interface AlunoComResponsavel extends Aluno {
  escola: Escola
}

export interface PedidoComItens extends Pedido {
  itens: (ItemPedido & { produto: Produto; aluno: Aluno })[]
  pagamento?: Pagamento
}

// ── Cantina ──────────────────────────────────────────────────
export type TipoMovimentacaoCantina = 'recarga' | 'consumo' | 'estorno' | 'ajuste_manual'
export type TipoPedidoCantina = 'presencial' | 'online'
export type StatusPedidoCantina = 'aberto' | 'confirmado' | 'pronto' | 'retirado' | 'cancelado'

export interface CantinaProduto {
  id: string
  escola_id: string
  nome: string
  descricao: string | null
  preco: number
  categoria: string
  icone: string
  ativo: boolean
  estoque: number | null
  alergenos: string[]
  disponivel_presencial: boolean
  disponivel_online: boolean
  ordem: number
  created_at: string
}

export interface CantinaCarteira {
  id: string
  aluno_id: string
  escola_id: string
  saldo: number
  limite_diario: number | null
  ativo: boolean
  bloqueio_motivo: string | null
  qr_token: string
  created_at: string
  updated_at: string
}

export interface CantinaMovimentacao {
  id: string
  carteira_id: string
  tipo: TipoMovimentacaoCantina
  valor: number
  saldo_apos: number
  descricao: string | null
  operador_id: string | null
  pedido_cantina_id: string | null
  gateway_pagamento_id: string | null
  created_at: string
}

export interface CantinaPedido {
  id: string
  escola_id: string
  aluno_id: string
  operador_id: string | null
  tipo: TipoPedidoCantina
  status: StatusPedidoCantina
  total: number
  numero: number
  observacao: string | null
  movimentacao_id: string | null
  created_at: string
  updated_at: string
}

export interface CantinaPedidoItem {
  id: string
  pedido_id: string
  produto_id: string
  quantidade: number
  preco_unitario: number
}

export interface CantinaRestricao {
  id: string
  aluno_id: string
  produto_id: string | null
  categoria: string | null
  motivo: string | null
  created_at: string
}

export interface CantinaCarteiraComAluno extends CantinaCarteira {
  aluno: Pick<Aluno, 'id' | 'nome' | 'serie' | 'turma'>
}

export interface CantinaMovimentacaoComAluno extends CantinaMovimentacao {
  carteira: {
    aluno: Pick<Aluno, 'id' | 'nome'>
  }
}
