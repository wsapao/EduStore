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
import { enviarEmailIngresso } from '@/lib/email/send'
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

  // 1. Atualiza pedido
  const { error: pedidoErr } = await supabase
    .from('pedidos')
    .update({ status: 'pago', data_pagamento: now })
    .eq('id', pedidoId)
    .eq('status', 'pendente') // idempotência: só atualiza se ainda pendente

  if (pedidoErr) {
    throw new Error(`Erro ao atualizar pedido ${pedidoId}: ${pedidoErr.message}`)
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

  // 4. Envia emails de ingressos em background (não bloqueia a resposta ao webhook)
  void enviarEmailsIngressos(supabase, pedidoId)
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
        console.error(`[webhook/asaas] Erro ao confirmar estorno ${payment.id}:`, rpcErr.message)
        return Response.json({ ok: false, error: rpcErr.message }, { status: 500 })
      }
      console.log(`[webhook/asaas] Estorno ${payment.id} confirmado via webhook (${event}).`)
    }
    return Response.json({ ok: true })
  }

  // Concurso de bolsas — Pix vencido
  if (event === 'PAYMENT_OVERDUE' && payment.externalReference?.startsWith(CONCURSO_REF_PREFIX)) {
    await expirarPagamentoConcurso(payment.externalReference.slice(CONCURSO_REF_PREFIX.length))
    return Response.json({ ok: true })
  }

  // 4. Processa apenas eventos de confirmação de pagamento
  const EVENTOS_CONFIRMACAO = [
    'PAYMENT_RECEIVED',
    'PAYMENT_CONFIRMED',
    'PAYMENT_RECEIVED_IN_CASH_UNDONE',
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
      console.error(`[webhook/asaas] Erro ao confirmar recarga ${recargaId}:`, rpcErr.message)
      return Response.json({ ok: false, error: rpcErr.message }, { status: 500 })
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
