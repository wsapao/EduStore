import type { Produto, ProdutoVariante } from '@/types/database'

type ProdutoRaw = Produto & {
  variantes_rel?: ProdutoVariante[] | null
}

export function normalizarProduto(raw: ProdutoRaw): Produto {
  const variantesDisponiveis = (raw.variantes_rel ?? [])
    .filter((variante) => variante.disponivel && (variante.estoque === null || variante.estoque > 0))
    .sort((a, b) => a.ordem - b.ordem)
    .map((variante) => variante.nome)

  return {
    ...raw,
    variantes: variantesDisponiveis.length > 0 ? variantesDisponiveis : raw.variantes ?? null,
  }
}

export function normalizarVariantes(raw: ProdutoRaw): ProdutoVariante[] {
  const variantes = raw.variantes_rel ?? []
  if (variantes.length > 0) {
    return [...variantes].sort((a, b) => a.ordem - b.ordem)
  }

  return (raw.variantes ?? []).map((nome, index) => ({
    id: `fallback-${index}-${nome}`,
    produto_id: raw.id,
    nome,
    disponivel: true,
    estoque: null,
    ordem: index,
    created_at: raw.created_at,
  }))
}
