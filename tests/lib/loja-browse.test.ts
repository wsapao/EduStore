import { describe, expect, it } from 'vitest'

import {
  buildLojaCategoryHref,
  filterGroupedEntriesByCategory,
  resolveSelectedCategoryKey,
} from '@/lib/loja/browse'

describe('loja browse helpers', () => {
  it('monta o link de "ver tudo" como filtro na propria vitrine', () => {
    expect(buildLojaCategoryHref('eventos', 'aluno-123')).toBe('/loja?categoria=eventos&aluno=aluno-123')
  })

  it('aceita apenas categorias visiveis como selecao ativa', () => {
    expect(resolveSelectedCategoryKey('eventos', ['uniforme', 'eventos'])).toBe('eventos')
    expect(resolveSelectedCategoryKey('inexistente', ['uniforme', 'eventos'])).toBeNull()
    expect(resolveSelectedCategoryKey(undefined, ['uniforme', 'eventos'])).toBeNull()
  })

  it('filtra as secoes quando uma categoria valida e informada', () => {
    const groupedEntries: Array<[string, { id: string }[]]> = [
      ['uniforme', [{ id: 'u-1' }]],
      ['eventos', [{ id: 'e-1' }, { id: 'e-2' }]],
    ]

    expect(filterGroupedEntriesByCategory(groupedEntries, 'eventos')).toEqual([
      ['eventos', [{ id: 'e-1' }, { id: 'e-2' }]],
    ])

    expect(filterGroupedEntriesByCategory(groupedEntries, null)).toEqual(groupedEntries)
  })
})
