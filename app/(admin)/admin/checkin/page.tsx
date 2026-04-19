import { createClient } from '@/lib/supabase/server'
import { CheckinClient } from './CheckinClient'
import type { Produto } from '@/types/database'

interface ProdutoCheckin extends Produto {
  total_emitido: number
  total_usado: number
}

export default async function CheckinPage() {
  const supabase = await createClient()

  // Busca produtos que geram ingresso
  const { data: produtos } = await supabase
    .from('produtos')
    .select('*')
    .eq('gera_ingresso', true)
    .eq('ativo', true)
    .order('data_evento', { ascending: true })

  // Para cada produto, conta emitidos e usados
  const produtosComContagem: ProdutoCheckin[] = await Promise.all(
    (produtos ?? []).map(async (p: Produto) => {
      const { count: emitido } = await supabase
        .from('ingressos')
        .select('*', { count: 'exact', head: true })
        .eq('produto_id', p.id)
        .eq('status', 'emitido')

      const { count: usado } = await supabase
        .from('ingressos')
        .select('*', { count: 'exact', head: true })
        .eq('produto_id', p.id)
        .eq('status', 'usado')

      return { ...p, total_emitido: emitido ?? 0, total_usado: usado ?? 0 }
    })
  )

  return <CheckinClient produtos={produtosComContagem} />
}
