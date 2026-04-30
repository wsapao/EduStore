import { createClient } from '@/lib/supabase/server'

export const DEFAULT_SERIES = [
  'Berçário I', 'Berçário II', 'Maternal I', 'Maternal II', 'Jardim I', 'Jardim II',
  '1º ano EF', '2º ano EF', '3º ano EF', '4º ano EF', '5º ano EF',
  '6º ano EF', '7º ano EF', '8º ano EF', '9º ano EF',
  '1º ano EM', '2º ano EM', '3º ano EM',
]

export async function getSeriesDisponiveis(): Promise<string[]> {
  const educrmUrl = process.env.EDUCRM_API_URL
  const educrmKey = process.env.EDUCRM_API_KEY

  let seriesCrm: string[] = []

  // Tenta buscar as séries direto do endpoint do CRM
  if (educrmUrl && educrmKey) {
    try {
      const res = await fetch(`${educrmUrl}/api/webhooks/loja/series`, {
        headers: { 'x-webhook-secret': educrmKey },
        next: { revalidate: 3600 } // Faz cache por 1 hora para não deixar o admin lento
      })
      
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.series) && data.series.length > 0) {
          seriesCrm = data.series
        }
      }
    } catch (err) {
      console.error('Erro ao buscar séries do CRM:', err)
    }
  }

  // Se a API não retornou nada ou não está configurada, usa o fallback + o que já tem na base local
  if (seriesCrm.length === 0) {
    try {
      const supabase = await createClient()
      const { data: alunosData } = await supabase.from('alunos').select('serie').eq('ativo', true)
      const seriesLocais = Array.from(new Set(alunosData?.map(a => a.serie) || []))
      
      // Mescla o DEFAULT_SERIES com o que encontrou no banco para garantir que nada falte
      seriesCrm = Array.from(new Set([...DEFAULT_SERIES, ...seriesLocais]))
    } catch (err) {
      seriesCrm = DEFAULT_SERIES
    }
  }

  return seriesCrm.sort()
}
