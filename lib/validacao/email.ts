/** Validação de e-mail compartilhada entre formulários. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validarEmail(email: string): boolean {
  return EMAIL_RE.test(email ?? '')
}
