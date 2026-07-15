'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { enviarEmailIngresso } from '@/lib/email/send'
import { enviarEmailResetSenhaAdmin, enviarEmailPedidoCancelado } from '@/lib/email/send'
import { resolverTemplatePedido } from '@/lib/email/resolver-template'
import { SITE_URL } from '@/lib/email/resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserPermissions } from '@/lib/permissoes'

// Guard das actions somente-admin (reset/definição de senha de responsável:
// devolvem capacidade de assumir a conta de qualquer responsável — inclusive
// de admins —, então não são delegáveis por permissão de papel).
async function verificarAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    throw new Error('Acesso negado.')
  }
  return { supabase, user }
}

// Guard por permissão de papel (papel_permissoes): qualquer uma das chaves
// concede. role=admin passa direto — papéis Admin foram seedados antes de
// chaves novas (ex.: pagamentos.confirmar) e não as têm no banco.
//
// Após este guard as mutations rodam via service role (createAdminClient):
// as policies de escrita do RLS ainda exigem is_admin(), então o client de
// sessão de um papel como Financeiro afetaria 0 linhas. O guard é a única
// barreira — cada action deve exigir exatamente a chave do seu módulo.
async function verificarPermissao(...chaves: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Acesso negado.')
  if (user.app_metadata?.role !== 'admin') {
    const permissoes = await getUserPermissions(supabase)
    if (!chaves.some((chave) => permissoes.includes(chave))) {
      throw new Error('Acesso negado.')
    }
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
  await verificarPermissao('pagamentos.confirmar')
  const db = createAdminClient()

  const now = new Date().toISOString()

  // Atualiza pedido — só transiciona se ainda pendente (idempotência). Sem essa
  // guarda, cada clique reconfirmava e re-emitia ingressos.
  const { data: pedidoRows, error: pedidoError } = await db
    .from('pedidos')
    .update({ status: 'pago', data_pagamento: now })
    .eq('id', pedidoId)
    .eq('status', 'pendente')
    .select('id')

  if (pedidoError) {
    console.error('[confirmarPagamentoAction] update pedido failed', { pedidoId, message: pedidoError.message })
    return { success: false, error: pedidoError.message }
  }
  if (!pedidoRows || pedidoRows.length === 0) {
    console.warn('[confirmarPagamentoAction] pedido não estava pendente (zero rows)', { pedidoId })
    return { success: false, error: 'Pedido não está pendente (já confirmado, cancelado ou inexistente).' }
  }

  // Atualiza pagamento
  await db
    .from('pagamentos')
    .update({ status: 'confirmado', webhook_confirmado_em: now })
    .eq('pedido_id', pedidoId)

  // Gera ingressos para itens que possuem gera_ingresso = true.
  // RPC privilegiada (SECURITY DEFINER) — roda via service role.
  await db.rpc('gerar_ingressos_pedido', { p_pedido_id: pedidoId })

  revalidatePath('/admin')
  revalidatePath('/admin/pedidos')
  revalidatePath(`/pedido/${pedidoId}`)
  revalidatePath('/pedidos')

  // Envia email com ingressos emitidos. Aguardamos (await) porque em serverless o
  // processo pode congelar após a resposta e perder promises soltas (fire-and-forget).
  // Erros de e-mail são capturados aqui e não derrubam a confirmação do pagamento.
  try {
    const { data: ingressos } = await db
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
        (await db.from('itens_pedido').select('id').eq('pedido_id', pedidoId)).data?.map(i => i.id) ?? []
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
  } catch (err) {
    console.error('[confirmarPagamentoAction] falha ao enviar e-mails de ingresso', err)
  }

  return { success: true }
}

// ── Cancelar pedido ───────────────────────────────────────────────────────────
const MOTIVO_CANCELAMENTO_ADMIN = 'Cancelamento realizado pela administração da escola'

export async function cancelarPedidoAction(pedidoId: string) {
  await verificarPermissao('pedidos.cancelar')
  const adminClient = createAdminClient()

  const { data: itens } = await adminClient
    .from('itens_pedido')
    .select('variante_id')
    .eq('pedido_id', pedidoId)

  // Dados p/ o e-mail — lidos ANTES do cancel (pagamentos vira 'falhou' abaixo)
  const { data: pedidoEmail } = await adminClient
    .from('pedidos')
    .select('numero, total, escola_id, responsavel:responsaveis(nome, email)')
    .eq('id', pedidoId)
    .single()
  const { data: pagamentoAntes } = await adminClient
    .from('pagamentos')
    .select('status')
    .eq('pedido_id', pedidoId)
    .maybeSingle()

  // Guarda de status + idempotência: só cancela pedidos ainda pendentes/pagos e
  // exige que UMA linha tenha de fato transicionado. Sem isso, cada clique
  // re-executava restaurar_estoque_variante e inflava o estoque.
  const { data: pedidoRows, error } = await adminClient
    .from('pedidos')
    .update({ status: 'cancelado' })
    .eq('id', pedidoId)
    .in('status', ['pendente', 'pago'])
    .select('id')

  if (error) {
    console.error('[cancelarPedidoAction] update pedido failed', { pedidoId, message: error.message })
    return { success: false, error: error.message }
  }
  if (!pedidoRows || pedidoRows.length === 0) {
    // Já cancelado/reembolsado ou inexistente — não restaura estoque de novo.
    console.warn('[cancelarPedidoAction] pedido não estava pendente/pago (zero rows)', { pedidoId })
    return { success: false, error: 'Pedido não pode ser cancelado (já cancelado/reembolsado ou inexistente).' }
  }

  await adminClient
    .from('pagamentos')
    .update({ status: 'falhou' })
    .eq('pedido_id', pedidoId)

  for (const item of itens ?? []) {
    if (!item.variante_id) continue
    await adminClient.rpc('restaurar_estoque_variante', { p_variante_id: item.variante_id })
  }

  // Invalida ingressos emitidos associados ao pedido
  await adminClient.rpc('cancelar_ingressos_pedido', { p_pedido_id: pedidoId })

  // Envia e-mail de cancelamento aguardando a conclusão — em serverless o
  // processo pode congelar após a resposta e engolir promises soltas.
  // Erros são capturados aqui e não derrubam o cancelamento.
  await (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const respRaw = (pedidoEmail as any)?.responsavel
      const responsavel = (Array.isArray(respRaw) ? respRaw[0] : respRaw) as { nome: string; email: string } | null
      if (!pedidoEmail || !responsavel?.email) return

      let escolaNome: string | null = null
      if (pedidoEmail.escola_id) {
        const { data: escola } = await adminClient
          .from('escolas').select('nome').eq('id', pedidoEmail.escola_id).maybeSingle()
        escolaNome = escola?.nome ?? null
      }

      const pedidoUrl = `${SITE_URL}/pedido/${pedidoId}`
      const { assunto, aberturaHtml } = await resolverTemplatePedido({
        escolaId: pedidoEmail.escola_id,
        tipo: 'pedido_cancelado',
        vars: {
          nome_responsavel: responsavel.nome,
          numero_pedido: pedidoEmail.numero,
          link_pedido: pedidoUrl,
          nome_escola: escolaNome ?? '',
          motivo: MOTIVO_CANCELAMENTO_ADMIN,
        },
        client: adminClient,
      })

      await enviarEmailPedidoCancelado(responsavel.email, {
        assunto,
        aberturaHtml,
        responsavelNome: responsavel.nome,
        numeroPedido: pedidoEmail.numero,
        total: pedidoEmail.total,
        motivo: MOTIVO_CANCELAMENTO_ADMIN,
        foiPago: pagamentoAntes?.status === 'confirmado',
        pedidoUrl,
        escolaNome,
      })
    } catch (err) {
      console.error('[cancelarPedidoAction] Erro ao enviar e-mail de cancelamento:', err)
    }
  })()

  revalidatePath('/admin')
  revalidatePath('/admin/pedidos')
  revalidatePath('/pedidos')

  return { success: true }
}

