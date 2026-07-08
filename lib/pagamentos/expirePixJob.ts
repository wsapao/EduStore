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

/**
 * Janela de carência após a expiração do PIX antes de tratar o pedido como
 * abandonado (liberar estoque/voucher e cancelar). Durante a carência o pedido
 * segue 'pendente' e o responsável pode renovar o PIX (renovarPixAction) sem
 * perder a reserva. Passada a carência, é claramente um abandono.
 */
const CARENCIA_ABANDONO_MS = 2 * 60 * 60 * 1000 // 2h

export async function executarExpiracaoPixJob(limit = 200) {
  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const agora = Date.now()

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
  let abandonos = 0

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

    // Passada a carência, o pedido é abandonado: cancela e devolve estoque das
    // variantes + uso do voucher (senão o produto fica "esgotado" sem venda). Só
    // faz isso se este job foi quem transicionou o pedido (rowcount>0), evitando
    // devolução dupla e sem competir com uma confirmação de pagamento em corrida.
    const expiracaoMs = row.pix_expiracao ? new Date(row.pix_expiracao).getTime() : 0
    const abandonado = expiracaoMs > 0 && (agora - expiracaoMs) >= CARENCIA_ABANDONO_MS

    if (abandonado) {
      const { data: pedidoRows } = await supabase
        .from('pedidos')
        .update({ status: 'cancelado' })
        .eq('id', pedido.id)
        .eq('status', 'pendente')
        .select('voucher_id')

      if (pedidoRows && pedidoRows.length > 0) {
        const { data: itens } = await supabase
          .from('itens_pedido')
          .select('variante_id')
          .eq('pedido_id', pedido.id)

        for (const item of itens ?? []) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const varianteId = (item as any).variante_id as string | null
          if (!varianteId) continue
          await supabase.rpc('restaurar_estoque_variante', { p_variante_id: varianteId })
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const voucherId = (pedidoRows[0] as any).voucher_id as string | null
        if (voucherId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await supabase.rpc('decrementar_uso_voucher' as any, { p_voucher_id: voucherId })
        }
        abandonos += 1
      }
    }

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
    abandonos,
    emailsEnviados,
    encontrados: data?.length ?? 0,
  }
}
