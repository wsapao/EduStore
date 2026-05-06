'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashPin, verifyPin } from '@/lib/cantina/pin'
import { getGateway } from '@/lib/pagamentos/gateway'
import type { ResultadoPagamento } from '@/lib/pagamentos/types'

const PAGE_SIZE = 20

// ── Carteiras do responsável ──────────────────────────────────
export async function getCarteirasByResponsavelAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.', data: null }

  const { data, error } = await supabase
    .from('cantina_carteiras')
    .select(`
      *,
      aluno:alunos!aluno_id (id, nome, serie, turma)
    `)
    .order('created_at', { ascending: true })

  if (error) return { error: error.message, data: null }
  return { data, error: null }
}

// ── Extrato paginado ──────────────────────────────────────────
export async function getExtratoAction(alunoId: string, page = 1) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.', data: null, total: 0 }

  // Verificar que o responsável tem acesso ao aluno
  const { data: vinculo } = await supabase
    .from('responsavel_aluno')
    .select('aluno_id')
    .eq('responsavel_id', user.id)
    .eq('aluno_id', alunoId)
    .single()

  if (!vinculo) return { error: 'Acesso negado.', data: null, total: 0 }

  // Buscar carteira do aluno
  const { data: carteira } = await supabase
    .from('cantina_carteiras')
    .select('id')
    .eq('aluno_id', alunoId)
    .single()

  if (!carteira) return { error: 'Carteira não encontrada.', data: null, total: 0 }

  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data, error, count } = await supabase
    .from('cantina_movimentacoes')
    .select('*', { count: 'exact' })
    .eq('carteira_id', carteira.id)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) return { error: error.message, data: null, total: 0 }
  return { data, error: null, total: count ?? 0 }
}

// ── Configurar carteira ───────────────────────────────────────
export async function configurarCarteiraAction(
  alunoId: string,
  limiteDiario: number | null,
  bloqueioMotivo: string | null,
  senhaPin?: string | null
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  // Verificar vínculo
  const { data: vinculo } = await supabase
    .from('responsavel_aluno')
    .select('aluno_id')
    .eq('responsavel_id', user.id)
    .eq('aluno_id', alunoId)
    .single()

  if (!vinculo) return { error: 'Acesso negado.' }

  const updateData: any = {
    limite_diario: limiteDiario,
    ativo: !bloqueioMotivo,
    bloqueio_motivo: bloqueioMotivo || null,
    updated_at: new Date().toISOString(),
  }

  if (senhaPin !== undefined) {
    updateData.senha_pin_hash = senhaPin ? await hashPin(senhaPin) : null
  }

  const { error } = await supabase
    .from('cantina_carteiras')
    .update(updateData)
    .eq('aluno_id', alunoId)

  if (error) return { error: error.message }

  revalidatePath('/cantina')
  revalidatePath(`/cantina/${alunoId}/configurar`)
  return { success: true }
}

// ── Ativar carteira (cria nova) ───────────────────────────────
export async function ativarCarteiraAction(alunoId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  // Verificar vínculo
  const { data: vinculo } = await supabase
    .from('responsavel_aluno')
    .select('aluno_id')
    .eq('responsavel_id', user.id)
    .eq('aluno_id', alunoId)
    .single()

  if (!vinculo) return { error: 'Acesso negado.' }

  // Buscar escola_id do aluno
  const { data: aluno } = await supabase
    .from('alunos')
    .select('escola_id')
    .eq('id', alunoId)
    .single()

  if (!aluno) return { error: 'Aluno não encontrado.' }

  // Verificar se já existe
  const { data: existente } = await supabase
    .from('cantina_carteiras')
    .select('id')
    .eq('aluno_id', alunoId)
    .single()

  if (existente) return { error: 'Carteira já existe.' }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('cantina_carteiras')
    .insert({ aluno_id: alunoId, escola_id: aluno.escola_id })

  if (error) return { error: error.message }

  revalidatePath('/cantina')
  return { success: true }
}