// ── Validar ingresso no check-in ──────────────────────────────────────────────
export async function validarIngressoAction(token: string, validadoPor: string) {
  // validar_ingresso é SECURITY DEFINER e queima o ingresso (UPDATE usado_em).
  // A migration 20260715 revoga o EXECUTE de anon/authenticated e concede só ao
  // service_role, então a chamada roda via admin client — verificarPermissao é
  // a única barreira, impedindo POST /rpc/validar_ingresso direto por um pai.
  await verificarPermissao('checkin.usar')

  const { data, error } = await createAdminClient()
    .rpc('validar_ingresso', { p_token: token, p_validado_por: validadoPor })

  if (error) return { ok: false, motivo: error.message }

  revalidatePath('/admin/checkin')

  return data as { ok: boolean; motivo: string; usado_em?: string; validado_por?: string }
}

// ── Toggle produto ativo ──────────────────────────────────────────────────────
export async function toggleProdutoAtivoAction(produtoId: string, ativo: boolean) {
  await verificarPermissao('produtos.editar')

  const { data: rows, error } = await createAdminClient()
    .from('produtos')
    .update({ ativo: !ativo })
    .eq('id', produtoId)
    .select('id')

  if (error) {
    console.error('[toggleProdutoAtivoAction] update failed', { produtoId, message: error.message })
    return { success: false, error: error.message }
  }
  if (!rows || rows.length === 0) {
    console.error('[toggleProdutoAtivoAction] produto não atualizado (zero rows)', { produtoId })
    return { success: false, error: 'Produto não encontrado ou sem permissão.' }
  }

  revalidatePath('/admin/produtos')
  revalidatePath('/loja')

  return { success: true }
}

