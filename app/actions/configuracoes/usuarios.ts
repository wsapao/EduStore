'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission, PermissionDeniedError } from '@/lib/permissoes'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { auditLog } from '@/lib/auditoria/log'
import { limparCPF, validarCPF } from '@/lib/cpf'

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

type ConvidarResult = { success: true; info?: string } | { error: string }

// O login resolve o e-mail pelo CPF (RPC get_email_by_cpf sobre responsaveis),
// então todo membro de equipe precisa de uma linha em responsaveis com CPF real.
// Três caminhos:
//   1. CPF já cadastrado  -> vincula o papel à conta existente (sem convite);
//   2. CPF e e-mail novos -> inviteUserByEmail com nome+cpf nos metadados
//                            (o trigger handle_new_user cria o responsável);
//   3. e-mail já no Auth  -> completa o CPF do cadastro existente e vincula.
export async function convidarUsuarioAction(formData: FormData): Promise<ConvidarResult> {
  const denied = await ensurePermissao()
  if (denied) return denied

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const nome = (formData.get('nome') as string | null)?.trim() ?? ''
  const email = (formData.get('email') as string | null)?.trim().toLowerCase() ?? ''
  const cpfRaw = (formData.get('cpf') as string | null)?.trim() ?? ''
  const papelId = (formData.get('papel_id') as string | null)?.trim() ?? ''

  if (!nome) return { error: 'Informe o nome de quem será convidado.' }
  if (!email || !EMAIL_RE.test(email)) return { error: 'E-mail inválido.' }
  if (!cpfRaw || !validarCPF(cpfRaw)) return { error: 'CPF inválido. Verifique os números digitados.' }
  if (!papelId) return { error: 'Selecione um papel para o novo usuário.' }

  const cpf = limparCPF(cpfRaw)

  const { data: papel } = await supabase
    .from('papeis')
    .select('id')
    .eq('id', papelId)
    .eq('escola_id', escolaId)
    .maybeSingle()

  if (!papel) return { error: 'Papel inválido para esta escola.' }

  const adminClient = createAdminClient()

  // 1) CPF já possui conta: vincula o papel em vez de criar usuário duplicado.
  const { data: contaPorCpf } = await adminClient
    .from('responsaveis')
    .select('id, email')
    .eq('cpf', cpf)
    .maybeSingle()

  if (contaPorCpf) {
    return vincularContaExistente({ supabase, adminClient, userId: contaPorCpf.id, emailConta: contaPorCpf.email, escolaId, papelId })
  }

  // 2) Convite novo. nome+cpf nos metadados fazem o trigger handle_new_user
  //    criar a linha em responsaveis, habilitando o login por CPF.
  const { data: invited, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/nova-senha`,
    data: { nome, cpf },
  })

  if (inviteErr || !invited?.user) {
    // 3) E-mail já registrado no Auth (ex.: conta provisionada sem CPF).
    if (/already|registered|exist/i.test(inviteErr?.message ?? '')) {
      const { data: contaPorEmail } = await adminClient
        .from('responsaveis')
        .select('id, cpf, email')
        .eq('email', email)
        .maybeSingle()

      if (contaPorEmail) {
        if (contaPorEmail.cpf && contaPorEmail.cpf !== cpf) {
          return { error: 'Este e-mail pertence a uma conta com outro CPF. Confira os dados.' }
        }
        if (!contaPorEmail.cpf) {
          const { error: updErr } = await adminClient
            .from('responsaveis')
            .update({ cpf, nome })
            .eq('id', contaPorEmail.id)
          if (updErr) return { error: 'Falha ao atualizar o CPF da conta existente.' }
        }
        return vincularContaExistente({ supabase, adminClient, userId: contaPorEmail.id, emailConta: email, escolaId, papelId })
      }
      return { error: 'Este e-mail já possui conta no sistema, mas sem cadastro de responsável. Verifique em Responsáveis ou use outro e-mail.' }
    }
    return { error: inviteErr?.message ?? 'Falha ao convidar usuário.' }
  }

  const { error: insertErr } = await supabase
    .from('usuario_papel')
    .insert({ user_id: invited.user.id, escola_id: escolaId, papel_id: papelId })

  if (insertErr) return { error: 'Convite enviado, mas falhou ao vincular o papel.' }

  await auditLog({ modulo: 'usuarios', acao: 'convidou', descricao: email })

  revalidatePath('/admin/configuracoes/usuarios')
  return { success: true }
}

async function vincularContaExistente({ supabase, adminClient, userId, emailConta, escolaId, papelId }: {
  supabase: any
  adminClient: any
  userId: string
  emailConta: string
  escolaId: string
  papelId: string
}): Promise<ConvidarResult> {
  const { data: vinculo } = await adminClient
    .from('usuario_papel')
    .select('user_id')
    .eq('user_id', userId)
    .eq('escola_id', escolaId)
    .maybeSingle()

  if (!vinculo) {
    const { error: insertErr } = await supabase
      .from('usuario_papel')
      .insert({ user_id: userId, escola_id: escolaId, papel_id: papelId })
    if (insertErr) return { error: 'Conta encontrada, mas falhou ao vincular o papel.' }
  }

  await auditLog({ modulo: 'usuarios', acao: 'vinculou_conta_existente', descricao: emailConta })
  revalidatePath('/admin/configuracoes/usuarios')

  return {
    success: true,
    info: vinculo
      ? `Esta pessoa já tem conta (${emailConta}) e já fazia parte da equipe. Cadastro atualizado.`
      : `Conta existente (${emailConta}) vinculada ao papel. A pessoa entra com a senha que já usa nessa conta.`,
  }
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

  const { data: rows, error: updErr } = await supabase
    .from('usuario_papel')
    .update({ papel_id: novoPapelId })
    .eq('user_id', targetUserId)
    .eq('escola_id', escolaId)
    .select('user_id')

  if (updErr) {
    console.error('[alterarPapelAction] update failed', { targetUserId, novoPapelId, message: updErr.message })
    return { error: 'Erro ao alterar papel.' }
  }
  if (!rows || rows.length === 0) {
    console.error('[alterarPapelAction] papel não atualizado (zero rows)', { targetUserId, escolaId })
    return { error: 'Vínculo não encontrado ou sem permissão.' }
  }

  await auditLog({
    modulo: 'usuarios',
    acao: 'alterou_papel',
    metadata: { targetUserId, novoPapelId },
  })

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

  const { data: rows, error: updErr } = await supabase
    .from('usuario_papel')
    .update(payload)
    .eq('user_id', targetUserId)
    .eq('escola_id', escolaId)
    .select('user_id')

  if (updErr) {
    console.error('[toggleSuspensaoUsuarioAction] update failed', { targetUserId, suspender, message: updErr.message })
    return { error: 'Erro ao alterar suspensão.' }
  }
  if (!rows || rows.length === 0) {
    console.error('[toggleSuspensaoUsuarioAction] vínculo não atualizado (zero rows)', { targetUserId, escolaId })
    return { error: 'Vínculo não encontrado ou sem permissão.' }
  }

  await auditLog({
    modulo: 'usuarios',
    acao: suspender ? 'suspendeu' : 'reativou',
    descricao: targetUserId,
  })

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

  const { data: rows, error: delErr } = await supabase
    .from('usuario_papel')
    .delete()
    .eq('user_id', targetUserId)
    .eq('escola_id', escolaId)
    .select('user_id')

  if (delErr) {
    console.error('[removerUsuarioAction] delete failed', { targetUserId, message: delErr.message })
    return { error: 'Erro ao remover usuário.' }
  }
  if (!rows || rows.length === 0) {
    console.error('[removerUsuarioAction] vínculo não removido (zero rows)', { targetUserId, escolaId })
    return { error: 'Vínculo não encontrado ou sem permissão.' }
  }

  await auditLog({ modulo: 'usuarios', acao: 'removeu', descricao: targetUserId })

  revalidatePath('/admin/configuracoes/usuarios')
  return { success: true }
}