// ── Ajuste manual (admin) ─────────────────────────────────────
export async function ajusteManualAdminAction(
  carteiraId: string,
  tipo: 'credito' | 'debito',
  valor: number,
  motivo: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const isAdmin = user.app_metadata?.role === 'admin'
  if (!isAdmin) return { error: 'Acesso negado.' }

  if (valor <= 0) return { error: 'Valor deve ser positivo.' }

  const adminClient = createAdminClient()

  if (tipo === 'credito') {
    const { data, error } = await adminClient
      .rpc('creditar_saldo_cantina', {
        p_carteira_id: carteiraId,
        p_valor: valor,
        p_descricao: `Ajuste manual: ${motivo}`,
        p_operador_id: user.id,
        p_gateway_id: null,
      })

    if (error) return { error: error.message }
    const result = data as { ok: boolean; erro?: string }
    if (!result?.ok) return { error: result?.erro ?? 'Erro ao creditar.' }
  } else {
    // Débito manual: inserir movimentação tipo ajuste_manual sem usar RPC de consumo
    const { data: carteira } = await adminClient
      .from('cantina_carteiras')
      .select('saldo')
      .eq('id', carteiraId)
      .single()

    if (!carteira) return { error: 'Carteira não encontrada.' }
    if ((carteira.saldo as number) < valor) return { error: 'Saldo insuficiente.' }

    const novoSaldo = (carteira.saldo as number) - valor

    const { error: errUpdate } = await adminClient
      .from('cantina_carteiras')
      .update({ saldo: novoSaldo, updated_at: new Date().toISOString() })
      .eq('id', carteiraId)

    if (errUpdate) return { error: errUpdate.message }

    const { error: errMov } = await adminClient
      .from('cantina_movimentacoes')
      .insert({
        carteira_id: carteiraId,
        tipo: 'ajuste_manual',
        valor,
        saldo_apos: novoSaldo,
        descricao: `Ajuste manual (débito): ${motivo}`,
        operador_id: user.id,
      })

    if (errMov) return { error: errMov.message }
  }

  revalidatePath('/admin/cantina')
  revalidatePath('/admin/cantina/carteiras')
  return { success: true }
}

// ── Buscar aluno na cantina (operador) ────────────────────────
export async function buscarAlunoCantinaAction(q: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.', data: null }

  const role = user.app_metadata?.role
  if (role !== 'admin' && role !== 'operador') return { error: 'Acesso negado.', data: null }

  const adminClient = createAdminClient()

  const { data, error } = await adminClient
    .from('alunos')
    .select(`
      id, nome, serie, turma,
      cantina_carteiras (id, saldo, limite_diario, ativo, bloqueio_motivo, qr_token, senha_pin_hash, nfc_id),
      cantina_restricoes (produto_id, motivo)
    `)
    .ilike('nome', `%${q.trim()}%`)
    .eq('ativo', true)
    .limit(10)

  if (error) return { error: error.message, data: null }

  // Mapear para não vazar o hash para o front
  const safeData = data.map(aluno => ({
    ...aluno,
    cantina_carteiras: aluno.cantina_carteiras.map(c => ({
      ...c,
      has_pin: !!c.senha_pin_hash,
      senha_pin_hash: undefined,
    }))
  }))

  return { data: safeData, error: null }
}