// ── Criar produto ─────────────────────────────────────────────────────────────
export async function criarProdutoAction(formData: FormData) {
  const { user } = await verificarPermissao('produtos.criar')
  const db = createAdminClient()

  // Busca escola_id do membro da equipe
  const { data: resp } = await db
    .from('responsaveis').select('escola_id').eq('id', user.id).single()
  if (!resp?.escola_id) return { success: false, error: 'Usuário sem escola vinculada.' }

  let imagem_url: string | null = null
  const imgFile = formData.get('imagem_arquivo') as File | null
  if (imgFile && imgFile.size > 0) {
    const ext = imgFile.name.split('.').pop() || 'png'
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`
    const { data: uploadData, error: uploadError } = await db.storage
      .from('produtos-imagens')
      .upload(fileName, imgFile)
    if (!uploadError && uploadData) {
      const { data: publicUrlData } = db.storage.from('produtos-imagens').getPublicUrl(uploadData.path)
      imagem_url = publicUrlData.publicUrl
    }
  }

  const payload = parseProdutoForm(formData, resp.escola_id)
  if (imagem_url) payload.imagem_url = imagem_url

  const { data, error } = await db.from('produtos').insert(payload).select('id').single()
  if (error) return { success: false, error: error.message }

  await syncProdutoVariantes(db, data.id, parseVariantesForm(formData))

  revalidatePath('/admin/produtos')
  revalidatePath('/loja')
  return { success: true, id: data.id }
}

// ── Editar produto ────────────────────────────────────────────────────────────
export async function editarProdutoAction(produtoId: string, formData: FormData) {
  await verificarPermissao('produtos.editar')
  const db = createAdminClient()

  let imagem_url: string | null = null
  const imgFile = formData.get('imagem_arquivo') as File | null
  if (imgFile && imgFile.size > 0) {
    const ext = imgFile.name.split('.').pop() || 'png'
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`
    const { data: uploadData, error: uploadError } = await db.storage
      .from('produtos-imagens')
      .upload(fileName, imgFile)
    if (!uploadError && uploadData) {
      const { data: publicUrlData } = db.storage.from('produtos-imagens').getPublicUrl(uploadData.path)
      imagem_url = publicUrlData.publicUrl
    }
  }

  const payload = parseProdutoForm(formData)
  if (imagem_url) payload.imagem_url = imagem_url

  const { data: rows, error } = await db
    .from('produtos')
    .update(payload)
    .eq('id', produtoId)
    .select('id')
  if (error) {
    console.error('[editarProdutoAction] update failed', { produtoId, message: error.message })
    return { success: false, error: error.message }
  }
  if (!rows || rows.length === 0) {
    console.error('[editarProdutoAction] produto não atualizado (zero rows)', { produtoId })
    return { success: false, error: 'Produto não encontrado ou sem permissão.' }
  }

  await syncProdutoVariantes(db, produtoId, parseVariantesForm(formData))

  revalidatePath('/admin/produtos')
  revalidatePath(`/admin/produtos/${produtoId}/editar`)
  revalidatePath('/loja')
  return { success: true }
}

