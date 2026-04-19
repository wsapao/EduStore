import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ConfirmacaoClient } from './ConfirmacaoClient'
import { sincronizarPixExpiradoPedido } from '@/lib/pagamentos/pix'
import type { Pedido, Pagamento, ItemPedido, Produto, Aluno, Ingresso } from '@/types/database'

interface PedidoComDetalhes extends Pedido {
  pagamento: Pagamento | null
  itens: (ItemPedido & { produto: Produto; aluno: Aluno; ingresso: Ingresso | null })[]
}

export default async function PedidoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await sincronizarPixExpiradoPedido(id, user.id)

  // Fetch order
  const { data: pedido } = await supabase
    .from('pedidos')
    .select('*')
    .eq('id', id)
    .eq('responsavel_id', user.id)
    .single<Pedido>()

  if (!pedido) notFound()

  // Fetch payment
  const { data: pagamento } = await supabase
    .from('pagamentos')
    .select('*')
    .eq('pedido_id', id)
    .single<Pagamento>()

  // Fetch items with product + student + ingresso
  const { data: itensRaw } = await supabase
    .from('itens_pedido')
    .select('*, produto:produtos(*), aluno:alunos(*), ingresso:ingressos(id, token, status)')
    .eq('pedido_id', id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itens = (itensRaw ?? []).map((i: any) => ({
    ...i,
    produto: i.produto as Produto,
    aluno: i.aluno as Aluno,
    ingresso: Array.isArray(i.ingresso) ? (i.ingresso[0] ?? null) : (i.ingresso ?? null),
  }))

  const pedidoCompleto: PedidoComDetalhes = {
    ...pedido,
    pagamento: pagamento ?? null,
    itens,
  }

  return <ConfirmacaoClient pedido={pedidoCompleto} />
}
