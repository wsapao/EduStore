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
export function normalizeSerie(serie: string): string {
  return serie
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[ºª°]/g, '')
    .replace(/\bserie\b/g, 'ano')
    .replace(/\s+/g, ' ')
    .trim()
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
