import { createClient } from '@/lib/supabase/server'
import { enviarEmailPixExpirado } from '@/lib/email/send'

interface PedidoPixRow {
  id: string
  numero: string
  status: string
  total: number
  pagamento: {
    id: string
    status: string
    metodo: string
    pix_expiracao: string | null
  } | null
  responsavel: {
    nome: string
    email: string
  } | null
}

function normalizarPagamento<T>(pagamento: T | T[] | null): T | null {
  return Array.isArray(pagamento) ? (pagamento[0] ?? null) : pagamento
}

function isPixExpirado(expiracao: string | null) {
  return !!expiracao && new Date(expiracao).getTime() <= Date.now()
}

async function marcarPixComoExpirado(pedido: PedidoPixRow) {
  const pagamento = pedido.pagamento
  if (!pagamento || pagamento.metodo !== 'pix') return false
  if (pedido.status !== 'pendente') return false
  if (pagamento.status === 'expirado') return false
  if (!isPixExpirado(pagamento.pix_expiracao)) return false

  const supabase = await createClient()
  const { data: updated, error } = await supabase
    .from('pagamentos')
    .update({ status: 'expirado' })
    .eq('id', pagamento.id)
    .neq('status', 'expirado')
    .select('id')
    .single()

  if (error || !updated) return false

  if (pedido.responsavel?.email) {
    void enviarEmailPixExpirado(pedido.responsavel.email, {
      responsavelNome: pedido.responsavel.nome,
      numeroPedido: pedido.numero,
      total: pedido.total,
      pedidoUrl: pedido.id,
    })
  }

  return true
}

export async function sincronizarPixExpiradoPedido(pedidoId: string, responsavelId: string) {
  const supabase = await createClient()
  const { data: pedido } = await supabase
    .from('pedidos')
    .select(`
      id, numero, status, total,
      pagamento:pagamentos(id, status, metodo, pix_expiracao),
      responsavel:responsaveis(nome, email)
    `)
    .eq('id', pedidoId)
    .eq('responsavel_id', responsavelId)
    .single()

  if (!pedido) return false

  const pedidoRow = pedido as unknown as PedidoPixRow & {
    pagamento: PedidoPixRow['pagamento'] | PedidoPixRow['pagamento'][]
  }

  return marcarPixComoExpirado({
    ...pedidoRow,
    pagamento: normalizarPagamento(pedidoRow.pagamento),
  })
}

export async function sincronizarPixsExpiradosResponsavel(responsavelId: string) {
  const supabase = await createClient()
  const { data: pedidos } = await supabase
    .from('pedidos')
    .select(`
      id, numero, status, total,
      pagamento:pagamentos(id, status, metodo, pix_expiracao),
      responsavel:responsaveis(nome, email)
    `)
    .eq('responsavel_id', responsavelId)
    .eq('status', 'pendente')
    .order('created_at', { ascending: false })

  for (const rawPedido of pedidos ?? []) {
    const pedido = rawPedido as unknown as PedidoPixRow & {
      pagamento: PedidoPixRow['pagamento'] | PedidoPixRow['pagamento'][]
    }
    await marcarPixComoExpirado({
      ...pedido,
      pagamento: normalizarPagamento(pedido.pagamento),
    })
  }
}