// ── Duplicar produto ──────────────────────────────────────────────────────────
export async function duplicarProdutoAction(produtoId: string) {
  await verificarPermissao('produtos.criar')
  const db = createAdminClient()

  const { data: original } = await db
    .from('produtos').select('*').eq('id', produtoId).single()
  if (!original) return { success: false, error: 'Produto não encontrado.' }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, created_at, ...rest } = original
  const { data, error } = await db
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

  // Converte preço: "25,90" ou "25.90" → 25.90
  const precoRaw = (formData.get('preco') as string ?? '0').replace(',', '.')
  const preco    = parseFloat(precoRaw)
  
  const precoPromocionalRaw = (formData.get('preco_promocional') as string ?? '').replace(',', '.')
  const preco_promocional = precoPromocionalRaw ? parseFloat(precoPromocionalRaw) : null

  const gera_ingresso = formData.get('gera_ingresso') === 'on'
  const aceita_vouchers = formData.get('aceita_vouchers') === 'on'
  const capacidadeRaw = formData.get('capacidade') as string
  const capacidade    = gera_ingresso && capacidadeRaw ? parseInt(capacidadeRaw) || null : null

  const prazo_compra_raw = formData.get('prazo_compra') as string || null
  // datetime-local não carrega fuso: interpretamos como horário de Brasília
  // (UTC-3, sem horário de verão no Brasil desde 2019) anexando o offset — senão
  // o Postgres grava o valor como UTC e o countdown/urgência desvia 3h.
  const prazo_compra = prazo_compra_raw
    ? `${prazo_compra_raw.length === 16 ? `${prazo_compra_raw}:00` : prazo_compra_raw}-03:00`
    : null
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
  db: ReturnType<typeof createAdminClient>,
  produtoId: string,
  variantes: VariantePayload[]
) {
  await db.from('produto_variantes').delete().eq('produto_id', produtoId)

  if (variantes.length === 0) return

  await db.from('produto_variantes').insert(
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
  await verificarPermissao('produtos.editar')

  const { data: rows, error } = await createAdminClient()
    .from('produtos')
    .update({ esgotado: !esgotado })
    .eq('id', produtoId)
    .select('id')

  if (error) {
    console.error('[toggleEsgotadoAction] update failed', { produtoId, message: error.message })
    return { success: false, error: error.message }
  }
  if (!rows || rows.length === 0) {
    console.error('[toggleEsgotadoAction] produto não atualizado (zero rows)', { produtoId })
    return { success: false, error: 'Produto não encontrado ou sem permissão.' }
  }

  revalidatePath('/admin/produtos')
  revalidatePath('/loja')

  return { success: true }
}

// ── Excluir produto ───────────────────────────────────────────────────────────
export async function excluirProdutoAction(produtoId: string) {
  await verificarPermissao('produtos.excluir')
  const db = createAdminClient()

  // Impede exclusão se há pedidos com este produto
  const { count } = await db
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
  await db.from('produto_variantes').delete().eq('produto_id', produtoId)

  const { error } = await db.from('produtos').delete().eq('id', produtoId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/produtos')
  revalidatePath('/loja')
  return { success: true }
}

// ── Vincular responsável ↔ aluno ─────────────────────────────────────────────
export async function vincularAlunoResponsavelAction(formData: FormData) {
  await verificarPermissao('alunos.editar', 'responsaveis.editar')
  const db = createAdminClient()

  const responsavelId = (formData.get('responsavel_id') as string | null)?.trim()
  const alunoId = (formData.get('aluno_id') as string | null)?.trim()

  if (!responsavelId || !alunoId) {
    return
  }

  const [{ data: responsavel }, { data: aluno }] = await Promise.all([
    db.from('responsaveis').select('id, escola_id').eq('id', responsavelId).single(),
    db.from('alunos').select('id, escola_id').eq('id', alunoId).single(),
  ])

  if (!responsavel || !aluno) {
    return
  }

  if (!responsavel.escola_id || responsavel.escola_id !== aluno.escola_id) {
    return
  }

  const { data: existente } = await db
    .from('responsavel_aluno')
    .select('responsavel_id')
    .eq('responsavel_id', responsavelId)
    .eq('aluno_id', alunoId)
    .maybeSingle()

  if (existente) {
    return
  }

  const { error } = await db
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
  await verificarPermissao('alunos.editar', 'responsaveis.editar')

  const responsavelId = (formData.get('responsavel_id') as string | null)?.trim()
  const alunoId = (formData.get('aluno_id') as string | null)?.trim()

  if (!responsavelId || !alunoId) {
    return
  }

  const { error } = await createAdminClient()
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
export type ResetSenhaResult =
  | { success: true; link: string; emailSent: boolean; email: string }
  | { success: false; error: string }

export async function resetSenhaResponsavelAction(
  formData: FormData,
): Promise<ResetSenhaResult> {
  try {
    await verificarAdmin()
  } catch {
    return { success: false, error: 'Acesso negado.' }
  }

  const responsavelId = (formData.get('responsavel_id') as string | null)?.trim()
  if (!responsavelId) return { success: false, error: 'Responsável inválido.' }

  const supabase = await createClient()
  const { data: responsavel } = await supabase
    .from('responsaveis')
    .select('id, nome, email')
    .eq('id', responsavelId)
    .single()

  if (!responsavel?.email) {
    return { success: false, error: 'Responsável sem e-mail cadastrado.' }
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email: responsavel.email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/nova-senha`,
    },
  })

  const link = data?.properties?.action_link
  if (error || !link) {
    return {
      success: false,
      error: error?.message ?? 'Falha ao gerar o link de redefinição.',
    }
  }

  // Tenta entregar por e-mail, mas não depende disso: o link é devolvido ao
  // admin para envio manual (ex.: WhatsApp) caso o e-mail não esteja configurado.
  const emailSent = await enviarEmailResetSenhaAdmin(responsavel.email, {
    responsavelNome: responsavel.nome,
    resetUrl: link,
  })

  revalidatePath('/admin/responsaveis')

  return { success: true, link, emailSent, email: responsavel.email }
}

// ── Definir senha do responsável direto pelo painel ──────────────────────────
export type DefinirSenhaResult =
  | { success: true; email: string }
  | { success: false; error: string }

export async function definirSenhaResponsavelAction(
  formData: FormData,
): Promise<DefinirSenhaResult> {
  try {
    await verificarAdmin()
  } catch {
    return { success: false, error: 'Acesso negado.' }
  }

  const responsavelId = (formData.get('responsavel_id') as string | null)?.trim()
  const senha = (formData.get('senha') as string | null) ?? ''
  if (!responsavelId) return { success: false, error: 'Responsável inválido.' }
  if (senha.length < 6) {
    return { success: false, error: 'A senha deve ter ao menos 6 caracteres.' }
  }

  const supabase = await createClient()
  const { data: responsavel } = await supabase
    .from('responsaveis')
    .select('id, email')
    .eq('id', responsavelId)
    .single()

  if (!responsavel?.email) {
    return { success: false, error: 'Responsável sem e-mail cadastrado.' }
  }

  const adminClient = createAdminClient()
  // email_confirm: true garante que o responsável consiga logar mesmo se o
  // e-mail nunca tiver sido confirmado (caso comum nos cadastros importados).
  const { error } = await adminClient.auth.admin.updateUserById(responsavelId, {
    password: senha,
    email_confirm: true,
  })

  if (error) {
    return { success: false, error: error.message ?? 'Falha ao definir a senha.' }
  }

  revalidatePath('/admin/responsaveis')

  return { success: true, email: responsavel.email }
}

// ── Categorias ────────────────────────────────────────────────────────────────
export async function criarCategoriaAction(formData: FormData) {
  const { user } = await verificarPermissao('categorias.gerenciar')
  const db = createAdminClient()
  const { data: resp, error: respErr } = await db
    .from('responsaveis')
    .select('escola_id')
    .eq('id', user.id)
    .maybeSingle()
  if (respErr) {
    console.error('[criarCategoriaAction] falha ao buscar escola do admin', {
      userId: user.id,
      code: respErr.code,
      message: respErr.message,
      details: respErr.details,
      hint: respErr.hint,
    })
    return { success: false, error: 'Erro ao identificar escola do admin.' }
  }
  if (!resp?.escola_id) {
    console.error('[criarCategoriaAction] usuário sem responsavel vinculado', { userId: user.id })
    return { success: false, error: 'Usuário sem escola vinculada.' }
  }

  const nome = (formData.get('nome') as string).trim()
  const icone = (formData.get('icone') as string).trim() || '🏷️'
  const tem_variantes = formData.get('tem_variantes') === 'on'

  if (!nome) return { success: false, error: 'Nome da categoria é obrigatório.' }

  // Retorna a row criada pra o cliente atualizar o select inline (UX do form de produto).
  const { data, error } = await db
    .from('categorias_produto')
    .insert({
      escola_id: resp.escola_id,
      nome,
      icone,
      tem_variantes,
      ativo: true,
    })
    .select('id, escola_id, nome, icone, tem_variantes, ativo, created_at')
    .single()

  if (error) {
    console.error('[criarCategoriaAction] insert failed', {
      escolaId: resp.escola_id,
      nome,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    })
    return { success: false, error: error.message }
  }
  if (!data?.id) {
    console.error('[criarCategoriaAction] insert returned no data', { escolaId: resp.escola_id, nome })
    return { success: false, error: 'Categoria não foi salva (resposta vazia).' }
  }

  console.log('[criarCategoriaAction] categoria criada', { id: data.id, nome: data.nome, escolaId: data.escola_id })

  revalidatePath('/admin/produtos/categorias')
  revalidatePath('/admin/produtos/novo')
  return { success: true, categoria: data }
}

export async function toggleCategoriaAction(id: string, ativo: boolean) {
  await verificarPermissao('categorias.gerenciar')
  const { error } = await createAdminClient().from('categorias_produto').update({ ativo: !ativo }).eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/produtos/categorias')
  return { success: true }
}

export async function excluirCategoriaAction(id: string) {
  await verificarPermissao('categorias.gerenciar')
  const { error } = await createAdminClient().from('categorias_produto').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/produtos/categorias')
  return { success: true }
}

// ── Vouchers ──────────────────────────────────────────────────────────────────
export async function criarVoucherAction(formData: FormData) {
  const { user } = await verificarPermissao('vouchers.gerenciar')
  const db = createAdminClient()
  const { data: resp } = await db.from('responsaveis').select('escola_id').eq('id', user.id).single()
  if (!resp?.escola_id) return { success: false, error: 'Usuário sem escola vinculada.' }

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

  const { error } = await db.from('vouchers').insert(inserts)

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Um cupom com esse código já existe.' }
    return { success: false, error: error.message }
  }
  
  revalidatePath('/admin/vouchers')
  return { success: true }
}

export async function toggleVoucherAction(id: string, ativo: boolean) {
  await verificarPermissao('vouchers.gerenciar')
  const { error } = await createAdminClient().from('vouchers').update({ ativo: !ativo }).eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/vouchers')
  return { success: true }
}

export async function excluirVoucherAction(id: string) {
  await verificarPermissao('vouchers.gerenciar')
  const { error } = await createAdminClient().from('vouchers').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/vouchers')
  return { success: true }
}

export async function excluirVouchersLoteAction(ids: string[]) {
  await verificarPermissao('vouchers.gerenciar')
  const { error } = await createAdminClient().from('vouchers').delete().in('id', ids)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/vouchers')
  return { success: true }
}

// ── Estornar recarga confirmada (admin only) ──────────────────
export async function estornarRecargaAdminAction(recargaId: string): Promise<{ success: true; saldoApos: number } | { error: string }> {
  const { user } = await verificarPermissao('cantina.gerenciar')
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
  const { user } = await verificarPermissao('cantina.gerenciar')
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
  const { user } = await verificarPermissao('cantina.gerenciar')
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

  // Lock lógico: "reivindica" a solicitação com UPDATE condicional antes de
  // chamar o Asaas. Só quem transiciona pendente→processando segue para o refund,
  // evitando duplo estorno em duplo clique / corrida.
  const { data: claimRows, error: claimErr } = await adminClient
    .from('cantina_solicitacoes_estorno')
    .update({ status: 'processando' } as any)
    .eq('id', solicitacaoId)
    .eq('status', 'pendente')
    .select('id')
  if (claimErr) return { error: claimErr.message }
  if (!claimRows || claimRows.length === 0) {
    return { error: 'Solicitação já está sendo processada ou não está mais pendente.' }
  }

  // Estornar no Asaas PRIMEIRO (PIX/cartão). Boleto não tem estorno via API.
  if (gatewayId && metodo !== 'boleto') {
    try {
      const { getGateway } = await import('@/lib/pagamentos/gateway')
      const gateway = getGateway('cantina')
      await gateway.estornarPagamento(gatewayId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Devolve a solicitação para 'pendente' para permitir nova tentativa.
      await adminClient
        .from('cantina_solicitacoes_estorno')
        .update({ status: 'pendente' } as any)
        .eq('id', solicitacaoId)
        .eq('status', 'processando')
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
  const { user } = await verificarPermissao('cantina.gerenciar')
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
  await verificarPermissao('pedidos.estornar')
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

  // Lock lógico contra estorno duplo (duplo clique/corrida): "reivindica" a
  // solicitação transicionando pendente→aprovado ANTES de chamar o Asaas. Só quem
  // conseguiu a transição (rowcount>0) segue para o refund. O CHECK da tabela só
  // permite pendente/aprovado/negado, então não usamos um estado intermediário.
  const { data: claimRows, error: claimErr } = await adminClient
    .from('pedido_estornos')
    .update({ status: 'aprovado', resolvido_em: new Date().toISOString() })
    .eq('id', estornoId)
    .eq('status', 'pendente')
    .select('id')
  if (claimErr) return { error: claimErr.message }
  if (!claimRows || claimRows.length === 0) {
    return { error: 'Solicitação já está sendo processada ou não está mais pendente.' }
  }

  // Chamar Asaas se PIX ou cartão
  if (metodo !== 'boleto' && gatewayId) {
    try {
      const { getGateway } = await import('@/lib/pagamentos/gateway')
      const gateway = getGateway()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await gateway.estornarParcial(gatewayId, Number((estorno as any).valor_total))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Reverte a reivindicação para permitir nova tentativa (nenhum item foi
      // marcado ainda; o Asaas não processou).
      await adminClient
        .from('pedido_estornos')
        .update({ status: 'pendente', resolvido_em: null })
        .eq('id', estornoId)
        .eq('status', 'aprovado')
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

  // O estorno já foi marcado 'aprovado' na reivindicação (lock acima).

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
  await verificarPermissao('pedidos.estornar')
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
