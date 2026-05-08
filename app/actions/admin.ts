'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { enviarEmailIngresso } from '@/lib/email/send'
import { enviarEmailResetSenhaAdmin } from '@/lib/email/send'
import { createAdminClient } from '@/lib/supabase/admin'

async function verificarAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    throw new Error('Acesso negado.')
  }
  return { supabase, user }
}

interface VariantePayload {
  id?: string
  nome: string
  disponivel: boolean
  estoque: number | null
  ordem: number
}

// ── Confirmar pagamento manualmente ──────────────────────────────────────────
export async function confirmarPagamentoAction(pedidoId: string) {
  const { supabase } = await verificarAdmin()

  const now = new Date().toISOString()

  // Atualiza pedido
  const { error: pedidoError } = await supabase
    .from('pedidos')
    .update({ status: 'pago', data_pagamento: now })
    .eq('id', pedidoId)

  if (pedidoError) return { success: false, error: pedidoError.message }

  // Atualiza pagamento
  await supabase
    .from('pagamentos')
    .update({ status: 'confirmado', webhook_confirmado_em: now })
    .eq('pedido_id', pedidoId)

  // Gera ingressos para itens que possuem gera_ingresso = true
  await supabase.rpc('gerar_ingressos_pedido', { p_pedido_id: pedidoId })

  revalidatePath('/admin')
  revalidatePath('/admin/pedidos')
  revalidatePath(`/pedido/${pedidoId}`)
  revalidatePath('/pedidos')

  // Envia email com ingressos emitidos (em background)
  void (async () => {
    const { data: ingressos } = await supabase
      .from('ingressos')
      .select(`
        token,
        produto:produtos(nome, data_evento, hora_evento, local_evento, icon),
        aluno:alunos(nome),
        responsavel:responsaveis(nome, email),
        pedido:itens_pedido(pedido:pedidos(numero))
      `)
      .eq('status', 'emitido')
      .in('item_pedido_id',
        (await supabase.from('itens_pedido').select('id').eq('pedido_id', pedidoId)).data?.map(i => i.id) ?? []
      )

    for (const ing of ingressos ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const i = ing as any
      if (!i.responsavel?.email) continue
      await enviarEmailIngresso(i.responsavel.email, {
        responsavelNome: i.responsavel.nome,
        alunoNome: i.aluno?.nome ?? '',
        produtoNome: i.produto?.nome ?? '',
        dataEvento: i.produto?.data_evento,
        horaEvento: i.produto?.hora_evento,
        localEvento: i.produto?.local_evento,
        ingressoUrl: i.token,
        numeroPedido: i.pedido?.pedido?.numero ?? '',
      })
    }
  })()

  return { success: true }
}

// ── Cancelar pedido ───────────────────────────────────────────────────────────
export async function cancelarPedidoAction(pedidoId: string) {
  const { supabase } = await verificarAdmin()

  const { data: itens } = await supabase
    .from('itens_pedido')
    .select('variante_id')
    .eq('pedido_id', pedidoId)

  const { error } = await supabase
    .from('pedidos')
    .update({ status: 'cancelado' })
    .eq('id', pedidoId)

  if (error) return { success: false, error: error.message }

  await supabase
    .from('pagamentos')
    .update({ status: 'falhou' })
    .eq('pedido_id', pedidoId)

  for (const item of itens ?? []) {
    if (!item.variante_id) continue
    await supabase.rpc('restaurar_estoque_variante', { p_variante_id: item.variante_id })
  }

  // Invalida ingressos emitidos associados ao pedido
  await supabase.rpc('cancelar_ingressos_pedido', { p_pedido_id: pedidoId })

  revalidatePath('/admin')
  revalidatePath('/admin/pedidos')
  revalidatePath('/pedidos')

  return { success: true }
}

// ── Validar ingresso no check-in ──────────────────────────────────────────────
export async function validarIngressoAction(token: string, validadoPor: string) {
  const { supabase } = await verificarAdmin()

  const { data, error } = await supabase
    .rpc('validar_ingresso', { p_token: token, p_validado_por: validadoPor })

  if (error) return { ok: false, motivo: error.message }

  revalidatePath('/admin/checkin')

  return data as { ok: boolean; motivo: string; usado_em?: string; validado_por?: string }
}

