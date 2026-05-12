import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Resolve a escola_id do usuário autenticado para contexto admin.
 * Tenta usuario_papel primeiro (staff/admins); se não houver vínculo,
 * tenta responsaveis (legado/compatibilidade). Retorna null se nada bater.
 */
export async function getEscolaIdParaAdmin(supabase: SupabaseClient): Promise<string | null> {
  const { data: userRes } = await supabase.auth.getUser()
  const user = userRes?.user
  if (!user) return null

  const { data: vinculo } = await supabase
    .from('usuario_papel')
    .select('escola_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (vinculo?.escola_id) return vinculo.escola_id as string

  const { data: resp } = await supabase
    .from('responsaveis')
    .select('escola_id')
    .eq('id', user.id)
    .maybeSingle()

  return (resp?.escola_id as string | undefined) ?? null
}
