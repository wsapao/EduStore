import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  DEFAULT_SERIES,
  normalizeSerie,
  produtoDisponivelParaSerie,
  serieMatches,
} from '@/lib/crm/series-core'

describe('DEFAULT_SERIES', () => {
  it('usa a nomenclatura do ActiveSoft para o Ensino Médio (Xº Série EM)', () => {
    expect(DEFAULT_SERIES).toContain('1º Série EM')
    expect(DEFAULT_SERIES).toContain('2º Série EM')
    expect(DEFAULT_SERIES).toContain('3º Série EM')
  })

  it('nao mantem a variante antiga "Xº ano EM" que nunca casava com o filtro da loja', () => {
    expect(DEFAULT_SERIES.filter(s => /\dº ano EM/.test(s))).toEqual([])
  })
})

describe('normalizeSerie', () => {
  it('iguala as variantes "ano EM" e "Série EM" da mesma série', () => {
    expect(normalizeSerie('1º ano EM')).toBe(normalizeSerie('1º Série EM'))
    expect(normalizeSerie('3ª série em')).toBe(normalizeSerie('3º Série EM'))
  })

  it('ignora caixa, acentos, ordinais e espaços extras', () => {
    expect(normalizeSerie('  1º  SÉRIE  EM ')).toBe(normalizeSerie('1º Série EM'))
    expect(normalizeSerie('Berçário I')).toBe(normalizeSerie('bercario i'))
  })

  it('nao conflate séries realmente diferentes', () => {
    expect(normalizeSerie('1º ano EF')).not.toBe(normalizeSerie('1º Série EM'))
    expect(normalizeSerie('1º Série EM')).not.toBe(normalizeSerie('2º Série EM'))
    expect(normalizeSerie('Maternal I')).not.toBe(normalizeSerie('Maternal II'))
  })
})

describe('serieMatches', () => {
  it('casa a série do aluno com a do produto mesmo com nomenclaturas divergentes', () => {
    expect(serieMatches('1º Série EM', '1º ano EM')).toBe(true)
    expect(serieMatches('9º ano EF', '9º ano EF')).toBe(true)
    expect(serieMatches('1º Série EM', '1º ano EF')).toBe(false)
  })
})

describe('produtoDisponivelParaSerie', () => {
  it('produto sem restrição de série fica visível para qualquer aluno', () => {
    expect(produtoDisponivelParaSerie(null, '1º Série EM')).toBe(true)
    expect(produtoDisponivelParaSerie([], '1º Série EM')).toBe(true)
  })

  it('produto segmentado só aparece para a série equivalente', () => {
    const series = ['1º Série EM', '2º Série EM']
    expect(produtoDisponivelParaSerie(series, '1º Série EM')).toBe(true)
    // aluno cadastrado manualmente com a variante antiga continua vendo o evento
    expect(produtoDisponivelParaSerie(series, '1º ano EM')).toBe(true)
    expect(produtoDisponivelParaSerie(series, '3º Série EM')).toBe(false)
    expect(produtoDisponivelParaSerie(series, '9º ano EF')).toBe(false)
  })
})

describe('convencao: formulário de alunos do responsável', () => {
  const src = readFileSync(
    join(process.cwd(), 'app/(loja)/perfil/alunos/AlunosClient.tsx'),
    'utf8',
  )

  it('nao hardcoda séries do EM fora do padrão ActiveSoft', () => {
    expect(src).not.toMatch(/\dº ano EM/)
  })

  it('recebe as séries por prop (fonte: getSeriesDisponiveis no server)', () => {
    expect(src).toMatch(/series:\s*string\[\]/)
  })
})
