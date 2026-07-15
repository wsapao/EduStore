// Helpers puros de série (sem dependência de server/Supabase) — importáveis
// tanto de Server Components quanto de Client Components e testes.

// Fallback local quando nem ActiveSoft nem EduCRM respondem.
// A grafia segue o padrão do ActiveSoft ("Xº Série EM"), que é a fonte
// canônica dos alunos importados e da segmentação de produtos.
export const DEFAULT_SERIES = [
  'Berçário I', 'Berçário II', 'Maternal I', 'Maternal II', 'Jardim I', 'Jardim II',
  '1º ano EF', '2º ano EF', '3º ano EF', '4º ano EF', '5º ano EF',
  '6º ano EF', '7º ano EF', '8º ano EF', '9º ano EF',
  '1º Série EM', '2º Série EM', '3º Série EM',
]

// Forma canônica pra comparação: sem acento/caixa/ordinal, e "série" ≡ "ano"
// (ActiveSoft usa "1º Série EM"; cadastros antigos têm "1º ano EM").
// O sufixo "EF" é redundante — "ano" sem sufixo já significa Fundamental
// ("1º ano EF" ≡ "1º Ano"); "EM" nunca é removido pra não conflar segmentos.
export function normalizeSerie(serie: string): string {
  return serie
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[ºª°]/g, '')
    .replace(/\bserie\b/g, 'ano')
    .replace(/\bef\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Segmento escolar da série — usado pra agrupar as opções no formulário e
// evitar confusão entre homônimos ("2º Ano" do EF vs "2º Série EM").
export function segmentoSerie(serie: string): string {
  const [grupo] = ordemPedagogica(serie)
  if (grupo <= 2) return 'Educação Infantil'
  if (grupo === 3) return 'Ensino Fundamental'
  if (grupo === 4) return 'Ensino Médio'
  return 'Outras'
}

// Une séries reais da base com a lista default sem gerar opções equivalentes
// duplicadas: pra cada série (forma normalizada), vence a grafia local mais
// frequente; defaults só preenchem lacunas. Descarta vazios e "Não informada".
export function consolidarSeries(
  locais: string[],
  defaults: string[] = DEFAULT_SERIES,
): string[] {
  const grupos = new Map<string, Map<string, number>>()
  for (const s of locais) {
    const grafia = s.trim()
    const norm = normalizeSerie(grafia)
    if (!norm || norm === 'nao informada') continue
    const contagens = grupos.get(norm) ?? new Map<string, number>()
    contagens.set(grafia, (contagens.get(grafia) ?? 0) + 1)
    grupos.set(norm, contagens)
  }

  const canonicas: string[] = []
  for (const contagens of grupos.values()) {
    let vencedora = ''
    let max = 0
    for (const [grafia, n] of contagens) {
      if (n > max) { vencedora = grafia; max = n }
    }
    canonicas.push(vencedora)
  }

  for (const d of defaults) {
    if (!grupos.has(normalizeSerie(d))) canonicas.push(d)
  }

  return ordenarSeries(canonicas)
}

export function serieMatches(a: string, b: string): boolean {
  return normalizeSerie(a) === normalizeSerie(b)
}

// Regra de visibilidade da loja: produto sem restrição é público; segmentado
// exige série equivalente (comparação normalizada, não string exata).
export function produtoDisponivelParaSerie(
  series: string[] | null | undefined,
  serieAluno: string,
): boolean {
  if (!series || series.length === 0) return true
  return series.some(s => serieMatches(s, serieAluno))
}

// Ordena pedagogicamente: Berçário → Maternal → Jardim → EF (1º..9º) → EM (1º..3º) → resto.
function ordemPedagogica(serie: string): [number, number, string] {
  const s = normalizeSerie(serie)
  const num = parseInt((s.match(/(\d+)/) || [])[1] || '0', 10)

  if (s.includes('bercario'))                          return [0, num, serie]
  if (s.includes('maternal'))                          return [1, num, serie]
  if (s.includes('jardim'))                            return [2, num, serie]
  if (s.includes('medio') || /\bem\b/.test(s))         return [4, num, serie]
  if (s.includes('fundamental') || /\bef\b/.test(s))   return [3, num, serie]
  // "1º ano" sem sufixo: assume EF
  if (/\d+\s*ano/.test(s))                             return [3, num, serie]
  return [9, num, serie]
}

export function ordenarSeries(series: string[]): string[] {
  return Array.from(new Set(series.map(s => s.trim()).filter(Boolean)))
    .sort((a, b) => {
      const [ga, na, ta] = ordemPedagogica(a)
      const [gb, nb, tb] = ordemPedagogica(b)
      if (ga !== gb) return ga - gb
      if (na !== nb) return na - nb
      return ta.localeCompare(tb, 'pt-BR')
    })
}