export async function confirmarCompraCantinaAction(
  alunoId: string,
  itens: Array<{ produto_id: string; quantidade: number; preco_unitario: number }>,
  senhaDigitada?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const role = user.app_metadata?.role
  if (role !== 'admin' && role !== 'operador') return { error: 'Acesso negado.' }

  if (!itens.length) return { error: 'Carrinho vazio.' }

  const total = itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0)
  const adminClient = createAdminClient()

  // Buscar carteira
  const { data: carteira } = await adminClient
    .from('cantina_carteiras')
    .select('id, escola_id, senha_pin_hash')
    .eq('aluno_id', alunoId)
    .single()

  if (!carteira) return { error: 'Carteira não encontrada para este aluno.' }

  // Validar PIN se configurado na carteira
  if (carteira.senha_pin_hash) {
    if (!senhaDigitada) return { error: 'PIN necessário.', requiresPin: true }
    const pinValido = await verifyPin(senhaDigitada, carteira.senha_pin_hash)
    if (!pinValido) return { error: 'Senha incorreta.', requiresPin: true }
  }

  // Debitar saldo via RPC
  const { data: resultado, error: errRpc } = await adminClient
    .rpc('debitar_saldo_cantina', {
      p_carteira_id: carteira.id,
      p_valor: total,
      p_descricao: `Compra cantina — ${itens.length} item(s)`,
      p_operador_id: user.id,
    })

  if (errRpc) return { error: errRpc.message }
  const rpcResult = resultado as { ok: boolean; erro?: string; movimentacao_id?: string; saldo_apos?: number }
  if (!rpcResult?.ok) return { error: rpcResult?.erro ?? 'Erro ao debitar saldo.' }

  // Criar pedido
  const { data: pedido, error: errPedido } = await adminClient
    .from('cantina_pedidos')
    .insert({
      escola_id: carteira.escola_id,
      aluno_id: alunoId,
      operador_id: user.id,
      tipo: 'presencial',
      status: 'confirmado',
      total,
      movimentacao_id: rpcResult.movimentacao_id,
    })
    .select('id, numero')
    .single()

  if (errPedido) return { error: errPedido.message }

  // Inserir itens
  const { error: errItens } = await adminClient
    .from('cantina_pedido_itens')
    .insert(itens.map(i => ({ ...i, pedido_id: pedido.id })))

  if (errItens) return { error: errItens.message }

  // Atualizar movimentação com pedido_id
  await adminClient
    .from('cantina_movimentacoes')
    .update({ pedido_cantina_id: pedido.id })
    .eq('id', rpcResult.movimentacao_id)

  revalidatePath('/admin/cantina')
  return {
    success: true,
    pedido_id: pedido.id,
    numero: pedido.numero,
    total,
    saldo_apos: rpcResult.saldo_apos,
  }
}

// ── Iniciar recarga via PIX real ──────────────────────────────
export async function iniciarRecargaAction(alunoId: string, valor: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  if (valor < 5 || valor > 2000) {
    return { error: 'Valor fora do intervalo permitido (R$ 5,00 a R$ 2.000,00).' }
  }

  // Verifica vínculo responsável↔aluno
  const { data: vinculo } = await supabase
    .from('responsavel_aluno')
    .select('aluno_id')
    .eq('responsavel_id', user.id)
    .eq('aluno_id', alunoId)
    .single()

  if (!vinculo) return { error: 'Acesso negado.' }

  // Busca carteira + verifica se está ativa
  const { data: carteira } = await supabase
    .from('cantina_carteiras')
    .select('id, ativo')
    .eq('aluno_id', alunoId)
    .single()

  if (!carteira) return { error: 'Carteira não encontrada.' }
  if (!carteira.ativo) return { error: 'Carteira bloqueada. Desbloqueie antes de recarregar.' }

  // Busca dados do responsável para criar o cliente no Asaas
  const { data: responsavel } = await supabase
    .from('responsaveis')
    .select('nome, email, cpf')
    .eq('id', user.id)
    .single()

  if (!responsavel?.cpf) return { error: 'CPF não cadastrado. Contate a escola.' }

  // Pré-gera o ID da recarga para usá-lo como externalReference no Asaas
  const recargaId = crypto.randomUUID()

  // Cria o PIX no Asaas
  const gateway = getGateway('cantina')
  let resultado: ResultadoPagamento
  try {
    resultado = await gateway.criarPagamento({
      metodo: 'pix',
      total: valor,
      responsavel: {
        nome: responsavel.nome,
        email: responsavel.email,
        cpf: responsavel.cpf,
      },
      descricao: `Recarga cantina — R$ ${valor.toFixed(2)}`,
      referencia: `recarga:${recargaId}`,
    })
  } catch (err) {
    console.error('[iniciarRecarga] Erro ao criar PIX no Asaas:', err)
    return { error: 'Erro ao processar pagamento. Tente novamente.' }
  }

  if (resultado.metodo !== 'pix') return { error: 'Resposta inválida do gateway.' }
  const pix = resultado

  // Insere registro de recarga (sem creditar saldo — crédito ocorre após confirmação do webhook)
  const adminClient = createAdminClient()
  const { error: errRecarga } = await adminClient
    .from('cantina_recargas' as any)
    .insert({
      id: recargaId,
      carteira_id: carteira.id,
      responsavel_id: user.id,
      valor,
      status: 'aguardando',
      gateway_id: pix.gateway_id,
      pix_qr_code: pix.qr_code,
      pix_qr_code_imagem: pix.qr_code_imagem,
      pix_expiracao: pix.expiracao,
    })

  if (errRecarga) {
    console.error('[iniciarRecarga] PIX criado mas insert falhou. gateway_id:', pix.gateway_id, 'erro:', errRecarga.message)
    return { error: 'Erro ao registrar recarga. Tente novamente.' }
  }

  return {
    recarga_id: recargaId,
    pix_qr_code: pix.qr_code,
    pix_qr_code_imagem: pix.qr_code_imagem,
    pix_expiracao: pix.expiracao,
  }
}

