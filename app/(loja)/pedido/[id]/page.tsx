import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ConfirmacaoClient } from './ConfirmacaoClient'
import { sincronizarPixExpiradoPedido } from '@/lib/pagamentos/pix'
import type { Pedido, Pagamento, ItemPedido, Produto, Aluno, Ingresso, PedidoEstorno } from '@/types/database'

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

  // 4 queries em paralelo + sincronização pix (sem bloquear as queries)
  const [, { data: pedido }, { data: pagamento }, { data: itensRaw }, { data: estornoRaw }] = await Promise.all([
    sincronizarPixExpiradoPedido(id, user.id),
    supabase.from('pedidos').select('*').eq('id', id).single<Pedido>(),
    supabase.from('pagamentos').select('*').eq('pedido_id', id).single<Pagamento>(),
    supabase.from('itens_pedido')
      .select('*, produto:produtos(*), aluno:alunos(*), ingresso:ingressos(id, token, status)')
      .eq('pedido_id', id),
    supabase
      .from('pedido_estornos')
      .select('id, pedido_id, status, motivo, obs_admin, valor_total, created_at')
      .eq('pedido_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  // autorização verificada em JS após fetch paralelo
  if (!pedido || pedido.responsavel_id !== user.id) notFound()

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

  const estorno = estornoRaw as PedidoEstorno | null

  // Mensagem pós-compra customizada pela escola (config opcional)
  const { data: configRaw } = await supabase
    .from('escola_configuracoes')
    .select('mensagem_pos_compra')
    .eq('escola_id', pedido.escola_id)
    .maybeSingle<{ mensagem_pos_compra: string | null }>()

  const mensagemPosCompra = configRaw?.mensagem_pos_compra ?? null

  return (
    <ConfirmacaoClient
      pedido={pedidoCompleto}
      estorno={estorno}
      mensagemPosCompra={mensagemPosCompra}
    />
  )
}
