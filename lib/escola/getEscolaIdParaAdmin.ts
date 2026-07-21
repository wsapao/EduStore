import type { SupabaseClient } from '@supabase/supabase-js'
import { pickEscolaAtiva, type VinculoAtivo } from './pickEscolaAtiva'

/**
 * Resolve a escola_id do usuário autenticado para contexto admin.
 * Tenta usuario_papel primeiro (staff/admins) — quando há múltiplos vínculos
 * (multi-unidade), resolve a UNIDADE ATIVA via pickEscolaAtiva, espelhando
 * loja_escola_ativa() do SQL. Se não houver nenhum vínculo, cai pra
 * responsaveis (legado/compatibilidade). Retorna null se nada bater.
 */
export async function getEscolaIdParaAdmin(supabase: SupabaseClient): Promise<string | null> {
  const { data: userRes } = await supabase.auth.getUser()
  const user = userRes?.user
  if (!user) return null

  const { data: vinculos } = await supabase
    .from('usuario_papel')
    .select('id, escola_id, papel_id, created_at')
    .eq('user_id', user.id)
    .eq('suspenso', false)

  const { data: selecao } = await supabase
    .from('saas_unidade_ativa')
    .select('escola_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const vinculosAtivos: VinculoAtivo[] = (vinculos ?? []).map((v: { id: string; escola_id: string; papel_id: string; created_at: string }) => ({
    escolaId: v.escola_id,
    papelId: v.papel_id,
    createdAt: v.created_at,
    vinculoId: v.id,
  }))

  const ativo = pickEscolaAtiva(vinculosAtivos, selecao?.escola_id ?? null)
  if (ativo) return ativo.escolaId

  const { data: resp } = await supabase
    .from('responsaveis')
    .select('escola_id')
    .eq('id', user.id)
    .maybeSingle()

  return (resp?.escola_id as string | undefined) ?? null
}
