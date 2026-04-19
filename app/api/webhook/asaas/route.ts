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

export const runtime = 'nodejs'

// ── Tipos do payload Asaas ─────────────────────────────────────────────────────

interface AsaasWebhookPayload {
  event: string
  payment?: {
    id: string
    status: string
    value: number
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

async function confirmarPagamento(pedidoId: string): Promise<void> {
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

  // 2. Atualiza pagamento
  await supabase
    .from('pagamentos')
    .update({ status: 'confirmado', webhook_confirmado_em: now })
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

  // 3. Processa apenas eventos de confirmação de pagamento
  const EVENTOS_CONFIRMACAO = [
    'PAYMENT_RECEIVED',
    'PAYMENT_CONFIRMED',
    'PAYMENT_RECEIVED_IN_CASH_UNDONE', // edge case — ignorado abaixo pelo status check
  ]

  if (!EVENTOS_CONFIRMACAO.includes(event)) {
    // Retorna 200 para não causar reenvios desnecessários do Asaas
    return Response.json({ ok: true, ignored: true, event })
  }

  if (!payment?.id) {
    return Response.json({ error: 'Payload sem payment.id.' }, { status: 400 })
  }

  // 4. Localiza pedido pelo gateway_id
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

  // 5. Idempotência — se já confirmado, ignora
  if (pagamento.status === 'confirmado') {
    return Response.json({ ok: true, ignored: true, reason: 'Já confirmado.' })
  }

  // 6. Confirma pagamento e gera ingressos
  try {
    await confirmarPagamento(pagamento.pedido_id)
    console.log(`[webhook/asaas] Pedido ${pagamento.pedido_id} confirmado via webhook.`)
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
