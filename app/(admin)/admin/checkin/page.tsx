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

  // 1 query para todos os produtos em vez de 2×N queries em loop
  const ids = (produtos ?? []).map(p => p.id)
  const { data: ingressos } = ids.length > 0
    ? await supabase
        .from('ingressos')
        .select('produto_id, status')
        .in('produto_id', ids)
        .in('status', ['emitido', 'usado'])
    : { data: [] }

  const contagemMap: Record<string, { emitido: number; usado: number }> = {}
  for (const ing of ingressos ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pid = (ing as any).produto_id as string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const status = (ing as any).status as string
    if (!contagemMap[pid]) contagemMap[pid] = { emitido: 0, usado: 0 }
    if (status === 'emitido') contagemMap[pid].emitido++
    else if (status === 'usado') contagemMap[pid].usado++
  }

  const produtosComContagem: ProdutoCheckin[] = (produtos ?? []).map((p: Produto) => ({
    ...p,
    total_emitido: contagemMap[p.id]?.emitido ?? 0,
    total_usado: contagemMap[p.id]?.usado ?? 0,
  }))

  return <CheckinClient produtos={produtosComContagem} />
}
