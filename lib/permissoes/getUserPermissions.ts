import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Retorna a lista de chaves de permissão concedidas ao usuário autenticado
 * via usuario_papel + papel_permissoes. Retorna [] se o usuário não está
 * autenticado, não tem papel atribuído ou está suspenso.
 */
export async function getUserPermissions(supabase: SupabaseClient): Promise<string[]> {
  const { data: userRes } = await supabase.auth.getUser()
  const user = userRes?.user
  if (!user) return []

  const { data: vinculo } = await supabase
    .from('usuario_papel')
    .select('papel_id, suspenso')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!vinculo || vinculo.suspenso) return []

  const { data: perms } = await supabase
    .from('papel_permissoes')
    .select('chave')
    .eq('papel_id', vinculo.papel_id)

  return (perms ?? []).map((p: { chave: string }) => p.chave)
}
