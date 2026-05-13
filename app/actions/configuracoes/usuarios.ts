'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission, PermissionDeniedError } from '@/lib/permissoes'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'

const PERM_GUARD = 'configuracoes.gerenciar_usuarios'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function ensurePermissao(): Promise<{ error: string } | null> {
  try {
    await requirePermission(PERM_GUARD)
    return null
  } catch (e) {
    if (e instanceof PermissionDeniedError) return { error: 'Sem permissão.' }
    return { error: 'Sem permissão.' }
  }
}

async function contarOutrosAdminsAtivos(supabase: any, escolaId: string, exceptUserId: string): Promise<number> {
  const { data: papelAdmin } = await supabase
    .from('papeis')
    .select('id')
    .eq('escola_id', escolaId)
    .eq('chave_preset', 'admin')
    .maybeSingle()

  if (!papelAdmin) return 0

  const { count } = await supabase
    .from('usuario_papel')
    .select('id', { count: 'exact', head: true })
    .eq('escola_id', escolaId)
    .eq('papel_id', papelAdmin.id)
    .eq('suspenso', false)

  // count inclui o próprio usuário; subtraímos se ele estiver na contagem
  return Math.max(0, (count ?? 0) - 1)
}

// ── CONVIDAR ──────────────────────────────────────────────────────────────────

export async function convidarUsuarioAction(formData: FormData) {
  const denied = await ensurePermissao()
  if (denied) return denied

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const email = (formData.get('email') as string | null)?.trim().toLowerCase() ?? ''
  const papelId = (formData.get('papel_id') as string | null)?.trim() ?? ''

  if (!email || !EMAIL_RE.test(email)) return { error: 'E-mail inválido.' }
  if (!papelId) return { error: 'Selecione um papel para o novo usuário.' }

  const { data: papel } = await supabase
    .from('papeis')
    .select('id')
    .eq('id', papelId)
    .eq('escola_id', escolaId)
    .maybeSingle()

  if (!papel) return { error: 'Papel inválido para esta escola.' }

  const adminClient = createAdminClient()
  const { data: invited, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/nova-senha`,
  })

  if (inviteErr || !invited?.user) {
    return { error: inviteErr?.message ?? 'Falha ao convidar usuário.' }
  }

  const { error: insertErr } = await supabase
    .from('usuario_papel')
    .insert({ user_id: invited.user.id, escola_id: escolaId, papel_id: papelId })

  if (insertErr) return { error: 'Convite enviado, mas falhou ao vincular o papel.' }

  revalidatePath('/admin/configuracoes/usuarios')
  return { success: true }
}

// ── ALTERAR PAPEL ─────────────────────────────────────────────────────────────

export async function alterarPapelUsuarioAction(targetUserId: string, novoPapelId: string) {
  const denied = await ensurePermissao()
  if (denied) return denied

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }
  if (user.id === targetUserId) return { error: 'Você não pode alterar o próprio papel.' }

  const { data: alvo } = await supabase
    .from('usuario_papel')
    .select('user_id, papel:papeis(chave_preset)')
    .eq('user_id', targetUserId)
    .eq('escola_id', escolaId)
    .maybeSingle()

  if (!alvo) return { error: 'Usuário não encontrado nesta escola.' }

  const { data: papelNovo } = await supabase
    .from('papeis')
    .select('id, chave_preset, escola_id')
    .eq('id', novoPapelId)
    .eq('escola_id', escolaId)
    .maybeSingle()

  if (!papelNovo) return { error: 'Papel inválido para esta escola.' }

  const eraAdmin = (alvo.papel as any)?.chave_preset === 'admin'
  const continuaAdmin = papelNovo.chave_preset === 'admin'
  if (eraAdmin && !continuaAdmin) {
    const restantes = await contarOutrosAdminsAtivos(supabase, escolaId, targetUserId)
    if (restantes === 0) {
      return { error: 'Não é possível rebaixar o último admin da escola.' }
    }
  }

  const { error: updErr } = await supabase
    .from('usuario_papel')
    .update({ papel_id: novoPapelId })
    .eq('user_id', targetUserId)
    .eq('escola_id', escolaId)

  if (updErr) return { error: 'Erro ao alterar papel.' }

  revalidatePath('/admin/configuracoes/usuarios')
  return { success: true }
}

// ── TOGGLE SUSPENSÃO ──────────────────────────────────────────────────────────

export async function toggleSuspensaoUsuarioAction(targetUserId: string, suspender: boolean) {
  const denied = await ensurePermissao()
  if (denied) return denied

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }
  if (user.id === targetUserId) return { error: 'Você não pode suspender o próprio acesso.' }

  const { data: alvo } = await supabase
    .from('usuario_papel')
    .select('user_id, suspenso, papel:papeis(chave_preset)')
    .eq('user_id', targetUserId)
    .eq('escola_id', escolaId)
    .maybeSingle()

  if (!alvo) return { error: 'Usuário não encontrado nesta escola.' }

  if (suspender && (alvo.papel as any)?.chave_preset === 'admin') {
    const restantes = await contarOutrosAdminsAtivos(supabase, escolaId, targetUserId)
    if (restantes === 0) {
      return { error: 'Não é possível suspender o último admin ativo da escola.' }
    }
  }

  const payload = suspender
    ? { suspenso: true, suspenso_em: new Date().toISOString(), suspenso_por: user.id }
    : { suspenso: false, suspenso_em: null, suspenso_por: null }

  const { error: updErr } = await supabase
    .from('usuario_papel')
    .update(payload)
    .eq('user_id', targetUserId)
    .eq('escola_id', escolaId)

  if (updErr) return { error: 'Erro ao alterar suspensão.' }

  revalidatePath('/admin/configuracoes/usuarios')
  return { success: true }
}

// ── REMOVER ───────────────────────────────────────────────────────────────────

export async function removerUsuarioAction(targetUserId: string) {
  const denied = await ensurePermissao()
  if (denied) return denied

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }
  if (user.id === targetUserId) return { error: 'Você não pode remover o próprio acesso.' }

  const { data: alvo } = await supabase
    .from('usuario_papel')
    .select('user_id, papel:papeis(chave_preset)')
    .eq('user_id', targetUserId)
    .eq('escola_id', escolaId)
    .maybeSingle()

  if (!alvo) return { error: 'Usuário não encontrado nesta escola.' }

  if ((alvo.papel as any)?.chave_preset === 'admin') {
    const restantes = await contarOutrosAdminsAtivos(supabase, escolaId, targetUserId)
    if (restantes === 0) {
      return { error: 'Não é possível remover o último admin da escola.' }
    }
  }

  const { error: delErr } = await supabase
    .from('usuario_papel')
    .delete()
    .eq('user_id', targetUserId)
    .eq('escola_id', escolaId)

  if (delErr) return { error: 'Erro ao remover usuário.' }

  revalidatePath('/admin/configuracoes/usuarios')
  return { success: true }
}
