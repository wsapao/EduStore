'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission, PermissionDeniedError } from '@/lib/permissoes'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { auditLog } from '@/lib/auditoria/log'

const METODOS_VALIDOS = new Set(['pix', 'cartao', 'boleto'])

export async function atualizarCantinaAction(formData: FormData) {
  try {
    await requirePermission('configuracoes.editar_identidade')
  } catch (e) {
    if (e instanceof PermissionDeniedError) return { error: 'Sem permissão.' }
    return { error: 'Sem permissão.' }
  }

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const metodos = formData.getAll('cantina_metodos_recarga').map(String)
  if (metodos.length === 0) {
    return { error: 'Selecione pelo menos um método de recarga.' }
  }
  for (const m of metodos) {
    if (!METODOS_VALIDOS.has(m)) {
      return { error: `Método inválido: ${m}.` }
    }
  }

  const recargaMin = Number(formData.get('cantina_recarga_min'))
  if (!Number.isFinite(recargaMin) || recargaMin < 0) {
    return { error: 'Valor mínimo de recarga inválido.' }
  }

  const recargaMax = Number(formData.get('cantina_recarga_max'))
  if (!Number.isFinite(recargaMax) || recargaMax < recargaMin) {
    return { error: 'Valor máximo deve ser ≥ ao valor mínimo.' }
  }

  const exigePin = formData.get('cantina_exige_pin') === 'on'

  const pinTamanhoRaw = formData.get('cantina_pin_tamanho')
  const pinTamanhoParsed = pinTamanhoRaw == null || pinTamanhoRaw === ''
    ? NaN
    : Number(pinTamanhoRaw)

  let pinTamanho: number
  if (exigePin) {
    if (!Number.isFinite(pinTamanhoParsed) || pinTamanhoParsed < 4 || pinTamanhoParsed > 6) {
      return { error: 'Tamanho do PIN deve estar entre 4 e 6 dígitos.' }
    }
    pinTamanho = pinTamanhoParsed
  } else {
    pinTamanho = Number.isFinite(pinTamanhoParsed) && pinTamanhoParsed >= 4 && pinTamanhoParsed <= 6
      ? pinTamanhoParsed
      : 4
  }

  const saldoNegativo = formData.get('cantina_saldo_negativo') === 'on'

  const { error } = await supabase
    .from('escola_configuracoes')
    .update({
      cantina_recarga_min: recargaMin,
      cantina_recarga_max: recargaMax,
      cantina_metodos_recarga: metodos,
      cantina_exige_pin: exigePin,
      cantina_pin_tamanho: pinTamanho,
      cantina_saldo_negativo: saldoNegativo,
    })
    .eq('escola_id', escolaId)

  if (error) return { error: 'Erro ao salvar configurações da cantina.' }

  await auditLog({ modulo: 'cantina', acao: 'atualizou_config' })

  revalidatePath('/admin/configuracoes/cantina')
  return { success: true }
}
