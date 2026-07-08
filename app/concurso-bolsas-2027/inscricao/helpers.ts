/** Helpers puros do formulário de inscrição (testáveis sem DOM). */

/** Máscara progressiva de CPF (000.000.000-00), truncando em 11 dígitos. */
export function mascararCPF(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/** mm:ss a partir de milissegundos restantes; nunca negativo. */
export function formatarContador(msRestantes: number): string {
  const total = Math.max(0, Math.floor(msRestantes / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
