'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission, PermissionDeniedError } from '@/lib/permissoes'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'

export async function atualizarCheckoutAction(formData: FormData) {
  try {
    await requirePermission('configuracoes.editar_identidade')
  } catch (e) {
    if (e instanceof PermissionDeniedError) return { error: 'Sem permissão.' }
    return { error: 'Sem permissão.' }
  }

  const expRaw = formData.get('carrinho_expiracao_minutos') as string | null
  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp <= 0) {
    return { error: 'Tempo de expiração do carrinho deve ser maior que zero.' }
  }

  const termo = (formData.get('termo_padrao_compra') as string | null)?.trim() || null
  if (termo && termo.length > 5000) {
    return { error: 'Termo padrão de compra deve ter no máximo 5000 caracteres.' }
  }

  const msg = (formData.get('mensagem_pos_compra') as string | null)?.trim() || null
  if (msg && msg.length > 1000) {
    return { error: 'Mensagem pós-compra deve ter no máximo 1000 caracteres.' }
  }

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const { error } = await supabase
    .from('escola_configuracoes')
    .update({
      termo_padrao_compra: termo,
      permite_multiplos_alunos: formData.get('permite_multiplos_alunos') === 'on',
      mensagem_pos_compra: msg,
      carrinho_expiracao_minutos: exp,
      exige_cpf_responsavel: formData.get('exige_cpf_responsavel') === 'on',
    })
    .eq('escola_id', escolaId)

  if (error) return { error: 'Erro ao salvar configurações de checkout.' }

  revalidatePath('/admin/configuracoes/checkout')
  return { success: true }
}
