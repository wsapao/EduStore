'use server'

import { createClient } from '@/lib/supabase/server'
import type { Voucher } from '@/types/database'

export async function validarVoucherAction(codigo: string, subtotalElegivel: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Usuário não autenticado.' }

  const { data: responsavel } = await supabase.from('responsaveis').select('escola_id').eq('id', user.id).single()
  if (!responsavel) return { success: false, error: 'Responsável não encontrado.' }

  // Busca o voucher
  const { data: voucher, error } = await supabase
    .from('vouchers')
    .select('*')
    .eq('codigo', codigo.trim().toUpperCase())
    .eq('escola_id', responsavel.escola_id)
    .single()

  if (error || !voucher) {
    return { success: false, error: 'Cupom inválido ou não encontrado.' }
  }

  // Validações
  if (!voucher.ativo) {
    return { success: false, error: 'Este cupom não está mais ativo.' }
  }

  if (voucher.data_validade && new Date(voucher.data_validade) < new Date()) {
    return { success: false, error: 'Este cupom já expirou.' }
  }

  if (voucher.limite_usos !== null && voucher.usos_atuais >= voucher.limite_usos) {
    return { success: false, error: 'Este cupom esgotou o limite de usos.' }
  }

  if (voucher.compra_minima !== null && subtotalElegivel < voucher.compra_minima) {
    return { success: false, error: `Este cupom exige uma compra mínima de elegíveis de R$ ${voucher.compra_minima.toFixed(2)}.` }
  }

  // Calcula desconto
  let valorDesconto = 0
  if (voucher.tipo_desconto === 'percentual') {
    valorDesconto = subtotalElegivel * (voucher.valor / 100)
  } else {
    // Desconto fixo. Se for maior que o subtotal elegível, o desconto será apenas o valor do subtotal elegível
    valorDesconto = Math.min(voucher.valor, subtotalElegivel)
  }

  return {
    success: true,
    voucher: voucher as Voucher,
    valorDesconto,
  }
}