// ── Renovar PIX expirado ──────────────────────────────────────
export async function renovarRecargaAction(recargaId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  // RLS garante que o usuário só vê suas próprias recargas
  const { data: recarga } = await supabase
    .from('cantina_recargas' as any)
    .select('id, carteira_id, responsavel_id, valor, status, pix_expiracao')
    .eq('id', recargaId)
    .single()

  if (!recarga || recarga.responsavel_id !== user.id) return { error: 'Recarga não encontrada.' }
  if (recarga.status !== 'aguardando') return { error: 'Recarga não pode ser renovada.' }

  if (!recarga.pix_expiracao) return { error: 'Dados de expiração ausentes.' }
  const agora = new Date()
  const expiracao = new Date(recarga.pix_expiracao as string)
  if (expiracao > agora) return { error: 'PIX ainda não expirou.' }

  // Busca dados do responsável para criar o cliente no Asaas
  const { data: responsavel } = await supabase
    .from('responsaveis')
    .select('nome, email, cpf')
    .eq('id', user.id)
    .single()

  if (!responsavel?.cpf) return { error: 'CPF não cadastrado. Contate a escola.' }

  // Cria novo PIX com a mesma referência (mesmo recargaId)
  const gateway = getGateway('cantina')
  let resultado: ResultadoPagamento
  try {
    resultado = await gateway.criarPagamento({
      metodo: 'pix',
      total: recarga.valor as number,
      responsavel: {
        nome: responsavel.nome,
        email: responsavel.email,
        cpf: responsavel.cpf,
      },
      descricao: `Recarga cantina (renovação) — R$ ${(recarga.valor as number).toFixed(2)}`,
      referencia: `recarga:${recargaId}`,
    })
  } catch (err) {
    console.error('[renovarRecarga] Erro ao criar PIX no Asaas:', err)
    return { error: 'Erro ao processar pagamento. Tente novamente.' }
  }

  if (resultado.metodo !== 'pix') return { error: 'Resposta inválida do gateway.' }
  const pix = resultado

  // Atualiza o registro com o novo QR Code (sem mudar o status)
  const adminClient = createAdminClient()
  const { error: errUpdate } = await adminClient
    .from('cantina_recargas' as any)
    .update({
      gateway_id: pix.gateway_id,
      pix_qr_code: pix.qr_code,
      pix_qr_code_imagem: pix.qr_code_imagem,
      pix_expiracao: pix.expiracao,
    })
    .eq('id', recargaId)

  if (errUpdate) {
    console.error('[renovarRecarga] PIX renovado mas update falhou. gateway_id:', pix.gateway_id, 'erro:', errUpdate.message)
    return { error: 'Erro ao atualizar recarga.' }
  }

  return {
    pix_qr_code: pix.qr_code,
    pix_qr_code_imagem: pix.qr_code_imagem,
    pix_expiracao: pix.expiracao,
  }
}

