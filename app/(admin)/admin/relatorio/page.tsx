import { createAdminClient } from '@/lib/supabase/admin'
import { RelatorioClient } from './RelatorioClient'
import { ComprasClient } from './ComprasClient'
import { RelatorioTabs } from './RelatorioTabs'
import type { Produto } from '@/types/database'
import type { CompraRow } from '@/lib/relatorio/compras'

export default async function RelatorioPage({
  searchParams,
}: {
  searchParams: Promise<{ produto?: string; tab?: string }>
}) {
  const { produto: produtoId, tab: tabParam } = await searchParams
  const tab: 'presenca' | 'compras' = tabParam === 'compras' ? 'compras' : 'presenca'

  // RPCs e listagem via service role: as RPCs de relatório são service-role-only
  // (lockdown 20260710) e o acesso já é guardado pelo layout do grupo (admin).
  const admin = createAdminClient()

  const { data: produtos } = await admin
    .from('produtos')
    .select('*')
    .order('created_at', { ascending: false })

  const todos: Produto[] = (produtos ?? []) as Produto[]
  const lista = tab === 'presenca' ? todos.filter(p => p.gera_ingresso) : todos

  const produtoSelecionado = produtoId
    ? lista.find(p => p.id === produtoId) ?? lista[0] ?? null
    : lista[0] ?? null

  let relatorio: RelatorioRow[] = []
  let compras: CompraRow[] = []
  if (produtoSelecionado) {
    if (tab === 'presenca') {
      const { data } = await admin
        .rpc('get_relatorio_presenca', { p_produto_id: produtoSelecionado.id })
      relatorio = (data ?? []) as RelatorioRow[]
    } else {
      const { data } = await admin
        .rpc('get_relatorio_compras', { p_produto_id: produtoSelecionado.id })
      compras = (data ?? []) as CompraRow[]
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 100 }}>
      <RelatorioTabs tab={tab} />
      {tab === 'presenca' ? (
        <RelatorioClient
          produtos={lista}
          produtoSelecionado={produtoSelecionado}
          relatorio={relatorio}
        />
      ) : (
        <ComprasClient
          produtos={lista}
          produtoSelecionado={produtoSelecionado}
          compras={compras}
        />
      )}
    </div>
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
