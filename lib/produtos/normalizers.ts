import type { Produto, ProdutoVariante } from '@/types/database'

type ProdutoRaw = Produto & {
  variantes_rel?: ProdutoVariante[] | null
}

function coerceStringArray(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)

    return normalized.length > 0 ? normalized : null
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null

    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) {
        const normalized = parsed
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter(Boolean)

        return normalized.length > 0 ? normalized : null
      }
    } catch {
      // Legacy rows may store comma-separated text instead of a JSON array.
    }

    const normalized = trimmed
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    return normalized.length > 0 ? normalized : null
  }

  return null
}

export function normalizarProduto(raw: ProdutoRaw): Produto {
  const variantesLegadas = coerceStringArray(raw.variantes)
  const seriesNormalizadas = coerceStringArray(raw.series)
  const variantesDisponiveis = (raw.variantes_rel ?? [])
    .filter((variante) => variante.disponivel && (variante.estoque === null || variante.estoque > 0))
    .sort((a, b) => a.ordem - b.ordem)
    .map((variante) => variante.nome)

  return {
    ...raw,
    series: seriesNormalizadas,
    variantes: variantesDisponiveis.length > 0 ? variantesDisponiveis : variantesLegadas,
  }
}

export function normalizarVariantes(raw: ProdutoRaw): ProdutoVariante[] {
  const variantes = raw.variantes_rel ?? []
  if (variantes.length > 0) {
    return [...variantes].sort((a, b) => a.ordem - b.ordem)
  }

  return (coerceStringArray(raw.variantes) ?? []).map((nome, index) => ({
    id: `fallback-${index}-${nome}`,
    produto_id: raw.id,
    nome,
    disponivel: true,
    estoque: null,
    ordem: index,
    created_at: raw.created_at,
  }))
}
