import { createClient } from '@/lib/supabase/server'
import { RelatorioClient } from './RelatorioClient'
import type { Produto } from '@/types/database'

export default async function RelatorioPage({
  searchParams,
}: {
  searchParams: Promise<{ produto?: string }>
}) {
  const { produto: produtoId } = await searchParams
  const supabase = await createClient()

  // Produtos com ingresso
  const { data: produtos } = await supabase
    .from('produtos')
    .select('*')
    .eq('gera_ingresso', true)
    .order('data_evento', { ascending: false })

  const lista: Produto[] = produtos ?? []
  const produtoSelecionado = produtoId
    ? lista.find(p => p.id === produtoId) ?? lista[0] ?? null
    : lista[0] ?? null

  // Relatório do produto selecionado
  let relatorio: RelatorioRow[] = []
  if (produtoSelecionado) {
    const { data } = await supabase
      .rpc('get_relatorio_presenca', { p_produto_id: produtoSelecionado.id })
    relatorio = (data ?? []) as RelatorioRow[]
  }

  return (
    <RelatorioClient
      produtos={lista}
      produtoSelecionado={produtoSelecionado}
      relatorio={relatorio}
    />
  )
}

export interface RelatorioRow {
  ingresso_id: string
  token: string
  status: string
  aluno_nome: string
  aluno_serie: string
  aluno_turma: string | null
  responsavel_nome: string
  responsavel_email: string
  usado_em: string | null
  validado_por: string | null
  created_at: string
}