// ── Toggle produto ativo ──────────────────────────────────────────────────────
export async function toggleProdutoAtivoAction(produtoId: string, ativo: boolean) {
  const { supabase } = await verificarAdmin()

  const { error } = await supabase
    .from('produtos')
    .update({ ativo: !ativo })
    .eq('id', produtoId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/produtos')
  revalidatePath('/loja')

  return { success: true }
}

// ── Criar produto ─────────────────────────────────────────────────────────────
export async function criarProdutoAction(formData: FormData) {
  const { supabase } = await verificarAdmin()

  // Busca escola_id do admin
  const { data: { user } } = await supabase.auth.getUser()
  const { data: resp } = await supabase
    .from('responsaveis').select('escola_id').eq('id', user!.id).single()
  if (!resp?.escola_id) return { success: false, error: 'Admin sem escola vinculada.' }

  let imagem_url: string | null = null
  const imgFile = formData.get('imagem_arquivo') as File | null
  if (imgFile && imgFile.size > 0) {
    const ext = imgFile.name.split('.').pop() || 'png'
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('produtos-imagens')
      .upload(fileName, imgFile)
    if (!uploadError && uploadData) {
      const { data: publicUrlData } = supabase.storage.from('produtos-imagens').getPublicUrl(uploadData.path)
      imagem_url = publicUrlData.publicUrl
    }
  }

  const payload = parseProdutoForm(formData, resp.escola_id)
  if (imagem_url) payload.imagem_url = imagem_url

  const { data, error } = await supabase.from('produtos').insert(payload).select('id').single()
  if (error) return { success: false, error: error.message }

  await syncProdutoVariantes(supabase, data.id, parseVariantesForm(formData))

  revalidatePath('/admin/produtos')
  revalidatePath('/loja')
  return { success: true, id: data.id }
}

// ── Editar produto ────────────────────────────────────────────────────────────
export async function editarProdutoAction(produtoId: string, formData: FormData) {
  const { supabase } = await verificarAdmin()

  let imagem_url: string | null = null
  const imgFile = formData.get('imagem_arquivo') as File | null
  if (imgFile && imgFile.size > 0) {
    const ext = imgFile.name.split('.').pop() || 'png'
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('produtos-imagens')
      .upload(fileName, imgFile)
    if (!uploadError && uploadData) {
      const { data: publicUrlData } = supabase.storage.from('produtos-imagens').getPublicUrl(uploadData.path)
      imagem_url = publicUrlData.publicUrl
    }
  }

  const payload = parseProdutoForm(formData)
  if (imagem_url) payload.imagem_url = imagem_url

  const { error } = await supabase.from('produtos').update(payload).eq('id', produtoId)
  if (error) return { success: false, error: error.message }

  await syncProdutoVariantes(supabase, produtoId, parseVariantesForm(formData))

  revalidatePath('/admin/produtos')
  revalidatePath(`/admin/produtos/${produtoId}/editar`)
  revalidatePath('/loja')
  return { success: true }
}

// ── Duplicar produto ──────────────────────────────────────────────────────────
export async function duplicarProdutoAction(produtoId: string) {
  const { supabase } = await verificarAdmin()

  const { data: original } = await supabase
    .from('produtos').select('*').eq('id', produtoId).single()
  if (!original) return { success: false, error: 'Produto não encontrado.' }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, created_at, ...rest } = original
  const { data, error } = await supabase
    .from('produtos')
    .insert({ ...rest, nome: `${rest.nome} (cópia)`, ativo: false })
    .select('id').single()
  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/produtos')
  return { success: true, id: data.id }
}

