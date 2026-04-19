import { enviarEmailPixExpirado } from '@/lib/email/send'
import { createAdminClient } from '@/lib/supabase/admin'

interface PagamentoExpiradoRow {
  id: string
  pedido_id: string
  pix_expiracao: string | null
  pedido: {
    id: string
    numero: string
    status: string
    total: number
    responsavel: {
      nome: string
      email: string
    } | {
      nome: string
      email: string
    }[] | null
  } | {
    id: string
    numero: string
    status: string
    total: number
    responsavel: {
      nome: string
      email: string
    } | {
      nome: string
      email: string
    }[] | null
  }[] | null
}

function firstOf<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export async function executarExpiracaoPixJob(limit = 200) {
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('pagamentos')
    .select(`
      id,
      pedido_id,
      pix_expiracao,
      pedido:pedidos!inner(
        id,
        numero,
        status,
        total,
        responsavel:responsaveis(nome, email)
      )
    `)
    .eq('metodo', 'pix')
    .eq('status', 'aguardando')
    .lt('pix_expiracao', now)
    .order('pix_expiracao', { ascending: true })
    .limit(limit)

  if (error) {
    throw new Error(`Erro ao buscar PIX expirados: ${error.message}`)
  }

  let expirados = 0
  let emailsEnviados = 0

  for (const row of (data ?? []) as PagamentoExpiradoRow[]) {
    const pedido = firstOf(row.pedido)
    if (!pedido || pedido.status !== 'pendente') continue

    const { data: updated, error: updateError } = await supabase
      .from('pagamentos')
      .update({ status: 'expirado' })
      .eq('id', row.id)
      .eq('status', 'aguardando')
      .select('id')
      .single()

    if (updateError || !updated) continue
    expirados += 1

    const responsavel = firstOf(pedido.responsavel)
    if (responsavel?.email) {
      await enviarEmailPixExpirado(responsavel.email, {
        responsavelNome: responsavel.nome,
        numeroPedido: pedido.numero,
        total: pedido.total,
        pedidoUrl: pedido.id,
      })
      emailsEnviados += 1
    }
  }

  return {
    checkedAt: now,
    expirados,
    emailsEnviados,
    encontrados: data?.length ?? 0,
  }
}
