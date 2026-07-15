import { createClient } from '@/lib/supabase/server'
import { activesoft } from '@/lib/activesoft'
import { DEFAULT_SERIES, consolidarSeries, ordenarSeries } from '@/lib/crm/series-core'

export { DEFAULT_SERIES, normalizeSerie, serieMatches, produtoDisponivelParaSerie } from '@/lib/crm/series-core'

// Timeout duro pra cada fonte externa. Mantém o admin rápido mesmo se SIGA/CRM travarem.
const SOURCE_TIMEOUT_MS = 2000

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]).catch(() => null)
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
  if (seriesSiga.length > 0) return ordenarSeries(seriesSiga)

  // 2) EduCRM — fallback se SIGA não estiver configurado.
  const seriesCrm = await getSeriesFromEduCRM()
  if (seriesCrm.length > 0) return ordenarSeries(seriesCrm)

  // 3) Fallback local: séries presentes na tabela `alunos` + lista default,
  // consolidadas pra não oferecer grafias equivalentes duplicadas.
  try {
    const supabase = await createClient()
    const { data } = await supabase.from('alunos').select('serie').eq('ativo', true)
    const seriesLocais = (data?.map(a => a.serie) || []) as string[]
    return consolidarSeries(seriesLocais, DEFAULT_SERIES)
  } catch {
    return ordenarSeries(DEFAULT_SERIES)
  }
}