// ── Helper: parse do FormData para objeto produto ─────────────────────────────
function parseProdutoForm(formData: FormData, escolaId?: string) {
  const metodos = formData.getAll('metodos_aceitos') as string[]
  const series  = formData.getAll('series') as string[]
  const variantes = parseVariantesForm(formData).map((variante) => variante.nome)

  // Converte preço: "25,90" ou "25.90" → 25.90
  const precoRaw = (formData.get('preco') as string ?? '0').replace(',', '.')
  const preco    = parseFloat(precoRaw)
  
  const precoPromocionalRaw = (formData.get('preco_promocional') as string ?? '').replace(',', '.')
  const preco_promocional = precoPromocionalRaw ? parseFloat(precoPromocionalRaw) : null

  const gera_ingresso = formData.get('gera_ingresso') === 'on'
  const aceita_vouchers = formData.get('aceita_vouchers') === 'on'
  const capacidadeRaw = formData.get('capacidade') as string
  const capacidade    = gera_ingresso && capacidadeRaw ? parseInt(capacidadeRaw) || null : null

  const prazo_compra = formData.get('prazo_compra') as string || null
  const data_evento  = formData.get('data_evento')  as string || null
  const hora_evento  = formData.get('hora_evento')  as string || null

  return {
    ...(escolaId ? { escola_id: escolaId } : {}),
    nome:           (formData.get('nome') as string).trim(),
    descricao:      (formData.get('descricao') as string || '').trim() || null,
    preco,
    preco_promocional,
    categoria:      formData.get('categoria') as string,
    metodos_aceitos: metodos.length ? metodos : ['pix'],
    max_parcelas:   parseInt(formData.get('max_parcelas') as string) || 1,
    prazo_compra:   prazo_compra || null,
    data_evento:    data_evento  || null,
    hora_evento:    hora_evento  || null,
    local_evento:   (formData.get('local_evento') as string || '').trim() || null,
    gera_ingresso,
    aceita_vouchers,
    capacidade,
    series:         series.length ? series : null,
    variantes:      variantes.length ? variantes : null,
    icon:           (formData.get('icon') as string || '').trim() || null,
    estoque:        (formData.get('estoque') as string) ? parseInt(formData.get('estoque') as string) : null,
    exige_termo:    formData.get('exige_termo') === 'on',
    texto_termo:    (formData.get('texto_termo') as string || '').trim() || null,
    ativo:          formData.get('ativo') === 'on',
    // imagem_url is added directly in the action handler
  } as any // Use any because the return type can be mixed before inferring the DB schema correctly
}

function parseVariantesForm(formData: FormData): VariantePayload[] {
  const raw = formData.get('variantes_json') as string | null
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as VariantePayload[]
    return parsed
      .map((variante, index) => ({
        id: variante.id,
        nome: variante.nome.trim(),
        disponivel: variante.disponivel,
        estoque: typeof variante.estoque === 'number' && !Number.isNaN(variante.estoque) ? variante.estoque : null,
        ordem: typeof variante.ordem === 'number' ? variante.ordem : index,
      }))
      .filter((variante) => variante.nome)
  } catch {
    return []
  }
}

async function syncProdutoVariantes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  produtoId: string,
  variantes: VariantePayload[]
) {
  await supabase.from('produto_variantes').delete().eq('produto_id', produtoId)

  if (variantes.length === 0) return

  await supabase.from('produto_variantes').insert(
    variantes.map((variante) => ({
      produto_id: produtoId,
      nome: variante.nome,
      disponivel: variante.disponivel,
      estoque: variante.estoque,
      ordem: variante.ordem,
    }))
  )
}

