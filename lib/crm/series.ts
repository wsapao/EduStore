import { createClient } from '@/lib/supabase/server'
import { activesoft } from '@/lib/activesoft'

export const DEFAULT_SERIES = [
  'Berçário I', 'Berçário II', 'Maternal I', 'Maternal II', 'Jardim I', 'Jardim II',
  '1º ano EF', '2º ano EF', '3º ano EF', '4º ano EF', '5º ano EF',
  '6º ano EF', '7º ano EF', '8º ano EF', '9º ano EF',
  '1º ano EM', '2º ano EM', '3º ano EM',
]

// Timeout duro pra cada fonte externa. Mantém o admin rápido mesmo se SIGA/CRM travarem.
const SOURCE_TIMEOUT_MS = 2000

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]).catch(() => null)
}

// Ordena pedagogicamente: Berçário → Maternal → Jardim → EF (1º..9º) → EM (1º..3º) → resto.
function ordemPedagogica(serie: string): [number, number, string] {
  const s = serie.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  const num = parseInt((s.match(/(\d+)/) || [])[1] || '0', 10)

  if (s.includes('bercario') || s.includes('berçario')) return [0, num, serie]
  if (s.includes('maternal'))                          return [1, num, serie]
  if (s.includes('jardim'))                            return [2, num, serie]
  if (s.includes('medio') || /\bem\b/.test(s))         return [4, num, serie]
  if (s.includes('fundamental') || /\bef\b/.test(s))   return [3, num, serie]
  // "1º ano" sem sufixo: assume EF
  if (/\d+\s*[ºo°]?\s*ano/.test(s))                    return [3, num, serie]
  return [9, num, serie]
}

function ordenar(series: string[]): string[] {
  return Array.from(new Set(series.map(s => s.trim()).filter(Boolean)))
    .sort((a, b) => {
      const [ga, na, ta] = ordemPedagogica(a)
      const [gb, nb, tb] = ordemPedagogica(b)
      if (ga !== gb) return ga - gb
      if (na !== nb) return na - nb
      return ta.localeCompare(tb, 'pt-BR')
    })
}

// Busca séries diretamente das turmas ativas no ActiveSoft (SIGA).
// Esta é a fonte canônica — só aparecem séries que a escola realmente oferece.
async function getSeriesFromActiveSoft(): Promise<string[]> {
  if (!activesoft.isConfigured()) return []
  const turmas = await withTimeout(activesoft.listTurmas(), SOURCE_TIMEOUT_MS)
  if (!turmas) return []
  return Array.from(new Set(turmas.map(t => (t.serie_nome || '').trim()).filter(Boolean)))
}

// Fallback: webhook do EduCRM (caso a integração com SIGA ainda não esteja ligada).
async function getSeriesFromEduCRM(): Promise<string[]> {
  const educrmUrl = process.env.EDUCRM_API_URL
  const educrmKey = process.env.EDUCRM_API_KEY
  if (!educrmUrl || !educrmKey) return []

  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS)
  try {
    const res = await fetch(`${educrmUrl}/api/webhooks/loja/series`, {
      headers: { 'x-webhook-secret': educrmKey },
      signal: controller.signal,
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data.series) ? data.series : []
  } catch {
    return []
  } finally {
    clearTimeout(t)
  }
}

export async function getSeriesDisponiveis(): Promise<string[]> {
  // 1) ActiveSoft — única fonte que reflete EXATAMENTE o que a escola oferece.
  const seriesSiga = await getSeriesFromActiveSoft()
  if (seriesSiga.length > 0) return ordenar(seriesSiga)

  // 2) EduCRM — fallback se SIGA não estiver configurado.
  const seriesCrm = await getSeriesFromEduCRM()
  if (seriesCrm.length > 0) return ordenar(seriesCrm)

  // 3) Fallback local: séries presentes na tabela `alunos` + lista default.
  try {
    const supabase = await createClient()
    const { data } = await supabase.from('alunos').select('serie').eq('ativo', true)
    const seriesLocais = (data?.map(a => a.serie) || []) as string[]
    return ordenar([...DEFAULT_SERIES, ...seriesLocais])
  } catch {
    return ordenar(DEFAULT_SERIES)
  }
}
