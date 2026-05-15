import { createClient } from '@/lib/supabase/server'

export const DEFAULT_SERIES = [
  'Berçário I', 'Berçário II', 'Maternal I', 'Maternal II', 'Jardim I', 'Jardim II',
  '1º ano EF', '2º ano EF', '3º ano EF', '4º ano EF', '5º ano EF',
  '6º ano EF', '7º ano EF', '8º ano EF', '9º ano EF',
  '1º ano EM', '2º ano EM', '3º ano EM',
]

// Timeout pra fetch ao CRM externo. Antes desse limite, usamos o fallback local.
// Mantém o admin RÁPIDO mesmo quando o CRM está lento ou indisponível.
const CRM_FETCH_TIMEOUT_MS = 2000

export async function getSeriesDisponiveis(): Promise<string[]> {
  const educrmUrl = process.env.EDUCRM_API_URL
  const educrmKey = process.env.EDUCRM_API_KEY

  let seriesCrm: string[] = []

  // Tenta buscar as séries direto do endpoint do CRM (com timeout duro)
  if (educrmUrl && educrmKey) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), CRM_FETCH_TIMEOUT_MS)

      try {
        const res = await fetch(`${educrmUrl}/api/webhooks/loja/series`, {
          headers: { 'x-webhook-secret': educrmKey },
          signal: controller.signal,
          next: { revalidate: 3600 }, // cache 1h pra evitar refetch a cada navegação
        })

        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data.series) && data.series.length > 0) {
            seriesCrm = data.series
          }
        }
      } finally {
        clearTimeout(timeoutId)
      }
    } catch (err) {
      // Inclui AbortError (timeout) — silencia e cai no fallback
      if ((err as Error)?.name !== 'AbortError') {
        console.error('Erro ao buscar séries do CRM:', err)
      }
    }
  }

  // Se a API não retornou nada (não configurada ou timeout), usa fallback + base local
  if (seriesCrm.length === 0) {
    try {
      const supabase = await createClient()
      const { data: alunosData } = await supabase.from('alunos').select('serie').eq('ativo', true)
      const seriesLocais = Array.from(new Set(alunosData?.map(a => a.serie) || []))
      seriesCrm = Array.from(new Set([...DEFAULT_SERIES, ...seriesLocais]))
    } catch {
      seriesCrm = DEFAULT_SERIES
    }
  }

  return seriesCrm.sort()
}
