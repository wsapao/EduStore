/**
 * Utilitários monetários. Centraliza arredondamento em centavos e a divisão
 * de parcelas para evitar erros de ponto flutuante e garantir que a soma das
 * parcelas feche exatamente com o total cobrado.
 */

/**
 * Arredonda um valor monetário para 2 casas (centavos), tolerando ruído de
 * ponto flutuante (ex.: 0.1 + 0.2 = 0.30000000000000004).
 */
export function arredondarCentavos(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

/**
 * Divide um total em N parcelas iguais em centavos, colocando o resto (sobra de
 * centavos) na última parcela para que a soma feche exatamente com o total.
 *
 * Ex.: 100.00 em 3x → [33.33, 33.33, 33.34] (soma = 100.00).
 */
export function dividirParcelas(total: number, parcelas: number): number[] {
  if (!Number.isFinite(total) || parcelas <= 1) {
    return [arredondarCentavos(total)]
  }
  const totalCentavos = Math.round(total * 100)
  const base = Math.floor(totalCentavos / parcelas)
  const resto = totalCentavos - base * parcelas
  const valores: number[] = []
  for (let i = 0; i < parcelas; i++) {
    // A última parcela absorve o resto de centavos.
    const centavos = i === parcelas - 1 ? base + resto : base
    valores.push(centavos / 100)
  }
  return valores
}

/**
 * Valor de cada parcela (menos a última) para enviar como `installmentValue` ao
 * gateway. A última parcela é ajustada pelo gateway a partir de installmentCount,
 * mas mantemos o valor consistente com dividirParcelas.
 */
export function valorParcela(total: number, parcelas: number): number {
  return dividirParcelas(total, parcelas)[0]
}
