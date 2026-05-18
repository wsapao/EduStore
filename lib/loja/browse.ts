export function buildLojaCategoryHref(categoryKey: string, alunoId: string) {
  const params = new URLSearchParams({
    categoria: categoryKey,
    aluno: alunoId,
  })

  return `/loja?${params.toString()}`
}

export function resolveSelectedCategoryKey(
  requestedCategory: string | null | undefined,
  visibleCategoryKeys: readonly string[],
) {
  const normalizedCategory = requestedCategory?.trim()

  if (!normalizedCategory) {
    return null
  }

  return visibleCategoryKeys.includes(normalizedCategory) ? normalizedCategory : null
}

export function filterGroupedEntriesByCategory<T>(
  groupedEntries: ReadonlyArray<readonly [string, T[]]>,
  selectedCategoryKey: string | null,
) {
  if (!selectedCategoryKey) {
    return groupedEntries
  }

  return groupedEntries.filter(([categoryKey]) => categoryKey === selectedCategoryKey)
}
