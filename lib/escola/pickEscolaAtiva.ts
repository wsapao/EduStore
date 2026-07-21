export type VinculoAtivo = { escolaId: string; papelId: string; createdAt: string; vinculoId: string }

/**
 * Espelha loja_escola_ativa() do SQL: seleção válida senão o vínculo mais
 * antigo (createdAt, vinculoId). Comparação bytewise.
 */
export function pickEscolaAtiva(vinculos: VinculoAtivo[], selecionadaEscolaId: string | null): VinculoAtivo | null {
  if (!vinculos.length) return null
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
  const ordenados = [...vinculos].sort((a, b) => cmp(a.createdAt, b.createdAt) || cmp(a.vinculoId, b.vinculoId))
  if (selecionadaEscolaId) {
    const m = ordenados.find((v) => v.escolaId === selecionadaEscolaId)
    if (m) return m
  }
  return ordenados[0]
}
