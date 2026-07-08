/**
 * Manifest de templates de e-mail editáveis pelo admin.
 *
 * Arquivo neutro (sem 'use server') — pode ser importado de Server Components,
 * Server Actions e Client Components.
 *
 * Não confundir com `lib/email/templates.ts` (HTML hard-coded, fallback legado).
 * Aqui ficam os defaults em texto plano, com placeholders {{var}}, que o
 * admin pode customizar e salvar em `email_templates` (no banco).
 */

export type EmailTemplateTipo =
  | 'confirmacao_pedido_pix'
  | 'confirmacao_pedido_cartao'
  | 'confirmacao_pedido_boleto'
  | 'pedido_pago'
  | 'pedido_cancelado'
  | 'ingresso_emitido'
  | 'recarga_cantina_aprovada'
  | 'convite_admin'

export interface EmailTemplateVariavel {
  chave: string
  descricao: string
  exemplo: string
}

export interface EmailTemplateMeta {
  tipo: EmailTemplateTipo
  label: string
  descricao: string
  variaveis: EmailTemplateVariavel[]
  defaultAssunto: string
  defaultCorpo: string
}

const VAR_NOME_RESPONSAVEL: EmailTemplateVariavel = {
  chave: 'nome_responsavel',
  descricao: 'Nome do responsável que recebe o e-mail.',
  exemplo: 'Maria Silva',
}
const VAR_NUMERO_PEDIDO: EmailTemplateVariavel = {
  chave: 'numero_pedido',
  descricao: 'Identificador do pedido (formato curto).',
  exemplo: 'PED-1234',
}
const VAR_TOTAL: EmailTemplateVariavel = {
  chave: 'total',
  descricao: 'Valor total do pedido formatado em reais.',
  exemplo: 'R$ 89,90',
}
const VAR_LINK_PEDIDO: EmailTemplateVariavel = {
  chave: 'link_pedido',
  descricao: 'Link para o responsável acompanhar o pedido na loja.',
  exemplo: 'https://loja.exemplo.com.br/pedido/abc',
}
const VAR_NOME_ESCOLA: EmailTemplateVariavel = {
  chave: 'nome_escola',
  descricao: 'Nome da escola que assina o e-mail.',
  exemplo: 'Colégio Inovação',
}
const VAR_NOME_ALUNO: EmailTemplateVariavel = {
  chave: 'nome_aluno',
  descricao: 'Nome do aluno relacionado ao evento.',
  exemplo: 'João Silva',
}