// ── Toggle produto esgotado ───────────────────────────────────────────────────
export async function toggleEsgotadoAction(produtoId: string, esgotado: boolean) {
  const { supabase } = await verificarAdmin()

  const { error } = await supabase
    .from('produtos')
    .update({ esgotado: !esgotado })
    .eq('id', produtoId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/produtos')
  revalidatePath('/loja')

  return { success: true }
}

// ── Excluir produto ───────────────────────────────────────────────────────────
export async function excluirProdutoAction(produtoId: string) {
  const { supabase } = await verificarAdmin()

  // Impede exclusão se há pedidos com este produto
  const { count } = await supabase
    .from('itens_pedido')
    .select('id', { count: 'exact', head: true })
    .eq('produto_id', produtoId)

  if ((count ?? 0) > 0) {
    return {
      success: false,
      error: 'Produto possui pedidos vinculados e não pode ser excluído. Desative-o em vez disso.',
    }
  }

  // Remove variantes primeiro (FK)
  await supabase.from('produto_variantes').delete().eq('produto_id', produtoId)

  const { error } = await supabase.from('produtos').delete().eq('id', produtoId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/produtos')
  revalidatePath('/loja')
  return { success: true }
}

// ── Vincular responsável ↔ aluno ─────────────────────────────────────────────
export async function vincularAlunoResponsavelAction(formData: FormData) {
  const { supabase } = await verificarAdmin()

  const responsavelId = (formData.get('responsavel_id') as string | null)?.trim()
  const alunoId = (formData.get('aluno_id') as string | null)?.trim()

  if (!responsavelId || !alunoId) {
    return
  }

  const [{ data: responsavel }, { data: aluno }] = await Promise.all([
    supabase.from('responsaveis').select('id, escola_id').eq('id', responsavelId).single(),
    supabase.from('alunos').select('id, escola_id').eq('id', alunoId).single(),
  ])

  if (!responsavel || !aluno) {
    return
  }

  if (!responsavel.escola_id || responsavel.escola_id !== aluno.escola_id) {
    return
  }

  const { data: existente } = await supabase
    .from('responsavel_aluno')
    .select('responsavel_id')
    .eq('responsavel_id', responsavelId)
    .eq('aluno_id', alunoId)
    .maybeSingle()

  if (existente) {
    return
  }

  const { error } = await supabase
    .from('responsavel_aluno')
    .insert({ responsavel_id: responsavelId, aluno_id: alunoId })

  if (error) return

  revalidatePath('/admin')
  revalidatePath('/admin/responsaveis')
  revalidatePath('/admin/alunos')
  revalidatePath('/perfil/alunos')
  revalidatePath('/loja')
}

// ── Desvincular responsável ↔ aluno ──────────────────────────────────────────
export async function desvincularAlunoResponsavelAction(formData: FormData) {
  const { supabase } = await verificarAdmin()

  const responsavelId = (formData.get('responsavel_id') as string | null)?.trim()
  const alunoId = (formData.get('aluno_id') as string | null)?.trim()

  if (!responsavelId || !alunoId) {
    return
  }

  const { error } = await supabase
    .from('responsavel_aluno')
    .delete()
    .eq('responsavel_id', responsavelId)
    .eq('aluno_id', alunoId)

  if (error) return

  revalidatePath('/admin')
  revalidatePath('/admin/responsaveis')
  revalidatePath('/admin/alunos')
  revalidatePath('/perfil/alunos')
  revalidatePath('/loja')
}

// ── Enviar reset de senha ao responsável ─────────────────────────────────────
export async function resetSenhaResponsavelAction(formData: FormData) {
  await verificarAdmin()

  const responsavelId = (formData.get('responsavel_id') as string | null)?.trim()
  if (!responsavelId) return

  const supabase = await createClient()
  const { data: responsavel } = await supabase
    .from('responsaveis')
    .select('id, nome, email')
    .eq('id', responsavelId)
    .single()

  if (!responsavel?.email) return

  const adminClient = createAdminClient()
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email: responsavel.email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/nova-senha`,
    },
  })

  if (error || !data.properties?.action_link) return

  await enviarEmailResetSenhaAdmin(responsavel.email, {
    responsavelNome: responsavel.nome,
    resetUrl: data.properties.action_link,
  })

  revalidatePath('/admin/responsaveis')
}

// ── Categorias ────────────────────────────────────────────────────────────────
export async function criarCategoriaAction(formData: FormData) {
  const { supabase } = await verificarAdmin()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: resp } = await supabase.from('responsaveis').select('escola_id').eq('id', user!.id).single()
  if (!resp?.escola_id) return { success: false, error: 'Admin sem escola vinculada.' }

  const nome = (formData.get('nome') as string).trim()
  const icone = (formData.get('icone') as string).trim() || '🏷️'
  const tem_variantes = formData.get('tem_variantes') === 'on'

  const { error } = await supabase.from('categorias_produto').insert({
    escola_id: resp.escola_id,
    nome,
    icone,
    tem_variantes,
    ativo: true,
  })

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/produtos/categorias')
  return { success: true }
}

export async function toggleCategoriaAction(id: string, ativo: boolean) {
  const { supabase } = await verificarAdmin()
  const { error } = await supabase.from('categorias_produto').update({ ativo: !ativo }).eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/produtos/categorias')
  return { success: true }
}

export async function excluirCategoriaAction(id: string) {
  const { supabase } = await verificarAdmin()
  const { error } = await supabase.from('categorias_produto').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/produtos/categorias')
  return { success: true }
}

// ── Vouchers ──────────────────────────────────────────────────────────────────
export async function criarVoucherAction(formData: FormData) {
  const { supabase } = await verificarAdmin()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: resp } = await supabase.from('responsaveis').select('escola_id').eq('id', user!.id).single()
  if (!resp?.escola_id) return { success: false, error: 'Admin sem escola vinculada.' }

  const gerarAleatorio = formData.get('gerar_aleatorio') === 'on'
  const codigoDigitado = (formData.get('codigo') as string)?.trim().toUpperCase()
  const quantidade = parseInt(formData.get('quantidade') as string) || 1

  if (!gerarAleatorio && !codigoDigitado) {
    return { success: false, error: 'Forneça um código ou escolha gerar aleatoriamente.' }
  }

  const tipo_desconto = formData.get('tipo_desconto') as 'percentual' | 'fixo'
  const valor = parseFloat((formData.get('valor') as string).replace(',', '.'))
  const limiteRaw = formData.get('limite_usos') as string
  const limite_usos = limiteRaw ? parseInt(limiteRaw) : null
  const compraMinimaRaw = formData.get('compra_minima') as string
  const compra_minima = compraMinimaRaw ? parseFloat(compraMinimaRaw.replace(',', '.')) : null
  const validadeRaw = formData.get('data_validade') as string
  const data_validade = validadeRaw ? new Date(validadeRaw).toISOString() : null
  
  // Pegar os arrays de produtos
  const produtos_ids = formData.getAll('produtos_ids') as string[]
  const produtosIdsFinais = produtos_ids.length > 0 && produtos_ids[0] !== '' ? produtos_ids : null

  // Gera a lista de códigos
  const codigos = []
  if (gerarAleatorio) {
    for (let i = 0; i < quantidade; i++) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      let code = ''
      for (let j = 0; j < 8; j++) code += chars.charAt(Math.floor(Math.random() * chars.length))
      codigos.push(codigoDigitado ? `${codigoDigitado}-${code}` : code) // permite prefixo opcional
    }
  } else {
    codigos.push(codigoDigitado)
  }

  const inserts = codigos.map(cod => ({
    escola_id: resp.escola_id,
    codigo: cod,
    tipo_desconto,
    valor,
    limite_usos,
    compra_minima,
    data_validade,
    produtos_ids: produtosIdsFinais,
    ativo: true,
  }))

  const { error } = await supabase.from('vouchers').insert(inserts)

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Um cupom com esse código já existe.' }
    return { success: false, error: error.message }
  }
  
  revalidatePath('/admin/vouchers')
  return { success: true }
}

export async function toggleVoucherAction(id: string, ativo: boolean) {
  const { supabase } = await verificarAdmin()
  const { error } = await supabase.from('vouchers').update({ ativo: !ativo }).eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/vouchers')
  return { success: true }
}

export async function excluirVoucherAction(id: string) {
  const { supabase } = await verificarAdmin()
  const { error } = await supabase.from('vouchers').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/vouchers')
  return { success: true }
}

export async function excluirVouchersLoteAction(ids: string[]) {
  const { supabase } = await verificarAdmin()
  const { error } = await supabase.from('vouchers').delete().in('id', ids)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/vouchers')
  return { success: true }
}

// ── Estornar recarga confirmada (admin only) ──────────────────
export async function estornarRecargaAdminAction(recargaId: string): Promise<{ success: true; saldoApos: number } | { error: string }> {
  const { supabase, user } = await verificarAdmin()
  const adminClient = createAdminClient()

  const { data: recarga } = await adminClient
    .from('cantina_recargas')
    .select('id, status, metodo, gateway_id, valor')
    .eq('id', recargaId)
    .single()

  if (!recarga) return { error: 'Recarga não encontrada.' }
  if (recarga.status !== 'confirmada') return { error: 'Só é possível estornar recargas confirmadas.' }

  // Estornar no Asaas PRIMEIRO. Se falhar, não mexe no banco.
  if (recarga.gateway_id && recarga.metodo !== 'boleto') {
    try {
      const { getGateway } = await import('@/lib/pagamentos/gateway')
      const gateway = getGateway('cantina')
      await gateway.estornarPagamento(recarga.gateway_id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await adminClient
        .from('cantina_recargas')
        .update({ motivo_falha: msg } as any)
        .eq('id', recargaId)
      return { error: `Falha ao estornar no Asaas: ${msg}` }
    }
  }

  const { data, error } = await adminClient.rpc('estornar_recarga' as any, {
    p_recarga_id: recargaId,
    p_operador_id: user.id,
  })

  if (error) {
    await adminClient
      .from('cantina_recargas')
      .update({ motivo_falha: error.message } as any)
      .eq('id', recargaId)
    return { error: error.message }
  }

  const resultado = data as { ok: boolean; erro?: string; saldo_apos?: number }
  if (!resultado.ok) {
    const motivo = resultado.erro ?? 'Erro ao estornar.'
    await adminClient
      .from('cantina_recargas')
      .update({ motivo_falha: motivo } as any)
      .eq('id', recargaId)
    return { error: motivo }
  }

  revalidatePath('/admin/cantina')
  revalidatePath('/admin/cantina/recargas')
  return { success: true, saldoApos: resultado.saldo_apos ?? 0 }
}

// ── Cancelar recarga aguardando (admin — qualquer método) ─────
export async function cancelarRecargaAdminAction(recargaId: string): Promise<{ success: true } | { error: string }> {
  const { user } = await verificarAdmin()
  const adminClient = createAdminClient()

  const { data: recarga } = await adminClient
    .from('cantina_recargas')
    .select('id, status, gateway_id')
    .eq('id', recargaId)
    .single()

  if (!recarga) return { error: 'Recarga não encontrada.' }
  if (recarga.status !== 'aguardando') return { error: 'Só é possível cancelar recargas aguardando.' }

  if (recarga.gateway_id) {
    try {
      const { getGateway } = await import('@/lib/pagamentos/gateway')
      const gateway = getGateway('cantina')
      await gateway.cancelarPagamento(recarga.gateway_id)
    } catch (err) {
      console.warn('[cancelarRecargaAdmin] Gateway não cancelou:', err)
    }
  }

  const { error } = await adminClient.rpc('cancelar_recarga' as any, { p_recarga_id: recargaId })
  if (error) return { error: error.message }

  void user
  revalidatePath('/admin/cantina/recargas')
  return { success: true }
}

// ── Aprovar estorno (admin) ───────────────────────────────────
export async function aprovarEstornoAction(
  solicitacaoId: string,
): Promise<{ success: true } | { error: string }> {
  const { user } = await verificarAdmin()
  const adminClient = createAdminClient()

  // Buscar solicitação + recarga para obter gateway_id e método ANTES de aprovar
  const { data: solicitacao, error: errSolic } = await adminClient
    .from('cantina_solicitacoes_estorno')
    .select(`
      id, status,
      recarga:cantina_recargas!recarga_id(id, gateway_id, metodo)
    `)
    .eq('id', solicitacaoId)
    .single()

  if (errSolic) return { error: errSolic.message }
  if (!solicitacao) return { error: 'Solicitação não encontrada.' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((solicitacao as any).status !== 'pendente') return { error: 'Solicitação não está pendente.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recarga = Array.isArray((solicitacao as any).recarga)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? (solicitacao as any).recarga[0]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : (solicitacao as any).recarga
  const gatewayId = recarga?.gateway_id as string | null
  const metodo = recarga?.metodo as string | undefined

  // Estornar no Asaas PRIMEIRO (PIX/cartão). Boleto não tem estorno via API.
  if (gatewayId && metodo !== 'boleto') {
    try {
      const { getGateway } = await import('@/lib/pagamentos/gateway')
      const gateway = getGateway('cantina')
      await gateway.estornarPagamento(gatewayId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { error: `Falha ao estornar no Asaas: ${msg}` }
    }
  }

  // Só aprova no banco se o Asaas processou (ou se é boleto/sem gateway)
  const { data, error } = await adminClient.rpc('aprovar_estorno' as any, {
    p_solicitacao_id: solicitacaoId,
    p_decisor_id: user.id,
  })
  if (error) return { error: error.message }
  const res = data as { ok: boolean; erro?: string; recarga_id?: string }
  if (!res.ok) return { error: res.erro ?? 'Erro ao aprovar.' }

  revalidatePath('/admin/cantina/recargas')
  return { success: true }
}

// ── Negar estorno (admin) ─────────────────────────────────────
export async function negarEstornoAction(
  solicitacaoId: string,
  observacao?: string,
): Promise<{ success: true } | { error: string }> {
  const { user } = await verificarAdmin()
  const adminClient = createAdminClient()

  const { data, error } = await adminClient.rpc('negar_estorno' as any, {
    p_solicitacao_id: solicitacaoId,
    p_decisor_id: user.id,
    p_observacao: observacao ?? null,
  })
  if (error) return { error: error.message }
  const res = data as { ok: boolean; erro?: string }
  if (!res.ok) return { error: res.erro ?? 'Erro ao negar.' }

  revalidatePath('/admin/cantina/recargas')
  return { success: true }
}

// ── Aprovar estorno parcial por item (admin) ──────────────────
export async function aprovarEstornoParcialAction(
  estornoId: string,
): Promise<{ success: true } | { error: string }> {
  await verificarAdmin()
  const adminClient = createAdminClient()

  function firstOf<T>(v: T | T[] | null | undefined): T | null {
    return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
  }

  const { data: estorno } = await adminClient
    .from('pedido_estornos')
    .select(`
      id, pedido_id, status, valor_total,
      itens:pedido_estornos_itens(item_pedido_id),
      pedido:pedidos!pedido_id(pagamento:pagamentos(gateway_id, metodo))
    `)
    .eq('id', estornoId)
    .single()

  if (!estorno) return { error: 'Solicitação não encontrada.' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((estorno as any).status !== 'pendente') return { error: 'Solicitação não está pendente.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pedido = firstOf((estorno as any).pedido)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pagamento = firstOf((pedido as any)?.pagamento)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metodo = (pagamento as any)?.metodo as string | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gatewayId = (pagamento as any)?.gateway_id as string | null

  // Chamar Asaas se PIX ou cartão
  if (metodo !== 'boleto' && gatewayId) {
    try {
      const { getGateway } = await import('@/lib/pagamentos/gateway')
      const gateway = getGateway()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await gateway.estornarParcial(gatewayId, Number((estorno as any).valor_total))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { error: `Falha no gateway: ${msg}` }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itemIds = ((estorno as any).itens as { item_pedido_id: string }[]).map(i => i.item_pedido_id)

  // Marcar itens como estornados
  const { error: errItems } = await adminClient
    .from('itens_pedido')
    .update({ estornado_em: new Date().toISOString() })
    .in('id', itemIds)

  if (errItems) return { error: errItems.message }

  // Restaurar estoque para itens com variante
  const { data: itensComVariante } = await adminClient
    .from('itens_pedido')
    .select('variante_id')
    .in('id', itemIds)
    .not('variante_id', 'is', null)

  for (const item of itensComVariante ?? []) {
    if (item.variante_id) {
      await adminClient.rpc('restaurar_estoque_variante', { p_variante_id: item.variante_id })
    }
  }

  // Atualizar estorno → aprovado
  const { error: errEstorno } = await adminClient
    .from('pedido_estornos')
    .update({ status: 'aprovado', resolvido_em: new Date().toISOString() })
    .eq('id', estornoId)

  if (errEstorno) return { error: errEstorno.message }

  // Se todos os itens do pedido estão estornados → pedido reembolsado
  const { data: todosItens } = await adminClient
    .from('itens_pedido')
    .select('id, estornado_em')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .eq('pedido_id', (estorno as any).pedido_id)

  const todosEstornados = (todosItens ?? []).every(i => i.estornado_em !== null)
  if (todosEstornados) {
    await adminClient
      .from('pedidos')
      .update({ status: 'reembolsado' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .eq('id', (estorno as any).pedido_id)
  }

  revalidatePath('/admin/pedidos')
  revalidatePath('/pedidos')
  return { success: true }
}

// ── Negar estorno parcial por item (admin) ────────────────────
export async function negarEstornoParcialAction(
  estornoId: string,
  obs_admin: string,
): Promise<{ success: true } | { error: string }> {
  await verificarAdmin()
  if (!obs_admin.trim()) return { error: 'Observação é obrigatória ao negar.' }

  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from('pedido_estornos')
    .update({
      status: 'negado',
      obs_admin: obs_admin.trim(),
      resolvido_em: new Date().toISOString(),
    })
    .eq('id', estornoId)
    .eq('status', 'pendente')

  if (error) return { error: error.message }

  revalidatePath('/admin/pedidos')
  revalidatePath('/pedidos')
  return { success: true }
}
