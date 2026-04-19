import { Resend } from 'resend'

// Instancia lazily para não quebrar o build quando a chave não está configurada
let _resend: Resend | null = null

export function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

export const EMAIL_FROM = process.env.EMAIL_FROM ?? 'Loja Escolar <noreply@lojaescolar.com.br>'
export const SITE_URL   = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
