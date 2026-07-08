import { redirect } from 'next/navigation'
import { currentPermissions } from '@/lib/permissoes'
import { createAdminClient } from '@/lib/supabase/admin'
import { CONCURSO } from '@/lib/concurso/config'
import { resumoFinanceiro, type InscricaoRow } from '@/lib/concurso/relatorio'
import { ConcursoClient } from './ConcursoClient'

export interface InscricaoListaRow extends InscricaoRow {
  id: string
  aluno_nascimento: string
  instituicao_atual: string
}

export default async function AdminConcursoPage() {
  // Guard server-side: o menu escondido NÃO é controle de acesso.
  const permissoes = await currentPermissions()
  if (!permissoes.includes('concurso.ver')) {
    redirect('/admin')
  }

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('inscricoes_concurso')
    .select('id, numero, aluno_nome, aluno_nascimento, serie_2026, modalidade, instituicao_atual, resp1_nome, resp1_cpf, resp1_email, resp1_telefone, status_pagamento, valor, valor_liquido, created_at, pago_em')
    .eq('escola_id', CONCURSO.escolaId)
    .order('created_at', { ascending: false })
    // tripwire defensivo — volume esperado é de centenas (1 concurso/temporada); revisar se o padrão for reutilizado
    .limit(2000)

  const rows = (data ?? []) as InscricaoListaRow[]
  const resumo = resumoFinanceiro(rows)

  return <ConcursoClient rows={rows} resumo={resumo} />
}
