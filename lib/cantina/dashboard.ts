export type CantinaDashboardMovement = {
  tipo?: string | null
  valor?: number | null
}

export type CantinaMonthSummary = {
  recargasMes: number
  consumoMes: number
  estornosMes: number
}

const EMPTY_SUMMARY: CantinaMonthSummary = {
  recargasMes: 0,
  consumoMes: 0,
  estornosMes: 0,
}

export function summarizeCantinaMovementsMonth(
  movements: CantinaDashboardMovement[] | null | undefined,
): CantinaMonthSummary {
  if (!movements?.length) {
    return { ...EMPTY_SUMMARY }
  }

  return movements.reduce<CantinaMonthSummary>((summary, movement) => {
    const amount = Math.abs(Number(movement.valor ?? 0))

    if (!Number.isFinite(amount) || amount === 0) {
      return summary
    }

    if (movement.tipo === 'recarga') {
      summary.recargasMes += amount
    }

    if (movement.tipo === 'consumo') {
      summary.consumoMes += amount
    }

    if (movement.tipo === 'estorno') {
      summary.estornosMes += amount
    }

    return summary
  }, { ...EMPTY_SUMMARY })
}