// ── Ações para admin de produtos ─────────────────────────────
export async function salvarProdutoCantinaAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') return { error: 'Acesso negado.' }

  const id = formData.get('id') as string | null
  const nome = (formData.get('nome') as string)?.trim()
  const descricao = (formData.get('descricao') as string)?.trim() || null
  const preco = parseFloat(formData.get('preco') as string)
  const categoria = (formData.get('categoria') as string) || 'lanche'
  const icone = (formData.get('icone') as string) || '🍽️'
  const disponivel_presencial = formData.get('disponivel_presencial') === 'true'
  const disponivel_online = formData.get('disponivel_online') === 'true'
  const alergenos = ((formData.get('alergenos') as string) || '').split(',').map(s => s.trim()).filter(Boolean)

  if (!nome) return { error: 'Nome obrigatório.' }
  if (isNaN(preco) || preco < 0) return { error: 'Preço inválido.' }

  // Buscar escola_id do admin
  const adminClient = createAdminClient()
  const { data: resp } = await adminClient.from('responsaveis').select('escola_id').eq('id', user.id).single()
  const escola_id = resp?.escola_id
  if (!escola_id) return { error: 'Escola não encontrada.' }

  if (id) {
    const { error } = await adminClient
      .from('cantina_produtos')
      .update({ nome, descricao, preco, categoria, icone, disponivel_presencial, disponivel_online, alergenos })
      .eq('id', id)
    if (error) return { error: error.message }
  } else {
    const { error } = await adminClient
      .from('cantina_produtos')
      .insert({ nome, descricao, preco, categoria, icone, disponivel_presencial, disponivel_online, alergenos, escola_id })
    if (error) return { error: error.message }
  }

  revalidatePath('/admin/cantina/produtos')
  return { success: true }
}

export async function toggleProdutoCantinaAction(produtoId: string, ativo: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') return { error: 'Acesso negado.' }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('cantina_produtos')
    .update({ ativo: !ativo })
    .eq('id', produtoId)

  if (error) return { error: error.message }

  revalidatePath('/admin/cantina/produtos')
  revalidatePath('/admin/cantina')
  return { success: true }
}

export async function bloquearCarteiraAdminAction(carteiraId: string, bloquear: boolean, motivo?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') return { error: 'Acesso negado.' }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('cantina_carteiras')
    .update({
      ativo: !bloquear,
      bloqueio_motivo: bloquear ? (motivo || 'Bloqueado pelo administrador') : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', carteiraId)

  if (error) return { error: error.message }

  revalidatePath('/admin/cantina/carteiras')
  return { success: true }
}

// ── Restrições Nutricionais ───────────────────────────────────
export async function adicionarRestricaoAction(alunoId: string, produtoId: string | null, categoria: string | null, motivo: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  // Verificar vínculo
  const { data: vinculo } = await supabase
    .from('responsavel_aluno')
    .select('aluno_id')
    .eq('responsavel_id', user.id)
    .eq('aluno_id', alunoId)
    .single()

  if (!vinculo) return { error: 'Acesso negado.' }

  const { error } = await supabase
    .from('cantina_restricoes')
    .insert({
      aluno_id: alunoId,
      produto_id: produtoId,
      categoria,
      motivo,
    })

  if (error) return { error: error.message }
  revalidatePath(`/cantina/${alunoId}/configurar`)
  return { success: true }
}

export async function removerRestricaoAction(restricaoId: string, alunoId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  // Verificar vínculo
  const { data: vinculo } = await supabase
    .from('responsavel_aluno')
    .select('aluno_id')
    .eq('responsavel_id', user.id)
    .eq('aluno_id', alunoId)
    .single()

  if (!vinculo) return { error: 'Acesso negado.' }

  const { error } = await supabase
    .from('cantina_restricoes')
    .delete()
    .eq('id', restricaoId)
    .eq('aluno_id', alunoId)

  if (error) return { error: error.message }
  revalidatePath(`/cantina/${alunoId}/configurar`)
  return { success: true }
}
