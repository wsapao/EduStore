'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getGateway } from '@/lib/pagamentos/gateway'
import { enviarEmailPedido } from '@/lib/email/send'
import { isLojaDisponivelAgora, normalizeLojaFuncionamento } from '@/lib/loja-online/config'
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
  voucher_codigo?: string
  termo_aceito?: boolean
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

  if (responsavel.escola_id) {
    const { data: lojaConfig } = await supabase
      .from('escola_configuracoes')
      .select('modo_manutencao, loja_funcionamento')
      .eq('escola_id', responsavel.escola_id)
      .maybeSingle<{ modo_manutencao: boolean; loja_funcionamento: unknown }>()

    if (lojaConfig?.modo_manutencao) {
      return { success: false, error: 'A loja está temporariamente em manutenção. Tente novamente mais tarde.' }
    }

    const slots = normalizeLojaFuncionamento(lojaConfig?.loja_funcionamento ?? [])
    if (slots.length > 0 && !isLojaDisponivelAgora(slots)) {
      return {
        success: false,
        error: 'A loja está fechada neste horário. Tente novamente durante o período de funcionamento.',
      }
    }
  }

  // Busca preços reais e vouchers do DB (Segurança)
  const productIds = Array.from(new Set(input.items.map(i => i.produto_id)))
  const { data: dbProdutos } = await supabase.from('produtos').select('id, preco, preco_promocional, aceita_vouchers').in('id', productIds)
  const produtosMap = new Map((dbProdutos ?? []).map(p => [p.id, p]))

  // Validação do carrinho vs DB
  let subtotalElegivel = 0
  let totalCalculado = 0
  const safeItems = input.items.map(item => {
    const dbProd = produtosMap.get(item.produto_id)
    if (!dbProd) throw new Error('Produto não encontrado.')
    
    const precoReal = dbProd.preco_promocional ?? dbProd.preco
    totalCalculado += precoReal
    if (dbProd.aceita_vouchers) subtotalElegivel += precoReal

    return { ...item, preco_unitario: precoReal }
  })

  // Lógica do Voucher
  let voucherIdParaSalvar: string | null = null
  let descontoAplicado = 0

  if (input.voucher_codigo) {
    const { data: voucher, error: voucherErr } = await supabase
      .from('vouchers')
      .select('*')
      .eq('codigo', input.voucher_codigo.toUpperCase())
      .eq('escola_id', responsavel.escola_id)
      .single()

    if (voucherErr || !voucher) return { success: false, error: 'Cupom inválido.' }
    if (!voucher.ativo) return { success: false, error: 'Cupom inativo.' }
    if (voucher.data_validade && new Date(voucher.data_validade) < new Date()) return { success: false, error: 'Cupom expirado.' }
    if (voucher.limite_usos !== null && voucher.usos_atuais >= voucher.limite_usos) return { success: false, error: 'Cupom esgotado.' }
    if (voucher.compra_minima !== null && subtotalElegivel < voucher.compra_minima) return { success: false, error: 'O valor elegível não atinge a compra mínima do cupom.' }

    if (voucher.tipo_desconto === 'percentual') {
      descontoAplicado = subtotalElegivel * (voucher.valor / 100)
    } else {
      descontoAplicado = Math.min(voucher.valor, subtotalElegivel)
    }
    voucherIdParaSalvar = voucher.id
  }

  const finalTotal = Math.max(0, totalCalculado - descontoAplicado)
  const itensComVariante = safeItems.filter((item) => item.variante_id)

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
      total: finalTotal,
      voucher_id: voucherIdParaSalvar,
      desconto_aplicado: descontoAplicado > 0 ? descontoAplicado : undefined,
      termo_aceito: input.termo_aceito ?? false,
      termo_aceito_em: input.termo_aceito ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (pedidoErr || !pedido) {
    return { success: false, error: 'Erro ao criar pedido.' }
  }

  // 2. Cria itens do pedido
  const itens = safeItems.map(i => ({
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
    return { success: false, error: 'Erro ao salvar itens do pedido: ' + itensErr.message }
  }

  // Registra uso do voucher de forma atômica (evita race condition em checkout simultâneo)
  if (voucherIdParaSalvar) {
    const { data: incrementado } = await supabase
      .rpc('incrementar_uso_voucher', { p_voucher_id: voucherIdParaSalvar })

    if (!incrementado) {
      // Limite atingido em concorrência — desfaz pedido e estoque já reservado
      await supabase.from('itens_pedido').delete().eq('pedido_id', pedido.id)
      await supabase.from('pedidos').delete().eq('id', pedido.id)
      await restaurarEstoqueVariantes(supabase, input.items)
      return { success: false, error: 'Cupom esgotado. Tente finalizar sem o cupom.' }
    }
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
      total: finalTotal,
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
    total: finalTotal,
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
    total: finalTotal,
    metodoPagamento: input.metodo,
    itens: safeItems.map(i => ({
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

// ── Solicitar Estorno Parcial por Item ────────────────────────────────────────
export async function solicitarEstornoParcialAction(
  pedidoId: string,
  itemIds: string[],
  motivo: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }
  if (!motivo.trim()) return { error: 'Motivo é obrigatório.' }
  if (!itemIds.length) return { error: 'Selecione ao menos um item.' }

  // Verificar que o pedido é do usuário e está pago
  const { data: pedido } = await supabase
    .from('pedidos')
    .select('id, status')
    .eq('id', pedidoId)
    .eq('responsavel_id', user.id)
    .single()

  if (!pedido) return { error: 'Pedido não encontrado.' }
  if (pedido.status !== 'pago') return { error: 'Só é possível solicitar estorno em pedidos pagos.' }

  const adminClient = createAdminClient()

  // Verificar que não há solicitação pendente
  const { data: pendente } = await adminClient
    .from('pedido_estornos')
    .select('id')
    .eq('pedido_id', pedidoId)
    .eq('status', 'pendente')
    .maybeSingle()

  if (pendente) return { error: 'Já existe uma solicitação de estorno pendente para este pedido.' }

  // Verificar que os itens pertencem ao pedido e não foram estornados
  const { data: itens } = await adminClient
    .from('itens_pedido')
    .select('id, preco_unitario, estornado_em')
    .eq('pedido_id', pedidoId)
    .in('id', itemIds)

  if (!itens || itens.length !== itemIds.length)
    return { error: 'Um ou mais itens não pertencem a este pedido.' }

  const itemJaEstornado = itens.find(i => i.estornado_em !== null)
  if (itemJaEstornado) return { error: 'Um ou mais itens já foram estornados.' }

  const valorTotal = itens.reduce((s, i) => s + Number(i.preco_unitario), 0)

  // Criar solicitação
  const { data: estorno, error: errEstorno } = await adminClient
    .from('pedido_estornos')
    .insert({
      pedido_id: pedidoId,
      responsavel_id: user.id,
      motivo: motivo.trim(),
      valor_total: valorTotal,
    })
    .select('id')
    .single()

  if (errEstorno || !estorno) return { error: errEstorno?.message ?? 'Erro ao criar solicitação.' }

  const { error: errItens } = await adminClient
    .from('pedido_estornos_itens')
    .insert(itens.map(i => ({
      estorno_id: estorno.id,
      item_pedido_id: i.id,
      valor_item: Number(i.preco_unitario),
    })))

  if (errItens) {
    await adminClient.from('pedido_estornos').delete().eq('id', estorno.id)
    return { error: errItens.message }
  }

  revalidatePath('/pedidos')
  return { success: true }
}
