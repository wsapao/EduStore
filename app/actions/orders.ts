'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getGateway } from '@/lib/pagamentos/gateway'
import { enviarEmailPedido } from '@/lib/email/send'
import { sincronizarPixExpiradoPedido } from '@/lib/pagamentos/pix'
import type { MetodoPagamento } from '@/types/database'
import type { DadosCartao } from '@/lib/pagamentos/types'

export interface CartItemInput {
  produto_id: string
  aluno_id: string
  variante_id?: string | null
  variante?: string | null
  preco_unitario: number
  nome: string
}

export interface CreateOrderInput {
  items: CartItemInput[]
  metodo: MetodoPagamento
  parcelas?: number
  dadosCartao?: DadosCartao
}

export type CreateOrderResult =
  | { success: true; pedido_id: string }
  | { success: false; error: string }

export async function createOrderAction(input: CreateOrderInput): Promise<CreateOrderResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  if (!input.items || input.items.length === 0) {
    return { success: false, error: 'Carrinho vazio.' }
  }

  // Busca responsável
  const { data: responsavel } = await supabase
    .from('responsaveis')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!responsavel) return { success: false, error: 'Responsável não encontrado.' }

  const total = input.items.reduce((sum, i) => sum + i.preco_unitario, 0)
  const itensComVariante = input.items.filter((item) => item.variante_id)

  if (itensComVariante.length > 0) {
    const varianteIds = Array.from(new Set(itensComVariante.map((item) => item.variante_id!).filter(Boolean)))
    const { data: variantes } = await supabase
      .from('produto_variantes')
      .select('id, produto_id, nome, disponivel, estoque')
      .in('id', varianteIds)

    const variantesMap = new Map((variantes ?? []).map((variante) => [variante.id, variante]))

    for (const item of itensComVariante) {
      const variante = item.variante_id ? variantesMap.get(item.variante_id) : null
      if (!variante || variante.produto_id !== item.produto_id) {
        return { success: false, error: 'A variante selecionada não pertence a este produto.' }
      }
      if (!variante.disponivel) {
        return { success: false, error: `O tamanho ${variante.nome} não está disponível.` }
      }
      if (variante.estoque !== null && variante.estoque <= 0) {
        return { success: false, error: `O tamanho ${variante.nome} está sem estoque.` }
      }
    }
  }

  // 1. Cria pedido
  const { data: pedido, error: pedidoErr } = await supabase
    .from('pedidos')
    .insert({
      responsavel_id: user.id,
      escola_id: responsavel.escola_id,
      status: 'pendente',
      metodo_pagamento: input.metodo,
      total,
    })
    .select()
    .single()

  if (pedidoErr || !pedido) {
    return { success: false, error: 'Erro ao criar pedido.' }
  }

  // 2. Cria itens do pedido
  const itens = input.items.map(i => ({
    pedido_id: pedido.id,
    produto_id: i.produto_id,
    aluno_id: i.aluno_id,
    variante_id: i.variante_id ?? null,
    variante: i.variante ?? null,
    preco_unitario: i.preco_unitario,
  }))

  const { error: itensErr } = await supabase.from('itens_pedido').insert(itens)
  if (itensErr) {
    // Rollback: remove pedido
    await supabase.from('pedidos').delete().eq('id', pedido.id)
    return { success: false, error: 'Erro ao salvar itens do pedido.' }
  }

  for (const item of itensComVariante) {
    if (!item.variante_id) continue
    const { data: reservado, error: reservaError } = await supabase
      .rpc('reservar_estoque_variante', { p_variante_id: item.variante_id })

    if (reservaError || !reservado) {
      await supabase.from('itens_pedido').delete().eq('pedido_id', pedido.id)
      await supabase.from('pedidos').delete().eq('id', pedido.id)
      return { success: false, error: `O estoque da variante ${item.variante ?? ''} acabou enquanto você finalizava o pedido.`.trim() }
    }
  }

  // 3. Chama gateway de pagamento
  let resultado
  try {
    resultado = await getGateway().criarPagamento({
      metodo: input.metodo,
      total,
      parcelas: input.parcelas ?? 1,
      dadosCartao: input.dadosCartao,
      responsavel: {
        nome: responsavel.nome,
        email: responsavel.email,
        cpf: responsavel.cpf,
      },
      descricao: `Pedido ${pedido.numero} — ${responsavel.nome}`,
      referencia: pedido.id,
    })
  } catch {
    await restaurarEstoqueVariantes(supabase, input.items)
    return { success: false, error: 'Erro ao processar pagamento. Tente novamente.' }
  }

  // 4. Salva pagamento
  const pagamentoData: Record<string, unknown> = {
    pedido_id: pedido.id,
    metodo: input.metodo,
    gateway_id: resultado.gateway_id,
    total,
    parcelas: input.parcelas ?? 1,
    status: resultado.status,
  }

  if (resultado.metodo === 'pix') {
    pagamentoData.pix_qr_code      = resultado.qr_code
    pagamentoData.pix_qr_code_imagem = resultado.qr_code_imagem
    pagamentoData.pix_tx_id        = resultado.tx_id
    pagamentoData.pix_expiracao    = resultado.expiracao
  } else if (resultado.metodo === 'boleto') {
    pagamentoData.boleto_codigo           = resultado.codigo
    pagamentoData.boleto_linha_digitavel  = resultado.linha_digitavel
    pagamentoData.boleto_vencimento       = resultado.vencimento
    pagamentoData.boleto_url              = resultado.url
  }

  const { error: pagErr } = await supabase.from('pagamentos').insert(pagamentoData)
  if (pagErr) {
    await restaurarEstoqueVariantes(supabase, input.items)
    return { success: false, error: 'Erro ao registrar pagamento.' }
  }

  // 5. Se cartão aprovado, atualiza status do pedido
  if (resultado.metodo === 'cartao' && resultado.status === 'confirmado') {
    await supabase
      .from('pedidos')
      .update({ status: 'pago', data_pagamento: new Date().toISOString() })
      .eq('id', pedido.id)
  }

  // 6. Envia email de confirmação do pedido (em background — não bloqueia)
  void enviarEmailPedido(responsavel.email, {
    responsavelNome: responsavel.nome,
    numeroPedido: pedido.numero,
    total,
    metodoPagamento: input.metodo,
    itens: input.items.map(i => ({
      nome: i.nome,
      aluno: i.variante ? `Tamanho ${i.variante}` : '',
      preco: i.preco_unitario,
    })),
    pedidoUrl: pedido.id,
    pixQrCode: resultado.metodo === 'pix' ? resultado.qr_code : null,
    pixCopiaCola: resultado.metodo === 'pix' ? resultado.qr_code : null,
    pixExpiracao: resultado.metodo === 'pix' ? resultado.expiracao : null,
  })

  return { success: true, pedido_id: pedido.id }
}

