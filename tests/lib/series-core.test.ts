import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  DEFAULT_SERIES,
  consolidarSeries,
  normalizeSerie,
  produtoDisponivelParaSerie,
  segmentoSerie,
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

  it('iguala "Xº ano EF" ao padrão da escola "Xº Ano" (bare ano = EF)', () => {
    expect(normalizeSerie('1º ano EF')).toBe(normalizeSerie('1º Ano'))
    expect(normalizeSerie('6º ano EF')).toBe(normalizeSerie('6º Ano'))
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

describe('segmentoSerie', () => {
  it('classifica Educação Infantil', () => {
    expect(segmentoSerie('Berçário I')).toBe('Educação Infantil')
    expect(segmentoSerie('Maternal II')).toBe('Educação Infantil')
    expect(segmentoSerie('Jardim I')).toBe('Educação Infantil')
  })

  it('classifica Ensino Fundamental (com e sem sufixo EF)', () => {
    expect(segmentoSerie('2º Ano')).toBe('Ensino Fundamental')
    expect(segmentoSerie('9º ano EF')).toBe('Ensino Fundamental')
  })

  it('classifica Ensino Médio nas duas grafias', () => {
    expect(segmentoSerie('2º Série EM')).toBe('Ensino Médio')
    expect(segmentoSerie('3º ano EM')).toBe('Ensino Médio')
  })

  it('série irreconhecível cai em Outras', () => {
    expect(segmentoSerie('Não informada')).toBe('Outras')
  })
})

describe('consolidarSeries', () => {
  it('prefere a grafia local mais frequente à do fallback default', () => {
    const locais = ['1º Ano', '1º Ano', '1º Ano', '1º ano EF']
    const out = consolidarSeries(locais, ['1º ano EF'])
    expect(out).toContain('1º Ano')
    expect(out).not.toContain('1º ano EF')
  })

  it('funde variantes equivalentes numa única opção', () => {
    const out = consolidarSeries(
      ['3º Série EM', '3º Série EM', '3º ano EM'],
      [],
    )
    expect(out).toEqual(['3º Série EM'])
  })

  it('descarta séries vazias e "Não informada"', () => {
    const out = consolidarSeries(['Não informada', '  ', '6º Ano'], [])
    expect(out).toEqual(['6º Ano'])
  })

  it('completa lacunas com os defaults sem duplicar séries equivalentes', () => {
    const out = consolidarSeries(['6º Ano'], DEFAULT_SERIES)
    expect(out).toContain('6º Ano')
    expect(out).not.toContain('6º ano EF')
    expect(out).toContain('Jardim I')
    // nenhum par de opções pode ser equivalente após consolidar
    const normalizadas = out.map(normalizeSerie)
    expect(new Set(normalizadas).size).toBe(normalizadas.length)
  })

  it('sem séries locais, devolve os defaults em ordem pedagógica', () => {
    expect(consolidarSeries([], DEFAULT_SERIES)).toEqual(DEFAULT_SERIES)
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

  it('usa a lista de seleção única (SerieChecklist) no lugar do select de série', () => {
    expect(src).toMatch(/SerieChecklist/)
    expect(src).not.toMatch(/serieOptions\.map/)
  })
})

describe('convencao: SerieChecklist', () => {
  const src = readFileSync(
    join(process.cwd(), 'components/loja/SerieChecklist.tsx'),
    'utf8',
  )

  it('agrupa as opções por segmento escolar', () => {
    expect(src).toMatch(/segmentoSerie/)
  })

  it('tem semântica de seleção única (radiogroup + aria-checked)', () => {
    expect(src).toMatch(/role="radiogroup"/)
    expect(src).toMatch(/role="radio"/)
    expect(src).toMatch(/aria-checked/)
  })
})

describe('convencao: getSeriesDisponiveis', () => {
  const src = readFileSync(join(process.cwd(), 'lib/crm/series.ts'), 'utf8')

  it('consolida o fallback local (defaults + séries da base) sem duplicatas', () => {
    expect(src).toMatch(/consolidarSeries/)
  })
})
