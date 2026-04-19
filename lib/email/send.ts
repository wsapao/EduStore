import { getResend, EMAIL_FROM, SITE_URL } from './resend'
import {
  emailConfirmacaoPedido,
  emailPixExpirado,
  emailIngressoEmitido,
  emailResetSenhaAdmin,
  type EmailPedidoParams,
  type EmailPixExpiradoParams,
  type EmailIngressoParams,
  type EmailResetSenhaAdminParams,
} from './templates'

// ── Enviar confirmação de pedido ──────────────────────────────────────────────
export async function enviarEmailPedido(
  to: string,
  params: EmailPedidoParams
) {
  const resend = getResend()
  if (!resend) return // silenciosamente ignora se RESEND_API_KEY não configurado

  const { subject, html } = emailConfirmacaoPedido({
    ...params,
    pedidoUrl: `${SITE_URL}/pedido/${params.pedidoUrl}`,
  })

  try {
    await resend.emails.send({ from: EMAIL_FROM, to, subject, html })
  } catch (err) {
    // Não quebra o fluxo por falha de email
    console.error('[Email] Erro ao enviar confirmação de pedido:', err)
  }
}

// ── Enviar ingresso emitido ───────────────────────────────────────────────────
export async function enviarEmailIngresso(
  to: string,
  params: EmailIngressoParams
) {
  const resend = getResend()
  if (!resend) return

  const { subject, html } = emailIngressoEmitido({
    ...params,
    ingressoUrl: `${SITE_URL}/ingresso/${params.ingressoUrl}`,
  })

  try {
    await resend.emails.send({ from: EMAIL_FROM, to, subject, html })
  } catch (err) {
    console.error('[Email] Erro ao enviar ingresso:', err)
  }
}

export async function enviarEmailPixExpirado(
  to: string,
  params: EmailPixExpiradoParams
) {
  const resend = getResend()
  if (!resend) return

  const { subject, html } = emailPixExpirado({
    ...params,
    pedidoUrl: `${SITE_URL}/pedido/${params.pedidoUrl}`,
  })

  try {
    await resend.emails.send({ from: EMAIL_FROM, to, subject, html })
  } catch (err) {
    console.error('[Email] Erro ao enviar aviso de PIX expirado:', err)
  }
}

export async function enviarEmailResetSenhaAdmin(
  to: string,
  params: EmailResetSenhaAdminParams
) {
  const resend = getResend()
  if (!resend) return

  const { subject, html } = emailResetSenhaAdmin(params)

  try {
    await resend.emails.send({ from: EMAIL_FROM, to, subject, html })
  } catch (err) {
    console.error('[Email] Erro ao enviar reset administrativo de senha:', err)
  }
}
