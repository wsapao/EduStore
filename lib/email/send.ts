import { getResend, EMAIL_FROM, SITE_URL } from './resend'
import {
  emailConfirmacaoPedido,
  emailPedidoPago,
  emailPedidoCancelado,
  emailRecargaAprovada,
  emailPixExpirado,
  emailIngressoEmitido,
  emailResetSenhaAdmin,
  emailAvisoTrocaEmail,
  emailInscricaoConcurso,
  type EmailPedidoParams,
  type EmailPedidoPagoParams,
  type EmailPedidoCanceladoParams,
  type EmailRecargaAprovadaParams,
  type EmailPixExpiradoParams,
  type EmailIngressoParams,
  type EmailResetSenhaAdminParams,
  type EmailAvisoTrocaEmailParams,
  type EmailInscricaoConcursoParams,
} from './templates'

// ── Enviar confirmação de pedido ──────────────────────────────────────────────
// params.pedidoUrl já chega absoluta (montada pelo chamador).
export async function enviarEmailPedido(
  to: string,
  params: EmailPedidoParams
) {
  const resend = getResend()
  if (!resend) return // silenciosamente ignora se RESEND_API_KEY não configurado

  const { subject, html } = emailConfirmacaoPedido(params)

  try {
    await resend.emails.send({ from: EMAIL_FROM, to, subject, html })
  } catch (err) {
    // Não quebra o fluxo por falha de email
    console.error('[Email] Erro ao enviar confirmação de pedido:', err)
  }
}

// ── Enviar pagamento confirmado ───────────────────────────────────────────────
export async function enviarEmailPedidoPago(
  to: string,
  params: EmailPedidoPagoParams
) {
  const resend = getResend()
  if (!resend) return

  const { subject, html } = emailPedidoPago(params)

  try {
    await resend.emails.send({ from: EMAIL_FROM, to, subject, html })
  } catch (err) {
    console.error('[Email] Erro ao enviar pagamento confirmado:', err)
  }
}

// ── Enviar pedido cancelado ───────────────────────────────────────────────────
export async function enviarEmailPedidoCancelado(
  to: string,
  params: EmailPedidoCanceladoParams
) {
  const resend = getResend()
  if (!resend) return

  const { subject, html } = emailPedidoCancelado(params)

  try {
    await resend.emails.send({ from: EMAIL_FROM, to, subject, html })
  } catch (err) {
    console.error('[Email] Erro ao enviar pedido cancelado:', err)
  }
}

// ── Enviar recarga de cantina aprovada ────────────────────────────────────────
export async function enviarEmailRecargaAprovada(
  to: string,
  params: EmailRecargaAprovadaParams
) {
  const resend = getResend()
  if (!resend) return

  const { subject, html } = emailRecargaAprovada(params)

  try {
    await resend.emails.send({ from: EMAIL_FROM, to, subject, html })
  } catch (err) {
    console.error('[Email] Erro ao enviar recarga aprovada:', err)
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
): Promise<boolean> {
  const resend = getResend()
  if (!resend) {
    console.warn('[Email] RESEND_API_KEY não configurado — reset de senha não enviado por e-mail.')
    return false
  }

  const { subject, html } = emailResetSenhaAdmin(params)

  try {
    await resend.emails.send({ from: EMAIL_FROM, to, subject, html })
    return true
  } catch (err) {
    console.error('[Email] Erro ao enviar reset administrativo de senha:', err)
    return false
  }
}

// ── Aviso de troca de e-mail de acesso ────────────────────────────────────────
export async function enviarEmailAvisoTrocaEmail(
  to: string,
  params: EmailAvisoTrocaEmailParams,
) {
  const resend = getResend()
  if (!resend) return

  const { subject, html } = emailAvisoTrocaEmail(params)

  try {
    await resend.emails.send({ from: EMAIL_FROM, to, subject, html })
  } catch (err) {
    console.error('[Email] Erro ao enviar aviso de troca de e-mail:', err)
  }
}

// ── Enviar confirmação de inscrição no Concurso de Bolsas ────────────────────
export async function enviarEmailInscricaoConcurso(
  to: string,
  params: EmailInscricaoConcursoParams
) {
  const resend = getResend()
  if (!resend) return

  const { subject, html } = emailInscricaoConcurso(params)

  try {
    await resend.emails.send({ from: EMAIL_FROM, to, subject, html })
  } catch (err) {
    console.error('[Email] Erro ao enviar confirmação de inscrição do concurso:', err)
  }
}
