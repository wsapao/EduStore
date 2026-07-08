'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getGateway } from '@/lib/pagamentos/gateway'
import { arredondarCentavos } from '@/lib/pagamentos/money'
import { produtoDisponivelParaSerie } from '@/lib/crm/series-core'
import { enviarEmailCheckout } from '@/lib/email/checkout'
import { isLojaDisponivelAgora, normalizeLojaFuncionamento } from '@/lib/loja-online/config'
import { sincronizarPixExpiradoPedido } from '@/lib/pagamentos/pix'
import { auditLog } from '@/lib/auditoria/log'
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
  /**
   * Total (dos produtos, antes de desconto de cupom) exibido ao cliente no
   * momento do checkout. Usado apenas para detectar divergência de preço com o
   * valor recalculado no servidor — não é usado para cobrar.
   */
  total_exibido?: number
}

export type CreateOrderResult =
  | { success: true; pedido_id: string }
  | { success: false; error: string }
  | { success: false; error: string; precoAtualizado: true; totalReal: number }

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

  // Valida que todos os alunos do carrinho pertencem a este responsável
  const alunoIds = Array.from(new Set(input.items.map(i => i.aluno_id).filter(Boolean)))
  // Série de cada aluno (para validar restrição de série do produto no servidor).
  const alunoSerieMap = new Map<string, string>()
  if (alunoIds.length > 0) {
    const { data: vinculos } = await supabase
      .from('responsavel_aluno')
      .select('aluno_id, aluno:alunos(serie)')
      .eq('responsavel_id', user.id)
      .in('aluno_id', alunoIds)
    const permitidos = new Set((vinculos ?? []).map(v => v.aluno_id))
    if (alunoIds.some(id => !permitidos.has(id))) {
      return { success: false, error: 'Um ou mais alunos selecionados não pertencem a você.' }
    }
    for (const v of vinculos ?? []) {
      // A relação to-one pode vir como objeto ou array conforme a inferência do supabase-js.
      const rel = (v as { aluno?: { serie?: string | null } | { serie?: string | null }[] }).aluno
      const alunoObj = Array.isArray(rel) ? rel[0] : rel
      alunoSerieMap.set(v.aluno_id, alunoObj?.serie ?? '')
    }
  }

  // Busca preços reais e vouchers do DB (Segurança). Inclui os campos de
  // disponibilidade para validar item stale (aba antiga/carrinho antigo).
  const productIds = Array.from(new Set(input.items.map(i => i.produto_id)))
  const { data: dbProdutos } = await supabase
    .from('produtos')
    .select('id, nome, preco, preco_promocional, aceita_vouchers, imagem_url, gera_ingresso, ativo, esgotado, prazo_compra, estoque, series')
    .in('id', productIds)
  const produtosMap = new Map((dbProdutos ?? []).map(p => [p.id, p]))

  const agora = Date.now()

  // Validação do carrinho vs DB. Retorna erro amigável (não lança exceção) para
  // que o cliente saiba exatamente qual item remover.
  let subtotalElegivel = 0
  let totalCalculado = 0
  const safeItems: (CartItemInput & { preco_unitario: number })[] = []
  for (const item of input.items) {
    const dbProd = produtosMap.get(item.produto_id)
    if (!dbProd) {
      return { success: false, error: `O produto "${item.nome ?? 'selecionado'}" não está mais disponível. Remova-o do carrinho e tente novamente.` }
    }
    if (dbProd.ativo === false) {
      return { success: false, error: `O produto "${dbProd.nome}" não está mais à venda. Remova-o do carrinho para continuar.` }
    }
    if (dbProd.esgotado === true) {
      return { success: false, error: `O produto "${dbProd.nome}" está esgotado. Remova-o do carrinho para continuar.` }
    }
    if (dbProd.prazo_compra && new Date(dbProd.prazo_compra).getTime() < agora) {
      return { success: false, error: `O prazo de compra do produto "${dbProd.nome}" já encerrou. Remova-o do carrinho para continuar.` }
    }
    // Estoque a nível de produto (sem variante). Variantes são checadas depois.
    if (!item.variante_id && dbProd.estoque !== null && dbProd.estoque <= 0) {
      return { success: false, error: `O produto "${dbProd.nome}" está sem estoque. Remova-o do carrinho para continuar.` }
    }
    // Restrição de série: produto segmentado só pode ser comprado para aluno da
    // série correspondente (comparação normalizada — "1º ano EM" ≡ "1ª Série EM").
    // Rede de segurança do servidor: o seletor do cliente pode estar stale/burlado.
    if (!produtoDisponivelParaSerie((dbProd as { series?: string[] | null }).series, alunoSerieMap.get(item.aluno_id) ?? '')) {
      return { success: false, error: `O produto "${dbProd.nome}" não está disponível para a série do aluno selecionado.` }
    }

    // preco_promocional = 0 NÃO significa produto grátis: trata 0 como "sem
    // promoção" (usa o preço cheio). Só usa a promoção quando > 0.
    const promo = dbProd.preco_promocional
    const precoReal = (promo !== null && promo !== undefined && promo > 0) ? promo : dbProd.preco
    totalCalculado += precoReal
    if (dbProd.aceita_vouchers) subtotalElegivel += precoReal

    safeItems.push({ ...item, preco_unitario: precoReal })
  }

  // C6: compara o total exibido ao cliente com o total real recalculado. Se
  // divergir (preço mudou entre a montagem do carrinho e o checkout), aborta e
  // pede reconfirmação — nunca cobra silenciosamente um valor diferente do exibido.
  if (input.total_exibido !== undefined) {
    const exibidoCentavos = Math.round(input.total_exibido * 100)
    const realCentavos = Math.round(totalCalculado * 100)
    if (exibidoCentavos !== realCentavos) {
      return {
        success: false,
        precoAtualizado: true,
        totalReal: Math.round(totalCalculado * 100) / 100,
        error: 'O preço de um ou mais itens foi atualizado. Confira o novo total antes de confirmar.',
      }
    }
  }

  // Leituras/RPCs privilegiadas rodam via service role. O SELECT de vouchers
  // foi revogado de authenticated para impedir enumeração de códigos; aqui
  // validamos só o código exato informado, escopado à escola do responsável.
  const adminClient = createAdminClient()

  // Lógica do Voucher
  let voucherIdParaSalvar: string | null = null
  let descontoAplicado = 0

  if (input.voucher_codigo) {
    const { data: voucher, error: voucherErr } = await adminClient
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
      // Arredonda o desconto para centavos: sem isso, um percentual gera valores
      // com 3+ casas gravados no pedido e enviados ao Asaas (cobrado ≠ exibido).
      descontoAplicado = arredondarCentavos(subtotalElegivel * (voucher.valor / 100))
    } else {
      descontoAplicado = Math.min(arredondarCentavos(voucher.valor), subtotalElegivel)
    }
    voucherIdParaSalvar = voucher.id
  }

  const finalTotal = arredondarCentavos(Math.max(0, totalCalculado - descontoAplicado))
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
  const pedidoInsert: Record<string, unknown> = {
    responsavel_id: user.id,
    escola_id: responsavel.escola_id,
    status: 'pendente',
    metodo_pagamento: input.metodo,
    total: finalTotal,
    termo_aceito: input.termo_aceito ?? false,
    termo_aceito_em: input.termo_aceito ? new Date().toISOString() : null,
  }

  if (voucherIdParaSalvar) {
    pedidoInsert.voucher_id = voucherIdParaSalvar
  }
  if (descontoAplicado > 0) {
    pedidoInsert.desconto_aplicado = descontoAplicado
  }

  const { data: pedido, error: pedidoErr } = await supabase
    .from('pedidos')
    .insert(pedidoInsert)
    .select()
    .single()

  if (pedidoErr || !pedido) {
    const detalhe = {
      code: pedidoErr?.code,
      message: pedidoErr?.message,
      details: pedidoErr?.details,
      hint: pedidoErr?.hint,
      responsavelId: user.id,
      escolaId: responsavel.escola_id,
      metodo: input.metodo,
      total: finalTotal,
      itemCount: safeItems.length,
      temVoucher: Boolean(voucherIdParaSalvar),
      descontoAplicado,
    }
    console.error('[createOrderAction] falha ao criar pedido', detalhe)
    await auditLog({
      modulo: 'checkout',
      acao: 'pedido_insert_falhou',
      descricao: detalhe.message ?? 'Erro ao criar pedido.',
      metadata: detalhe,
    })
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
    const { data: incrementado } = await adminClient
      .rpc('incrementar_uso_voucher', { p_voucher_id: voucherIdParaSalvar })

    if (!incrementado) {
      // Limite atingido em concorrência — desfaz pedido/itens. Nenhuma variante
      // foi reservada ainda (a reserva vem depois), então NÃO restaura estoque
      // aqui (isso incrementaria estoque nunca decrementado → oversell).
      await supabase.from('itens_pedido').delete().eq('pedido_id', pedido.id)
      await supabase.from('pedidos').delete().eq('id', pedido.id)
      return { success: false, error: 'Cupom esgotado. Tente finalizar sem o cupom.' }
    }
  }

  // Reserva estoque das variantes, rastreando o que foi de fato decrementado
  // para desfazer só isso em caso de falha parcial (item N falha → restaura 1..N-1).
  const variantesReservadas: string[] = []
  for (const item of itensComVariante) {
    if (!item.variante_id) continue
    const { data: reservado, error: reservaError } = await adminClient
      .rpc('reservar_estoque_variante', { p_variante_id: item.variante_id })

    if (reservaError || !reservado) {
      // Desfaz as reservas já feitas antes de abortar.
      for (const varianteId of variantesReservadas) {
        await adminClient.rpc('restaurar_estoque_variante', { p_variante_id: varianteId })
      }
      // Devolve o uso do voucher consumido acima.
      if (voucherIdParaSalvar) {
        await decrementarUsoVoucher(adminClient, voucherIdParaSalvar)
      }
      await supabase.from('itens_pedido').delete().eq('pedido_id', pedido.id)
      await supabase.from('pedidos').delete().eq('id', pedido.id)
      return { success: false, error: `O estoque da variante ${item.variante ?? ''} acabou enquanto você finalizava o pedido.`.trim() }
    }
    variantesReservadas.push(item.variante_id)
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
  } catch (err) {
    const detalhe = {
      pedidoId: pedido.id,
      numero: pedido.numero,
      metodo: input.metodo,
      total: finalTotal,
      message: err instanceof Error ? err.message : String(err),
      name: err instanceof Error ? err.name : undefined,
      stack: err instanceof Error ? err.stack?.slice(0, 2000) : undefined,
    }
    console.error('[finalizarPedidoAction] gateway falhou', detalhe)
    // Grava também na auditoria_log pra inspeção via SQL quando logs do Vercel
    // não estão acessíveis.
    await auditLog({
      modulo: 'checkout',
      acao: 'gateway_falhou',
      descricao: detalhe.message,
      metadata: detalhe,
    })
    // Reverte tudo que foi criado: estoque reservado, uso do voucher e o
    // pedido/itens órfãos (senão acumulam pedidos 'pendentes' impagáveis e o
    // cupom de uso único queima sem venda).
    await restaurarEstoqueVariantes(supabase, safeItems)
    if (voucherIdParaSalvar) {
      await decrementarUsoVoucher(adminClient, voucherIdParaSalvar)
    }
    await supabase.from('itens_pedido').delete().eq('pedido_id', pedido.id)
    await supabase.from('pedidos').delete().eq('id', pedido.id)
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
    // A cobrança JÁ existe no gateway (cartão pode ter sido cobrado agora). Não
    // podemos simplesmente devolver estoque e mandar o usuário refazer — isso
    // arrisca cobrança dupla e deixa a cobrança órfã (webhook procura por
    // gateway_id e não acharia). Garantimos a persistência do gateway_id para
    // reconciliação: tenta um insert mínimo e, se falhar, registra na auditoria.
    console.error('[finalizarPedidoAction] insert de pagamento falhou', {
      pedidoId: pedido.id,
      gatewayId: resultado.gateway_id,
      code: pagErr.code,
      message: pagErr.message,
    })

    const { error: pagMinErr } = await supabase.from('pagamentos').insert({
      pedido_id: pedido.id,
      metodo: input.metodo,
      gateway_id: resultado.gateway_id,
      total: finalTotal,
      parcelas: input.parcelas ?? 1,
      status: resultado.status,
    })

    await auditLog({
      modulo: 'checkout',
      acao: 'pagamento_insert_falhou',
      descricao: pagErr.message,
      metadata: {
        pedidoId: pedido.id,
        gatewayId: resultado.gateway_id,
        metodo: input.metodo,
        total: finalTotal,
        reconciliacaoMinima: !pagMinErr,
      },
    })

    // O pedido segue 'pendente' vinculado ao gateway_id; o webhook reconcilia.
    // Não devolvemos estoque nem apagamos o pedido para não perder a cobrança.
    return {
      success: true,
      pedido_id: pedido.id,
    }
  }

  // 5. Se cartão aprovado, atualiza status do pedido
  if (resultado.metodo === 'cartao' && resultado.status === 'confirmado') {
    const { data: rows, error: pagoErr } = await supabase
      .from('pedidos')
      .update({ status: 'pago', data_pagamento: new Date().toISOString() })
      .eq('id', pedido.id)
      .select('id')
    if (pagoErr || !rows || rows.length === 0) {
      console.error('[finalizarPedidoAction] cartão aprovado mas pedido não marcado como pago', {
        pedidoId: pedido.id,
        code: pagoErr?.code,
        message: pagoErr?.message,
        affectedRows: rows?.length ?? 0,
      })
      // Não interrompe o fluxo — o webhook do Asaas vai tentar reconciliar depois.
    } else {
      // Gera ingressos caso existam produtos com gera_ingresso
      await adminClient.rpc('gerar_ingressos_pedido', { p_pedido_id: pedido.id })
    }
  }

  // 6. Envia email de confirmação do pedido. Aguardamos (await) porque em
  // serverless o processo pode congelar após a resposta e perder promises soltas.
  // A função captura os próprios erros — falha de e-mail não derruba o checkout.
  await enviarEmailCheckout({
    client: supabase,
    responsavel: { nome: responsavel.nome, email: responsavel.email },
    escolaId: responsavel.escola_id,
    pedidoId: pedido.id,
    numeroPedido: pedido.numero,
    metodo: input.metodo,
    parcelas: input.parcelas ?? 1,
    subtotal: totalCalculado,
    desconto: descontoAplicado,
    total: finalTotal,
    itens: safeItems.map(i => ({
      produto_id: i.produto_id,
      aluno_id: i.aluno_id,
      variante: i.variante ?? null,
      preco_unitario: i.preco_unitario,
      nome: i.nome,
    })),
    produtos: produtosMap,
    cartaoAprovado: resultado.metodo === 'cartao' && resultado.status === 'confirmado',
    pix: resultado.metodo === 'pix'
      ? { copiaCola: resultado.qr_code, expiracao: resultado.expiracao }
      : undefined,
    boleto: resultado.metodo === 'boleto'
      ? { linhaDigitavel: resultado.linha_digitavel, vencimento: resultado.vencimento, url: resultado.url }
      : undefined,
  })

  return { success: true, pedido_id: pedido.id }
}

