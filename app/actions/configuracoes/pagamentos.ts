'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission, PermissionDeniedError } from '@/lib/permissoes'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { auditLog } from '@/lib/auditoria/log'

const METODOS_VALIDOS = new Set(['pix', 'cartao', 'boleto'])

export async function atualizarPagamentosAction(formData: FormData) {
  try {
    await requirePermission('configuracoes.editar_pagamentos')
  } catch (e) {
    if (e instanceof PermissionDeniedError) return { error: 'Sem permissão.' }
    return { error: 'Sem permissão.' }
  }

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const metodos = formData.getAll('metodos_aceitos_padrao').map(String)
  if (metodos.length === 0) {
    return { error: 'Selecione pelo menos um método de pagamento.' }
  }
  for (const m of metodos) {
    if (!METODOS_VALIDOS.has(m)) {
      return { error: `Método inválido: ${m}.` }
    }
  }

  const maxParcelasRaw = formData.get('max_parcelas_padrao') as string | null
  const maxParcelas = Number(maxParcelasRaw)
  if (!Number.isFinite(maxParcelas) || maxParcelas < 1 || maxParcelas > 12) {
    return { error: 'Máximo de parcelas deve ser entre 1 e 12.' }
  }

  const pixExpRaw = formData.get('pix_expiracao_segundos') as string | null
  const pixExp = Number(pixExpRaw)
  if (!Number.isFinite(pixExp) || pixExp <= 0) {
    return { error: 'Expiração do PIX deve ser maior que zero.' }
  }

  const taxaRepassada = formData.get('taxa_cartao_repassada') === 'on'
  let taxaPercentual: number | null = null
  if (taxaRepassada) {
    const raw = (formData.get('taxa_cartao_percentual') as string | null)?.trim() ?? ''
    if (!raw) return { error: 'Informe o percentual da taxa.' }
    const v = Number(raw.replace(',', '.'))
    if (!Number.isFinite(v) || v < 0 || v > 100) {
      return { error: 'Taxa percentual deve estar entre 0 e 100.' }
    }
    taxaPercentual = v
  }

  const webhookSecret = (formData.get('asaas_webhook_secret') as string | null)?.trim() || null
  const pixChave = (formData.get('pix_chave_recebedora') as string | null)?.trim() || null

  const { data: updated, error } = await supabase
    .from('escola_configuracoes')
    .update({
      metodos_aceitos_padrao: metodos,
      max_parcelas_padrao: maxParcelas,
      pix_expiracao_segundos: pixExp,
      taxa_cartao_repassada: taxaRepassada,
      taxa_cartao_percentual: taxaPercentual,
      asaas_webhook_secret: webhookSecret,
      pix_chave_recebedora: pixChave,
    })
    .eq('escola_id', escolaId)
    .select('escola_id')

  if (error) {
    console.error('[atualizarPagamentosAction] update failed', {
      escolaId, code: error.code, message: error.message, details: error.details, hint: error.hint,
    })
    return { error: 'Erro ao salvar configurações de pagamento.' }
  }
  if (!updated || updated.length === 0) {
    console.error('[atualizarPagamentosAction] update affected zero rows', { escolaId })
    return { error: 'Não foi possível salvar (sem permissão no banco).' }
  }

  await auditLog({ modulo: 'pagamentos', acao: 'atualizou_config' })

  revalidatePath('/admin/configuracoes/pagamentos')
  return { success: true }
}
