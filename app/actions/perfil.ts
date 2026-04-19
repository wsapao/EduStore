'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// ── Atualizar nome e telefone ─────────────────────────────────────────────────
export async function atualizarPerfilAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const nome     = (formData.get('nome') as string)?.trim()
  const telefone = (formData.get('telefone') as string)?.trim().replace(/\D/g, '') || null

  if (!nome || nome.length < 3) return { error: 'Nome deve ter pelo menos 3 caracteres.' }

  const { error } = await supabase
    .from('responsaveis')
    .update({ nome, telefone })
    .eq('id', user.id)

  if (error) return { error: 'Erro ao salvar alterações.' }

  revalidatePath('/perfil')
  revalidatePath('/loja')
  return { success: true }
}

// ── Alterar senha ─────────────────────────────────────────────────────────────
export async function alterarSenhaAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const senhaAtual   = formData.get('senha_atual') as string
  const novaSenha    = formData.get('nova_senha') as string
  const confirmaSenha = formData.get('confirma_senha') as string

  if (!senhaAtual || !novaSenha || !confirmaSenha) {
    return { error: 'Preencha todos os campos.' }
  }

  if (novaSenha.length < 8) {
    return { error: 'A nova senha deve ter pelo menos 8 caracteres.' }
  }

  if (novaSenha !== confirmaSenha) {
    return { error: 'As senhas não coincidem.' }
  }

  if (senhaAtual === novaSenha) {
    return { error: 'A nova senha deve ser diferente da atual.' }
  }

  // Verifica senha atual tentando re-autenticar
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: senhaAtual,
  })

  if (signInError) {
    return { error: 'Senha atual incorreta.' }
  }

  // Atualiza a senha
  const { error: updateError } = await supabase.auth.updateUser({
    password: novaSenha,
  })

  if (updateError) {
    return { error: 'Erro ao atualizar senha. Tente novamente.' }
  }

  return { success: true }
}