async function restaurarEstoqueVariantes(
  _supabase: Awaited<ReturnType<typeof createClient>>,
  items: CartItemInput[]
) {
  const adminClient = createAdminClient()
  for (const item of items) {
    if (!item.variante_id) continue
    await adminClient.rpc('restaurar_estoque_variante', { p_variante_id: item.variante_id })
  }
}

/**
 * Devolve um uso do voucher (usado quando um checkout que já incrementou o
 * contador é revertido). Usa a RPC atômica; falha silenciosa não deve derrubar
 * o fluxo de reversão em andamento.
 */
async function decrementarUsoVoucher(
  adminClient: ReturnType<typeof createAdminClient>,
  voucherId: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await adminClient.rpc('decrementar_uso_voucher' as any, { p_voucher_id: voucherId })
  if (error) {
    console.error('[decrementarUsoVoucher] falha ao devolver uso do voucher', {
      voucherId,
      message: error.message,
    })
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

  // Cancela a cobrança PIX antiga no Asaas para que o QR antigo deixe de ser
  // pagável (evita pagamento duplo / pagamento "perdido" numa cobrança órfã que
  // não está mais vinculada ao pedido após o gateway_id ser sobrescrito).
  // Best-effort: não bloqueia a renovação se o cancelamento falhar.
  if (pag.gateway_id && pag.gateway_id !== resultado.gateway_id) {
    try {
      await getGateway().cancelarPagamento(pag.gateway_id)
    } catch (err) {
      console.warn('[renovarPixAction] falha ao cancelar cobrança PIX antiga', {
        gatewayIdAntigo: pag.gateway_id,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // Atualiza pagamento com novo PIX
  const { data: pagRows, error: updateErr } = await supabase
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
    .select('id')

  if (updateErr) {
    console.error('[renovarPixAction] update pagamento failed', { pagId: pag.id, message: updateErr.message })
    return { success: false, error: 'Erro ao salvar novo PIX.' }
  }
  if (!pagRows || pagRows.length === 0) {
    console.error('[renovarPixAction] pagamento não atualizado (zero rows)', { pagId: pag.id })
    return { success: false, error: 'Pagamento não encontrado.' }
  }

  const { data: pedRows, error: pedErr } = await supabase
    .from('pedidos')
    .update({ status: 'pendente' })
    .eq('id', pedido.id)
    .select('id')
  if (pedErr || !pedRows || pedRows.length === 0) {
    console.error('[renovarPixAction] pedido não voltou pra pendente', {
      pedidoId: pedido.id,
      code: pedErr?.code,
      message: pedErr?.message,
      affectedRows: pedRows?.length ?? 0,
    })
    // Não interrompe — o PIX já foi salvo, webhook reconcilia.
  }

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

  if (errEstorno || !estorno) {
    // 23505 = violação do índice único parcial (uma solicitação pendente por pedido).
    // Fecha a corrida do check-then-insert acima: duas requisições concorrentes passam
    // na verificação e a segunda cai aqui em vez de criar uma solicitação duplicada.
    if ((errEstorno as { code?: string } | null)?.code === '23505') {
      return { error: 'Já existe uma solicitação de estorno pendente para este pedido.' }
    }
    return { error: errEstorno?.message ?? 'Erro ao criar solicitação.' }
  }

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
