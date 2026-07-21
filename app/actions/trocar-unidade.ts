'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * Troca a unidade ativa do staff autenticado (public.saas_unidade_ativa).
 * A RLS (`saas_unidade_ativa_self` com check) garante que só é possível
 * selecionar uma escola em que o usuário tenha vínculo não-suspenso em
 * usuario_papel — defesa em profundidade além desta action.
 */
export async function trocarUnidade(escolaId: string): Promise<{ ok: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false }

  const { error } = await supabase
    .from('saas_unidade_ativa')
    .upsert({ user_id: user.id, escola_id: escolaId, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })

  if (error) return { ok: false }

  revalidatePath('/', 'layout') // recarrega o admin com a nova unidade ativa
  return { ok: true }
}