export const EMAIL_TEMPLATE_META: Record<EmailTemplateTipo, EmailTemplateMeta> = {
  confirmacao_pedido_pix: {
    tipo: 'confirmacao_pedido_pix',
    label: 'Pedido confirmado — PIX',
    descricao: 'Enviado assim que um pedido pago via PIX é registrado, com QR Code e prazo de expiração.',
    variaveis: [
      VAR_NOME_RESPONSAVEL,
      VAR_NUMERO_PEDIDO,
      VAR_TOTAL,
      VAR_LINK_PEDIDO,
      VAR_NOME_ESCOLA,
      { chave: 'pix_qr_code', descricao: 'Código copia-e-cola do PIX.', exemplo: '00020126360014BR.GOV.BCB.PIX0114+5511999999999...' },
      { chave: 'pix_expiracao', descricao: 'Data e hora limite para pagar o PIX.', exemplo: '14/05/2026 23:59' },
    ],
    defaultAssunto: 'Pedido {{numero_pedido}} confirmado — pague com PIX',
    defaultCorpo: `Olá, {{nome_responsavel}}! Recebemos seu pedido {{numero_pedido}}. Ele fica garantido assim que o PIX for pago — o código está logo abaixo.`,
  },

  confirmacao_pedido_cartao: {
    tipo: 'confirmacao_pedido_cartao',
    label: 'Pedido confirmado — Cartão',
    descricao: 'Enviado quando o responsável conclui o checkout com cartão de crédito.',
    variaveis: [
      VAR_NOME_RESPONSAVEL,
      VAR_NUMERO_PEDIDO,
      VAR_TOTAL,
      VAR_LINK_PEDIDO,
      VAR_NOME_ESCOLA,
    ],
    defaultAssunto: 'Pedido {{numero_pedido}} recebido',
    defaultCorpo: `Olá, {{nome_responsavel}}! Recebemos seu pedido {{numero_pedido}} e o pagamento no cartão está em processamento. Você recebe outro e-mail assim que for aprovado.`,
  },

  confirmacao_pedido_boleto: {
    tipo: 'confirmacao_pedido_boleto',
    label: 'Pedido confirmado — Boleto',
    descricao: 'Enviado quando o responsável escolhe boleto bancário, com link e vencimento.',
    variaveis: [
      VAR_NOME_RESPONSAVEL,
      VAR_NUMERO_PEDIDO,
      VAR_TOTAL,
      VAR_LINK_PEDIDO,
      VAR_NOME_ESCOLA,
      { chave: 'boleto_url', descricao: 'Link para baixar o boleto em PDF.', exemplo: 'https://pagamentos.exemplo.com.br/boleto/abc.pdf' },
      { chave: 'boleto_vencimento', descricao: 'Data de vencimento do boleto.', exemplo: '20/05/2026' },
    ],
    defaultAssunto: 'Pedido {{numero_pedido}} — boleto disponível',
    defaultCorpo: `Olá, {{nome_responsavel}}! Recebemos seu pedido {{numero_pedido}}. O boleto está logo abaixo — após o pagamento, a compensação pode levar até 2 dias úteis.`,
  },

  pedido_pago: {
    tipo: 'pedido_pago',
    label: 'Pedido pago',
    descricao: 'Enviado quando o pagamento de qualquer pedido é confirmado.',
    variaveis: [
      VAR_NOME_RESPONSAVEL,
      VAR_NUMERO_PEDIDO,
      VAR_TOTAL,
      VAR_LINK_PEDIDO,
      VAR_NOME_ESCOLA,
    ],
    defaultAssunto: 'Pagamento confirmado — pedido {{numero_pedido}}',
    defaultCorpo: `Olá, {{nome_responsavel}}! O pagamento do pedido {{numero_pedido}} foi confirmado. Agora é com a escola: em breve os itens estarão disponíveis.`,
  },

  pedido_cancelado: {
    tipo: 'pedido_cancelado',
    label: 'Pedido cancelado',
    descricao: 'Enviado quando um pedido é cancelado pelo admin ou por expiração.',
    variaveis: [
      VAR_NOME_RESPONSAVEL,
      VAR_NUMERO_PEDIDO,
      VAR_LINK_PEDIDO,
      VAR_NOME_ESCOLA,
      { chave: 'motivo', descricao: 'Motivo do cancelamento (curto).', exemplo: 'Pagamento não confirmado dentro do prazo' },
    ],
    defaultAssunto: 'Pedido {{numero_pedido}} cancelado',
    defaultCorpo: `Olá, {{nome_responsavel}}. Infelizmente seu pedido {{numero_pedido}} foi cancelado — os detalhes estão logo abaixo.`,
  },

  ingresso_emitido: {
    tipo: 'ingresso_emitido',
    label: 'Ingresso emitido',
    descricao: 'Enviado quando um ingresso de evento é emitido para um aluno.',
    variaveis: [
      VAR_NOME_RESPONSAVEL,
      VAR_NOME_ALUNO,
      { chave: 'nome_evento', descricao: 'Nome do evento ou produto do tipo ingresso.', exemplo: 'Festa Junina 2026' },
      { chave: 'link_ingresso', descricao: 'Link para o ingresso digital com QR Code.', exemplo: 'https://loja.exemplo.com.br/ingresso/xyz' },
      VAR_NOME_ESCOLA,
    ],
    defaultAssunto: 'Ingresso emitido — {{nome_evento}}',
    defaultCorpo: `Olá, {{nome_responsavel}}!

O ingresso de {{nome_aluno}} para {{nome_evento}} já está disponível.

Acesse o ingresso digital (com QR Code) em:
{{link_ingresso}}

Na entrada do evento, basta apresentar o QR Code para validação.

Equipe {{nome_escola}}`,
  },

  recarga_cantina_aprovada: {
    tipo: 'recarga_cantina_aprovada',
    label: 'Recarga de cantina aprovada',
    descricao: 'Enviado ao responsável quando uma recarga de saldo da cantina é aprovada.',
    variaveis: [
      VAR_NOME_RESPONSAVEL,
      VAR_NOME_ALUNO,
      { chave: 'valor', descricao: 'Valor recarregado, formatado em reais.', exemplo: 'R$ 50,00' },
      { chave: 'saldo_atual', descricao: 'Saldo atual da cantina após a recarga.', exemplo: 'R$ 124,50' },
      VAR_NOME_ESCOLA,
    ],
    defaultAssunto: 'Recarga de cantina aprovada para {{nome_aluno}}',
    defaultCorpo: `Olá, {{nome_responsavel}}! A recarga na carteira da cantina de {{nome_aluno}} foi aprovada. Os detalhes estão logo abaixo.`,
  },

  convite_admin: {
    tipo: 'convite_admin',
    label: 'Convite de administrador',
    descricao: 'Enviado a um novo administrador quando ele é convidado para gerenciar a escola.',
    variaveis: [
      VAR_NOME_ESCOLA,
      { chave: 'link_convite', descricao: 'Link único para o convidado aceitar o convite e definir senha.', exemplo: 'https://loja.exemplo.com.br/convite/abcdef' },
    ],
    defaultAssunto: 'Convite para administrar {{nome_escola}}',
    defaultCorpo: `Olá!

Você foi convidado(a) para fazer parte da equipe administrativa de {{nome_escola}} na Loja Escolar.

Aceite o convite e defina sua senha em:
{{link_convite}}

O link é válido por tempo limitado. Se você não esperava este e-mail, pode ignorá-lo.

Equipe {{nome_escola}}`,
  },
}

/** Ordem lógica de exibição dos templates (na sidebar do editor). */
export const EMAIL_TEMPLATE_TYPES: EmailTemplateTipo[] = [
  'confirmacao_pedido_pix',
  'confirmacao_pedido_cartao',
  'confirmacao_pedido_boleto',
  'pedido_pago',
  'pedido_cancelado',
  'ingresso_emitido',
  'recarga_cantina_aprovada',
  'convite_admin',
]

export function isEmailTemplateTipo(v: unknown): v is EmailTemplateTipo {
  return typeof v === 'string' && (EMAIL_TEMPLATE_TYPES as string[]).includes(v)
}
