import type { MetodoPagamento, Produto, ProdutoVariante } from '@/types/database'

type ProdutoRaw = Produto & {
  variantes_rel?: ProdutoVariante[] | null
}

const METODOS_ACEITOS_VALIDOS: MetodoPagamento[] = ['pix', 'cartao', 'boleto']

function coerceStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  if (typeof value !== 'string') {
    return []
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return []
  }

  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (parsed !== value) {
      return coerceStringArray(parsed)
    }
  } catch {
    // Ignora formatos legados não JSON e tenta o fallback abaixo.
  }

  return trimmed
    .replace(/^[\[{(]+|[\]})]+$/g, '')
    .split(/[\n,;|]+/)
    .map((item) => item.trim().replace(/^['"]+|['"]+$/g, ''))
    .filter(Boolean)
}

function coerceMetodosAceitos(value: unknown): MetodoPagamento[] {
  const metodos = coerceStringArray(value)
    .map((item) => item.toLowerCase())
    .filter((item): item is MetodoPagamento => METODOS_ACEITOS_VALIDOS.includes(item as MetodoPagamento))

  return metodos.length > 0 ? Array.from(new Set(metodos)) : ['pix']
}

function coerceOptionalStringArray(value: unknown): string[] | null {
  const items = Array.from(new Set(coerceStringArray(value)))
  return items.length > 0 ? items : null
}

export function normalizarProduto(raw: ProdutoRaw): Produto {
  const variantesDisponiveis = (raw.variantes_rel ?? [])
    .filter((variante) => variante.disponivel && (variante.estoque === null || variante.estoque > 0))
    .sort((a, b) => a.ordem - b.ordem)
    .map((variante) => variante.nome)

  const variantesLegadas = coerceOptionalStringArray(raw.variantes)

  return {
    ...raw,
    metodos_aceitos: coerceMetodosAceitos(raw.metodos_aceitos),
    series: coerceOptionalStringArray(raw.series),
    variantes: variantesDisponiveis.length > 0 ? variantesDisponiveis : variantesLegadas,
  }
}

export function normalizarVariantes(raw: ProdutoRaw): ProdutoVariante[] {
  const variantes = raw.variantes_rel ?? []
  if (variantes.length > 0) {
    return [...variantes].sort((a, b) => a.ordem - b.ordem)
  }

  return (coerceOptionalStringArray(raw.variantes) ?? []).map((nome, index) => ({
    id: `fallback-${index}-${nome}`,
    produto_id: raw.id,
    nome,
    disponivel: true,
    estoque: null,
    ordem: index,
    created_at: raw.created_at,
  }))
}
