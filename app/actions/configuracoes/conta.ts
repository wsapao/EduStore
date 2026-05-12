'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function atualizarPerfilContaAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const nome = (formData.get('nome') as string)?.trim()
  if (!nome || nome.length < 3) {
    return { error: 'Nome deve ter pelo menos 3 caracteres.' }
  }

  const { error } = await supabase.auth.updateUser({ data: { nome } })
  if (error) return { error: 'Erro ao atualizar perfil. Tente novamente.' }

  revalidatePath('/admin/configuracoes/conta')
  return { success: true }
}
