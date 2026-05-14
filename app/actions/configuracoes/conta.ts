'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { auditLog } from '@/lib/auditoria/log'

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

  await auditLog({ modulo: 'conta', acao: 'atualizou_perfil' })

  revalidatePath('/admin/configuracoes/conta')
  return { success: true }
}

// ── MFA ───────────────────────────────────────────────────────────────────────

export async function iniciarMfaAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
  if (error || !data) return { error: 'Não foi possível iniciar o MFA. Tente novamente.' }

  await auditLog({ modulo: 'conta', acao: 'iniciou_mfa' })

  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  }
}

export async function verificarMfaAction(input: { factorId: string; codigo: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { factorId, codigo } = input
  if (!factorId || !codigo || codigo.length !== 6) {
    return { error: 'Código inválido.' }
  }

  const challenge = await supabase.auth.mfa.challenge({ factorId })
  if (challenge.error || !challenge.data) {
    return { error: 'Não foi possível validar o código. Tente novamente.' }
  }

  const verify = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.data.id,
    code: codigo,
  })

  if (verify.error) {
    return { error: 'Código incorreto. Verifique o app autenticador.' }
  }

  await auditLog({ modulo: 'conta', acao: 'ativou_mfa' })

  revalidatePath('/admin/configuracoes/conta')
  return { success: true }
}

export async function desativarMfaAction(input: { factorId: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { error } = await supabase.auth.mfa.unenroll({ factorId: input.factorId })
  if (error) return { error: 'Erro ao desativar MFA.' }

  await auditLog({ modulo: 'conta', acao: 'desativou_mfa' })

  revalidatePath('/admin/configuracoes/conta')
  return { success: true }
}

export async function listarFatoresMfaAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error || !data) return { factors: [] as Array<{ id: string; friendly_name: string | null; status: string }> }

  return {
    factors: (data.totp ?? []).filter(f => f.status === 'verified').map(f => ({
      id: f.id,
      friendly_name: f.friendly_name ?? null,
      status: f.status,
    })),
  }
}

// ── Sessões ───────────────────────────────────────────────────────────────────

export async function encerrarOutrasSessoesAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { error } = await supabase.auth.signOut({ scope: 'others' })
  if (error) return { error: 'Erro ao encerrar sessões.' }

  await auditLog({ modulo: 'conta', acao: 'encerrou_outras_sessoes' })

  return { success: true }
}
