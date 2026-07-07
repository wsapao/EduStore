'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserPermissions } from '@/lib/permissoes/getUserPermissions'
import { auditLog } from '@/lib/auditoria/log'
import { enviarEmailAvisoTrocaEmail } from '@/lib/email/send'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { EMAIL_RE } from '@/lib/validacao/email'

type ActionResult = { success: boolean; error?: string }

export async function editarResponsavelAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Acesso negado.' }

  const isAdmin = user.app_metadata?.role === 'admin'
  const perms = await getUserPermissions(supabase)
  if (!isAdmin && !perms.includes('responsaveis.editar')) {
    return { success: false, error: 'Acesso negado.' }
  }

  const responsavelId = (formData.get('responsavel_id') as string | null)?.trim()
  const nome = (formData.get('nome') as string | null)?.trim()
  const emailRaw = (formData.get('email') as string | null)?.trim().toLowerCase()
  const telefoneRaw = (formData.get('telefone') as string | null)?.trim()
  const telefone = telefoneRaw ? telefoneRaw : null

  if (!responsavelId) return { success: false, error: 'Responsável não informado.' }
  if (!nome) return { success: false, error: 'Nome é obrigatório.' }
  if (!emailRaw || !EMAIL_RE.test(emailRaw)) return { success: false, error: 'E-mail inválido.' }
  const email = emailRaw

  // escola do admin (isolamento multi-tenant)
  const escolaIdAdmin = await getEscolaIdParaAdmin(supabase)
  if (!escolaIdAdmin) return { success: false, error: 'Admin sem escola vinculada.' }

  const admin = createAdminClient()

  const { data: alvo } = await admin
    .from('responsaveis')
    .select('id, nome, email, telefone, escola_id, excluido_em')
    .eq('id', responsavelId)
    .single()

  if (!alvo) return { success: false, error: 'Responsável não encontrado.' }
  if (alvo.escola_id !== escolaIdAdmin) return { success: false, error: 'Acesso negado.' }
  if (alvo.excluido_em) return { success: false, error: 'Não é possível editar uma conta removida.' }

  const emailAntigo = (alvo.email ?? '').toLowerCase()
  const emailMudou = email !== emailAntigo

  if (emailMudou) {
    const { data: dup } = await admin
      .from('responsaveis')
      .select('id')
      .eq('email', email)
      .neq('id', responsavelId)
      .maybeSingle()
    if (dup) return { success: false, error: 'Já existe um responsável com esse e-mail.' }
  }

  const { data: updRows, error: updErr } = await admin
    .from('responsaveis')
    .update({ nome, email, telefone })
    .eq('id', responsavelId)
    .select('id')
  if (updErr) return { success: false, error: 'Falha ao atualizar os dados.' }
  if (!updRows || updRows.length === 0) {
    return { success: false, error: 'Responsável não encontrado ou não pôde ser atualizado.' }
  }

  if (emailMudou) {
    const { error: authErr } = await admin.auth.admin.updateUserById(responsavelId, {
      email,
      email_confirm: true,
    })
    if (authErr) {
      // rollback do update na tabela para nunca divergir de auth.users
      const { error: rollbackErr } = await admin
        .from('responsaveis')
        .update({ nome: alvo.nome, email: alvo.email, telefone: alvo.telefone })
        .eq('id', responsavelId)
      if (rollbackErr) {
        console.error(
          '[editarResponsavelAction] ROLLBACK FALHOU — responsaveis e auth.users divergentes',
          { responsavelId, rollbackErr: rollbackErr.message, authErr: authErr.message },
        )
      }
      return {
        success: false,
        error: 'Não foi possível atualizar o e-mail de login. Tente outro e-mail.',
      }
    }
  }

  await auditLog({
    modulo: 'responsaveis',
    acao: 'editar',
    descricao: `Editou o responsável ${nome}`,
    metadata: {
      responsavel_id: responsavelId,
      de: { nome: alvo.nome, email: alvo.email, telefone: alvo.telefone },
      para: { nome, email, telefone },
    },
  })

  if (emailMudou) {
    await enviarEmailAvisoTrocaEmail(emailAntigo, {
      responsavelNome: nome,
      emailAntigo,
      emailNovo: email,
    })
    await enviarEmailAvisoTrocaEmail(email, {
      responsavelNome: nome,
      emailAntigo,
      emailNovo: email,
    })
  }

  revalidatePath('/admin/responsaveis')
  return { success: true }
}
