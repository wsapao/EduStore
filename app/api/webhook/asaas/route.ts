/**
 * Webhook do Asaas — recebe notificações de pagamento.
 *
 * Configure no painel Asaas → Configurações → Integrações → Webhooks:
 *   URL: https://www.seudominio.com.br/api/webhook/asaas
 *   Token: valor de ASAAS_WEBHOOK_TOKEN
 *   Eventos: PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE
 *
 * Documentação: https://docs.asaas.com/reference/webhook-1
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarEmailIngresso, enviarEmailPedidoPago } from '@/lib/email/send'
import { resolverTemplatePedido } from '@/lib/email/resolver-template'
import { SITE_URL } from '@/lib/email/resend'
import { agruparItensEmail, formatarAlunoLabel, fmtBRL, type ItemEmailUnitario } from '@/lib/email/pedido-helpers'
import { confirmarPagamentoConcurso, expirarPagamentoConcurso } from '@/lib/concurso/confirmarPagamento'
import { CONCURSO_REF_PREFIX } from '@/lib/concurso/config'

export const runtime = 'nodejs'

// ── Tipos do payload Asaas ─────────────────────────────────────────────────────

interface AsaasWebhookPayload {
  event: string
  payment?: {
    id: string
    status: string
    value: number
    netValue?: number      // valor líquido após taxas do gateway
    billingType: string
    externalReference?: string
  }
}

// ── Validação do token ─────────────────────────────────────────────────────────

function isAuthorized(request: Request): boolean {
  const token = process.env.ASAAS_WEBHOOK_TOKEN
  if (!token) {
    console.error('[webhook/asaas] ASAAS_WEBHOOK_TOKEN não configurado.')
    return false
  }
  // Asaas envia o token no header "asaas-access-token"
  const headerToken = request.headers.get('asaas-access-token')
  return headerToken === token
}

// ── Confirmar pagamento (lógica compartilhada com admin.ts) ────────────────────

async function confirmarPagamento(pedidoId: string, netValue?: number): Promise<void> {
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // 1. Atualiza pedido — só transiciona se ainda estava pendente. Verifica o
  // rowcount: se nenhuma linha pendente foi afetada (pedido cancelado/reembolsado
  // ou já pago), NÃO segue confirmando pagamento nem gerando ingressos.
  const { data: pedidoRows, error: pedidoErr } = await supabase
    .from('pedidos')
    .update({ status: 'pago', data_pagamento: now })
    .eq('id', pedidoId)
    .eq('status', 'pendente') // idempotência: só atualiza se ainda pendente
    .select('id')

  if (pedidoErr) {
    throw new Error(`Erro ao atualizar pedido ${pedidoId}: ${pedidoErr.message}`)
  }

  if (!pedidoRows || pedidoRows.length === 0) {
    // Nenhum pedido pendente transicionado. Pode ser cancelado/reembolsado ou
    // já confirmado em corrida anterior — não emite ingressos nem e-mails.
    console.warn(`[webhook/asaas] Pedido ${pedidoId} não estava pendente; confirmação ignorada.`)
    return
  }

  // 2. Atualiza pagamento — salva valor líquido informado pelo gateway
  const pagamentoUpdate: Record<string, unknown> = {
    status: 'confirmado',
    webhook_confirmado_em: now,
  }
  if (netValue !== undefined && netValue > 0) {
    pagamentoUpdate.valor_liquido = netValue
  }

  await supabase
    .from('pagamentos')
    .update(pagamentoUpdate)
    .eq('pedido_id', pedidoId)

  // 3. Gera ingressos (RPC que insere apenas para produtos com gera_ingresso = true)
  await supabase.rpc('gerar_ingressos_pedido', { p_pedido_id: pedidoId })

  // 4 e 5. Envia e-mails aguardando a conclusão. Em serverless o processo pode
  // congelar após a resposta e engolir promises pendentes (fire-and-forget), então
  // aguardamos. As funções capturam os próprios erros — falha de e-mail não derruba
  // a confirmação do pagamento.
  await enviarEmailsIngressos(supabase, pedidoId)
  await enviarEmailPedidoPagoWebhook(supabase, pedidoId)
}

async function enviarEmailsIngressos(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  pedidoId: string,
): Promise<void> {
  try {
    const { data: itenIds } = await supabase
      .from('itens_pedido')
      .select('id')
      .eq('pedido_id', pedidoId)

    const { data: ingressos } = await supabase
      .from('ingressos')
      .select(`
        token,
        produto:produtos(nome, data_evento, hora_evento, local_evento, icon),
        aluno:alunos(nome),
        responsavel:responsaveis(nome, email),
        pedido:itens_pedido(pedido:pedidos(numero))
      `)
      .eq('status', 'emitido')
      .in('item_pedido_id', (itenIds ?? []).map((i: { id: string }) => i.id))

    for (const ing of ingressos ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const i = ing as any
      if (!i.responsavel?.email) continue
      await enviarEmailIngresso(i.responsavel.email, {
        responsavelNome: i.responsavel.nome,
        alunoNome: i.aluno?.nome ?? '',
        produtoNome: i.produto?.nome ?? '',
        dataEvento: i.produto?.data_evento,
        horaEvento: i.produto?.hora_evento,
        localEvento: i.produto?.local_evento,
        ingressoUrl: i.token,
        numeroPedido: i.pedido?.pedido?.numero ?? '',
      })
    }
  } catch (err) {
    console.error('[webhook/asaas] Erro ao enviar emails de ingressos:', err)
  }
}

async function enviarEmailPedidoPagoWebhook(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  pedidoId: string,
): Promise<void> {
  try {
    const { data: pedido } = await supabase
      .from('pedidos')
      .select('id, numero, total, data_pagamento, escola_id, responsavel:responsaveis(nome, email)')
      .eq('id', pedidoId)
      .single()
    if (!pedido?.responsavel?.email) return

    const { data: pagamento } = await supabase
      .from('pagamentos')
      .select('metodo, parcelas')
      .eq('pedido_id', pedidoId)
      .maybeSingle()

    const { data: itens } = await supabase
      .from('itens_pedido')
      .select('produto_id, aluno_id, variante, preco_unitario, produto:produtos(nome, imagem_url, gera_ingresso), aluno:alunos(nome, serie, turma)')
      .eq('pedido_id', pedidoId)

    let escolaNome: string | null = null
    if (pedido.escola_id) {
      const { data: escola } = await supabase
        .from('escolas').select('nome').eq('id', pedido.escola_id).maybeSingle()
      escolaNome = escola?.nome ?? null
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unitarios: ItemEmailUnitario[] = (itens ?? []).map((i: any) => ({
      produtoId: i.produto_id,
      alunoId: i.aluno_id,
      nome: i.produto?.nome ?? '',
      imagemUrl: i.produto?.imagem_url ?? null,
      alunoLabel: i.aluno ? formatarAlunoLabel(i.aluno.nome, i.aluno.serie, i.aluno.turma) : '',
      variante: i.variante ? `Tamanho ${i.variante}` : null,
      precoUnitario: i.preco_unitario,
    }))

    const pedidoUrl = `${SITE_URL}/pedido/${pedido.id}`
    const { assunto, aberturaHtml } = await resolverTemplatePedido({
      escolaId: pedido.escola_id,
      tipo: 'pedido_pago',
      vars: {
        nome_responsavel: pedido.responsavel.nome,
        numero_pedido: pedido.numero,
        total: fmtBRL(pedido.total),
        link_pedido: pedidoUrl,
        nome_escola: escolaNome ?? '',
      },
      client: supabase,
    })

    await enviarEmailPedidoPago(pedido.responsavel.email, {
      assunto,
      aberturaHtml,
      responsavelNome: pedido.responsavel.nome,
      numeroPedido: pedido.numero,
      dataPagamento: pedido.data_pagamento ?? new Date().toISOString(),
      metodoPagamento: pagamento?.metodo ?? 'pix',
      parcelas: pagamento?.parcelas ?? 1,
      total: pedido.total,
      itens: agruparItensEmail(unitarios),
      pedidoUrl,
      escolaNome,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      temIngresso: (itens ?? []).some((i: any) => i.produto?.gera_ingresso === true),
    })
  } catch (err) {
    console.error('[webhook/asaas] Erro ao enviar e-mail de pedido pago:', err)
  }
}

// ── Handler principal ──────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // 1. Valida token
  if (!isAuthorized(request)) {
    return Response.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  // 2. Parseia corpo
  let body: AsaasWebhookPayload
  try {
    body = (await request.json()) as AsaasWebhookPayload
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const { event, payment } = body

  console.log(`[webhook/asaas] Evento recebido: ${event}`, {
    paymentId: payment?.id,
    status: payment?.status,
    externalReference: payment?.externalReference,
  })

  if (!payment?.id) {
    return Response.json({ error: 'Payload sem payment.id.' }, { status: 400 })
  }

  // 3. Estorno confirmado pelo Asaas
  if (event === 'PAYMENT_REFUNDED' || event === 'PAYMENT_REFUND_IN_PROGRESS') {
    if (payment.externalReference?.startsWith('recarga:')) {
      const supabase = createAdminClient()
      const { error: rpcErr } = await supabase.rpc('confirmar_estorno_asaas' as any, {
        p_gateway_id: payment.id,
      })
      if (rpcErr) {
        // Erro de RPC (ex.: gateway_id órfão) é permanente: retornar 5xx faria o
        // Asaas reenviar em loop e eventualmente suspender (interrupted) o webhook,
        // parando todas as confirmações. Respondemos 200 e registramos para alerta.
        console.error(`[webhook/asaas] Erro (não-transiente) ao confirmar estorno ${payment.id}:`, rpcErr.message)
        return Response.json({ ok: true, handled: false, error: rpcErr.message })
      }
      console.log(`[webhook/asaas] Estorno ${payment.id} confirmado via webhook (${event}).`)
    }
    return Response.json({ ok: true })
  }

  // 4a. Reversão de pagamento em dinheiro (estorno de "recebido em dinheiro").
  // NÃO é uma confirmação — desfaz o pagamento: pedido e pagamento voltam a
  // pendente/aguardando para não deixar um pedido "pago" sem dinheiro real.
  if (event === 'PAYMENT_RECEIVED_IN_CASH_UNDONE') {
    if (payment.externalReference?.startsWith('recarga:')) {
      // Recarga de cantina — sem tratamento de reversão de "em dinheiro" aqui.
      return Response.json({ ok: true, ignored: true, event })
    }
    const supabase = createAdminClient()
    const { data: pagamento } = await supabase
      .from('pagamentos')
      .select('id, pedido_id')
      .eq('gateway_id', payment.id)
      .maybeSingle()

    if (!pagamento) {
      console.warn(`[webhook/asaas] Reversão em dinheiro sem pagamento local gateway_id=${payment.id}.`)
      return Response.json({ ok: true, warning: 'Pagamento não encontrado.' })
    }

    await supabase
      .from('pagamentos')
      .update({ status: 'aguardando', webhook_confirmado_em: null })
      .eq('id', pagamento.id)

    await supabase
      .from('pedidos')
      .update({ status: 'pendente', data_pagamento: null })
      .eq('id', pagamento.pedido_id)
      .eq('status', 'pago')

    console.log(`[webhook/asaas] Pagamento em dinheiro revertido (${event}) para pedido ${pagamento.pedido_id}.`)
    return Response.json({ ok: true, reverted: true })
  }

  // Concurso de bolsas — Pix vencido
  if (event === 'PAYMENT_OVERDUE' && payment.externalReference?.startsWith(CONCURSO_REF_PREFIX)) {
    await expirarPagamentoConcurso(payment.externalReference.slice(CONCURSO_REF_PREFIX.length))
    return Response.json({ ok: true })
  }

  // 4b. Processa apenas eventos de confirmação de pagamento
  const EVENTOS_CONFIRMACAO = [
    'PAYMENT_RECEIVED',
    'PAYMENT_CONFIRMED',
  ]

  if (!EVENTOS_CONFIRMACAO.includes(event)) {
    return Response.json({ ok: true, ignored: true, event })
  }

  // 5. Se a referência aponta para uma recarga de cantina, processa separadamente
  if (payment.externalReference?.startsWith('recarga:')) {
    const recargaId = payment.externalReference.slice('recarga:'.length)
    const supabase = createAdminClient()
    const { error: rpcErr } = await supabase.rpc('confirmar_recarga' as any, {
      p_recarga_id: recargaId,
    })
    if (rpcErr) {
      // Erro permanente de RPC (ex.: recarga inexistente): responder 200 para não
      // provocar reenvio em loop e suspensão do webhook no Asaas. Registra p/ alerta.
      console.error(`[webhook/asaas] Erro (não-transiente) ao confirmar recarga ${recargaId}:`, rpcErr.message)
      return Response.json({ ok: true, handled: false, error: rpcErr.message })
    }
    console.log(`[webhook/asaas] Recarga ${recargaId} confirmada via webhook.`)
    return Response.json({ ok: true })
  }

  // Concurso de bolsas — confirmação de pagamento de inscrição
  if (payment.externalReference?.startsWith(CONCURSO_REF_PREFIX)) {
    const inscricaoId = payment.externalReference.slice(CONCURSO_REF_PREFIX.length)
    const { confirmado, erro } = await confirmarPagamentoConcurso(inscricaoId, payment.netValue)
    if (erro) {
      // Retorna 500 para que o Asaas reenvie o webhook depois
      return Response.json({ ok: false, error: 'Erro ao confirmar inscrição.' }, { status: 500 })
    }
    console.log(`[webhook/asaas] Inscrição concurso ${inscricaoId} — confirmado=${confirmado}`)
    return Response.json({ ok: true })
  }

  // 5. Localiza pedido pelo gateway_id
  const supabase = createAdminClient()

  const { data: pagamento, error: pagErr } = await supabase
    .from('pagamentos')
    .select('id, pedido_id, status')
    .eq('gateway_id', payment.id)
    .single()

  if (pagErr || !pagamento) {
    // Pode acontecer em pagamentos de teste ou externos — não é erro crítico
    console.warn(`[webhook/asaas] Pagamento gateway_id=${payment.id} não encontrado no banco.`)
    return Response.json({ ok: true, warning: 'Pagamento não encontrado.' })
  }

  // 6. Idempotência — se já confirmado, ignora
  if (pagamento.status === 'confirmado') {
    return Response.json({ ok: true, ignored: true, reason: 'Já confirmado.' })
  }

  // 7. Confirma pagamento e gera ingressos
  try {
    await confirmarPagamento(pagamento.pedido_id, payment.netValue)
    console.log(`[webhook/asaas] Pedido ${pagamento.pedido_id} confirmado via webhook. netValue=${payment.netValue ?? 'não informado'}`)
    return Response.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno.'
    console.error('[webhook/asaas] Erro ao confirmar pagamento:', err)
    // Retorna 500 para que o Asaas reenvie o webhook depois
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}

// GET apenas para verificação de saúde (Asaas pode fazer ping)
export async function GET() {
  return Response.json({ ok: true, service: 'asaas-webhook' })
}
