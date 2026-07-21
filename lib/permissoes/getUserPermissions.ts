import type { SupabaseClient } from '@supabase/supabase-js'
import { pickEscolaAtiva, type VinculoAtivo } from '@/lib/escola/pickEscolaAtiva'

/**
 * Retorna a lista de chaves de permissão concedidas ao usuário autenticado
 * via usuario_papel + papel_permissoes, para o papel na UNIDADE ATIVA
 * (multi-unidade: resolvida via pickEscolaAtiva, espelhando loja_escola_ativa()
 * do SQL). Retorna [] se o usuário não está autenticado ou não tem nenhum
 * vínculo não-suspenso.
 */
export async function getUserPermissions(supabase: SupabaseClient): Promise<string[]> {
  const { data: userRes } = await supabase.auth.getUser()
  const user = userRes?.user
  if (!user) return []

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
  if (!ativo) return []

  const { data: perms } = await supabase
    .from('papel_permissoes')
    .select('chave')
    .eq('papel_id', ativo.papelId)

  return (perms ?? []).map((p: { chave: string }) => p.chave)
}
