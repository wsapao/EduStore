import type { SupabaseClient } from '@supabase/supabase-js'
import type { MetodoPagamento } from '@/types/database'
import { SITE_URL } from './resend'
import { enviarEmailPedido, enviarEmailPedidoPago } from './send'
import { resolverTemplatePedido } from './resolver-template'
import type { EmailTemplateTipo } from './templates-config'
import {
  agruparItensEmail,
  formatarAlunoLabel,
  fmtBRL,
  fmtDataCurta,
  fmtDataHora,
  type ItemEmailUnitario,
} from './pedido-helpers'

const TIPO_POR_METODO: Record<MetodoPagamento, EmailTemplateTipo> = {
  pix: 'confirmacao_pedido_pix',
  cartao: 'confirmacao_pedido_cartao',
  boleto: 'confirmacao_pedido_boleto',
}

export interface ProdutoEmailInfo {
  nome?: string | null
  imagem_url?: string | null
  gera_ingresso?: boolean | null
}

export interface EnviarEmailCheckoutInput {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any, any, any>
  responsavel: { nome: string; email: string }
  escolaId: string | null
  pedidoId: string
  numeroPedido: string
  metodo: MetodoPagamento
  parcelas: number
  subtotal: number
  desconto: number
  total: number
  itens: { produto_id: string; aluno_id: string; variante: string | null; preco_unitario: number; nome: string }[]
  produtos: Map<string, ProdutoEmailInfo>
  cartaoAprovado: boolean
  pix?: { copiaCola: string | null; expiracao: string | null }
  boleto?: { linhaDigitavel: string | null; vencimento: string | null; url: string | null }
}

/**
 * Prepara e envia o e-mail do checkout em background. Cartão aprovado na hora
 * recebe direto o e-mail de pagamento confirmado (o webhook, idempotente,
 * não gera segundo e-mail); os demais recebem "pedido recebido".
 * Nunca lança — falha de e-mail não pode quebrar o checkout.
 */
export async function enviarEmailCheckout(input: EnviarEmailCheckoutInput): Promise<void> {
  try {
    const alunoIds = Array.from(new Set(input.itens.map(i => i.aluno_id).filter(Boolean)))
    const { data: alunos } = alunoIds.length > 0
      ? await input.client.from('alunos').select('id, nome, serie, turma').in('id', alunoIds)
      : { data: [] }
    const alunosMap = new Map(
      (alunos ?? []).map((a: { id: string; nome: string; serie: string | null; turma: string | null }) => [a.id, a]),
    )

    let escolaNome: string | null = null
    if (input.escolaId) {
      const { data: escola } = await input.client
        .from('escolas').select('nome').eq('id', input.escolaId).maybeSingle()
      escolaNome = (escola as { nome: string } | null)?.nome ?? null
    }

    const unitarios: ItemEmailUnitario[] = input.itens.map(i => {
      const produto = input.produtos.get(i.produto_id)
      const aluno = alunosMap.get(i.aluno_id)
      return {
        produtoId: i.produto_id,
        alunoId: i.aluno_id,
        nome: produto?.nome ?? i.nome,
        imagemUrl: produto?.imagem_url ?? null,
        alunoLabel: aluno ? formatarAlunoLabel(aluno.nome, aluno.serie, aluno.turma) : '',
        variante: i.variante ? `Tamanho ${i.variante}` : null,
        precoUnitario: i.preco_unitario,
      }
    })
    const itens = agruparItensEmail(unitarios)
    const pedidoUrl = `${SITE_URL}/pedido/${input.pedidoId}`
    const agora = new Date().toISOString()

    const varsBase = {
      nome_responsavel: input.responsavel.nome,
      numero_pedido: input.numeroPedido,
      total: fmtBRL(input.total),
      link_pedido: pedidoUrl,
      nome_escola: escolaNome ?? '',
    }

    if (input.cartaoAprovado) {
      const { assunto, aberturaHtml } = await resolverTemplatePedido({
        escolaId: input.escolaId,
        tipo: 'pedido_pago',
        vars: varsBase,
        client: input.client,
      })
      await enviarEmailPedidoPago(input.responsavel.email, {
        assunto,
        aberturaHtml,
        responsavelNome: input.responsavel.nome,
        numeroPedido: input.numeroPedido,
        dataPagamento: agora,
        metodoPagamento: input.metodo,
        parcelas: input.parcelas,
        total: input.total,
        itens,
        pedidoUrl,
        escolaNome,
        temIngresso: input.itens.some(i => input.produtos.get(i.produto_id)?.gera_ingresso === true),
      })
      return
    }

    const tipo = TIPO_POR_METODO[input.metodo]
    const { assunto, aberturaHtml } = await resolverTemplatePedido({
      escolaId: input.escolaId,
      tipo,
      vars: {
        ...varsBase,
        pix_qr_code: input.pix?.copiaCola ?? '',
        pix_expiracao: input.pix?.expiracao ? fmtDataHora(input.pix.expiracao) : '',
        boleto_url: input.boleto?.url ?? '',
        boleto_vencimento: input.boleto?.vencimento ? fmtDataCurta(input.boleto.vencimento) : '',
      },
      client: input.client,
    })

    await enviarEmailPedido(input.responsavel.email, {
      assunto,
      aberturaHtml,
      responsavelNome: input.responsavel.nome,
      numeroPedido: input.numeroPedido,
      dataPedido: agora,
      metodoPagamento: input.metodo,
      parcelas: input.parcelas,
      subtotal: input.subtotal,
      desconto: input.desconto,
      total: input.total,
      itens,
      pedidoUrl,
      escolaNome,
      pixCopiaCola: input.pix?.copiaCola ?? null,
      pixExpiracao: input.pix?.expiracao ?? null,
      boletoLinhaDigitavel: input.boleto?.linhaDigitavel ?? null,
      boletoVencimento: input.boleto?.vencimento ?? null,
      boletoUrl: input.boleto?.url ?? null,
    })
  } catch (err) {
    console.error('[Email] Erro ao preparar e-mail do pedido:', err)
  }
}