async function restaurarEstoqueVariantes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  items: CartItemInput[]
) {
  for (const item of items) {
    if (!item.variante_id) continue
    await supabase.rpc('restaurar_estoque_variante', { p_variante_id: item.variante_id })
  }
}

// ── Renovar PIX expirado ──────────────────────────────────────────────────────
export type RenovarPixResult =
  | { success: true; pix_qr_code: string; pix_qr_code_imagem: string; pix_expiracao: string }
  | { success: false; error: string }

export async function renovarPixAction(pedidoId: string): Promise<RenovarPixResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autenticado.' }

  await sincronizarPixExpiradoPedido(pedidoId, user.id)

  // Valida que o pedido pertence ao usuário e ainda está pendente
  const { data: pedido } = await supabase
    .from('pedidos')
    .select('*, pagamentos(*), responsaveis(nome, email, cpf)')
    .eq('id', pedidoId)
    .eq('responsavel_id', user.id)
    .eq('status', 'pendente')
    .single()

  if (!pedido) return { success: false, error: 'Pedido não encontrado ou já pago.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pag = (Array.isArray(pedido.pagamentos) ? pedido.pagamentos[0] : pedido.pagamentos) as any
  if (!pag || pag.metodo !== 'pix') {
    return { success: false, error: 'Este pedido não possui pagamento via PIX.' }
  }

  // Confirma que o PIX está realmente expirado
  if (pag.pix_expiracao && new Date(pag.pix_expiracao) > new Date()) {
    return { success: false, error: 'O PIX ainda não expirou.' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const responsavel = (pedido as any).responsaveis

  // Gera novo PIX via gateway
  let resultado
  try {
    resultado = await getGateway().criarPagamento({
      metodo: 'pix',
      total: pedido.total,
      parcelas: 1,
      responsavel: {
        nome: responsavel?.nome ?? 'Responsável',
        email: responsavel?.email ?? '',
        cpf: responsavel?.cpf ?? '',
      },
      descricao: `Pedido ${pedido.numero} — renovação PIX`,
      referencia: pedido.id,
    })
  } catch {
    return { success: false, error: 'Erro ao gerar novo PIX. Tente novamente.' }
  }

  if (resultado.metodo !== 'pix') {
    return { success: false, error: 'Resposta inesperada do gateway.' }
  }

  // Atualiza pagamento com novo PIX
  const { error: updateErr } = await supabase
    .from('pagamentos')
    .update({
      gateway_id:        resultado.gateway_id,
      pix_qr_code:       resultado.qr_code,
      pix_qr_code_imagem: resultado.qr_code_imagem,
      pix_tx_id:         resultado.tx_id,
      pix_expiracao:     resultado.expiracao,
      status:            'aguardando',
    })
    .eq('id', pag.id)

  if (updateErr) return { success: false, error: 'Erro ao salvar novo PIX.' }

  await supabase
    .from('pedidos')
    .update({ status: 'pendente' })
    .eq('id', pedido.id)

  return {
    success: true,
    pix_qr_code:        resultado.qr_code,
    pix_qr_code_imagem: resultado.qr_code_imagem,
    pix_expiracao:      resultado.expiracao,
  }
}
