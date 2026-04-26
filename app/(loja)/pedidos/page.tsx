import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { sincronizarPixsExpiradosResponsavel } from '@/lib/pagamentos/pix'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Pedido, ItemPedido, Produto, Aluno, Pagamento, StatusPedido, MetodoPagamento } from '@/types/database'
import { ArrowLeft, Receipt, CreditCard, ChevronRight, Ticket } from 'lucide-react'

interface PedidoLista extends Pedido {
  itens: (ItemPedido & { produto: Produto; aluno: Aluno })[]
  pagamento: Pagamento | null
}

interface PedidoRaw extends Pedido {
  pagamento: Pagamento | Pagamento[] | null
  itens: Array<ItemPedido & {
    produto: Produto
    aluno: Aluno
  }>
}

function fmtBRL(v: number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

const STATUS_CONFIG: Record<StatusPedido, { label: string; text: string; bg: string; dot: string }> = {
  pendente:    { label: 'Aguardando',  text: '#b45309', bg: '#fef9ec', dot: '#f59e0b' },
  pago:        { label: 'Concluído',   text: '#15803d', bg: '#f0fdf4', dot: '#22c55e' },
  cancelado:   { label: 'Cancelado',   text: '#b91c1c', bg: '#fef2f2', dot: '#ef4444' },
  reembolsado: { label: 'Reembolsado', text: '#374151', bg: '#f3f4f6', dot: '#9ca3af' },
}

const STATUS_PIX_EXPIRADO = {
  label: 'PIX expirado',
  text: '#b91c1c',
  bg: '#fef2f2',
  dot: '#ef4444',
}

const METODO_CONFIG: Record<MetodoPagamento, { label: string; icon: string }> = {
  pix:    { label: 'PIX',    icon: '⚡' },
  cartao: { label: 'Cartão', icon: '💳' },
  boleto: { label: 'Boleto', icon: '📄' },
}

const CAT_ICONS: Record<string, string> = {
  eventos: '🎉', passeios: '🚌', segunda_chamada: '📝',
  materiais: '📚', uniforme: '👕', outros: '📦',
}

export default async function PedidosPage({
  searchParams
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab = 'todos' } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await sincronizarPixsExpiradosResponsavel(user.id)

  const { data: pedidosRaw } = await supabase
    .from('pedidos')
    .select(`
      *,
      pagamento:pagamentos(*),
      itens:itens_pedido(
        *,
        produto:produtos(*),
        aluno:alunos(*),
        ingresso:ingressos(id, token, status)
      )
    `)
    .eq('responsavel_id', user.id)
    .order('created_at', { ascending: false })

  const todosPedidos: PedidoLista[] = ((pedidosRaw ?? []) as PedidoRaw[]).map((p) => ({
    ...p,
    pagamento: Array.isArray(p.pagamento) ? (p.pagamento[0] ?? null) : (p.pagamento ?? null),
    itens: (p.itens ?? []).map((i) => ({
      ...i,
      produto: i.produto as Produto,
      aluno: i.aluno as Aluno,
    })),
  }))

  // Filtrar com base na aba
  const pedidos = todosPedidos.filter(p => {
    if (tab === 'pendentes') return p.status === 'pendente' && p.pagamento?.status !== 'expirado'
    if (tab === 'concluidos') return p.status === 'pago'
    return true
  })

  return (
    <div style={{ background: '#0a1220', minHeight: '100vh', paddingBottom: 100 }}>
      {/* Mockup phone container wrapper not needed, we apply directly to root context */}
      <div style={{ background: '#f0f2f8', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header Minimalista */}
        <div style={{
          height: 52, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(0,0,0,.07)'
        }}>
          <Link href="/loja" style={{
            width: 32, height: 32, borderRadius: 10, border: '1.5px solid rgba(0,0,0,.08)',
            background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </Link>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 800, color: '#0a1628', letterSpacing: '-.02em' }}>
            Meus pedidos
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af' }}>
            {pedidos.length} {pedidos.length === 1 ? 'pedido' : 'pedidos'}
          </div>
        </div>

        {/* Tabs - Mantidas mas adaptadas */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '10px 14px 4px' }} className="no-scrollbar">
          {[
            { id: 'todos', label: 'Todos', icon: '✦' },
            { id: 'pendentes', label: 'Pendentes', icon: '⏰' },
            { id: 'concluidos', label: 'Concluídos', icon: '✓' }
          ].map(t => {
            const isActive = tab === t.id
            const count = t.id === 'todos' ? todosPedidos.length 
              : t.id === 'pendentes' ? todosPedidos.filter(p => p.status === 'pendente' && p.pagamento?.status !== 'expirado').length 
              : todosPedidos.filter(p => p.status === 'pago').length

            return (
              <Link 
                key={t.id}
                href={`/pedidos?tab=${t.id}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '6px 11px', borderRadius: 10,
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                  border: isActive ? '1.5px solid transparent' : '1.5px solid rgba(0,0,0,.07)',
                  background: isActive ? '#f59e0b' : 'white',
                  color: isActive ? '#78350f' : '#374151',
                  boxShadow: isActive ? '0 3px 10px rgba(245,158,11,.4)' : 'none',
                  textDecoration: 'none'
                }}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
                <span style={{
                  fontSize: 9, fontWeight: 800, borderRadius: 99, padding: '1px 4px', lineHeight: 1.5,
                  background: isActive ? 'rgba(0,0,0,.12)' : '#f0f2f8',
                  color: isActive ? '#78350f' : '#9ca3af'
                }}>
                  {count}
                </span>
              </Link>
            )
          })}
        </div>

        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pedidos.length === 0 && (
            <div style={{ marginTop: 16 }}>
              <EmptyState
                icon="🛍️"
                title={tab === 'todos' ? "Nenhum pedido" : "Nenhum pedido encontrado"}
                description={tab === 'todos' ? "Seus pedidos vão aparecer aqui depois da compra." : "Tente mudar a aba de filtro."}
                actionLabel="🏪 Ver produtos"
                actionHref="/loja"
              />
            </div>
          )}

          {pedidos.map((pedido) => {
            const isAguardando = pedido.status === 'pendente' && pedido.pagamento?.status !== 'expirado'
            const isPago = pedido.status === 'pago'
            const isCancelado = pedido.status === 'cancelado' || (pedido.status === 'pendente' && pedido.pagamento?.status === 'expirado')

            const statusClass = isAguardando ? 'aguardando' : isPago ? 'pago' : 'cancelado'
            const statusLabel = isAguardando ? 'AGUARDANDO' : isPago ? 'PAGO' : 'CANCELADO'
            
            const pillColors: Record<string, { bg: string, text: string, dot: string }> = {
              aguardando: { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
              pago: { bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
              cancelado: { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' }
            }

            const c = pillColors[statusClass]
            const metodoCfg = pedido.metodo_pagamento ? METODO_CONFIG[pedido.metodo_pagamento] : null

            return (
              <Link
                href={`/pedido/${pedido.id}`}
                key={pedido.id}
                style={{
                  background: 'white', border: '1.5px solid rgba(0,0,0,.07)', borderRadius: 18,
                  overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.06)', display: 'block', textDecoration: 'none'
                }}
              >
                <div style={{ padding: '11px 13px', borderBottom: '1px solid rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 99,
                    fontSize: 9, fontWeight: 800, letterSpacing: '.04em', background: c.bg, color: c.text
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.dot }}></span>
                    {statusLabel}
                  </div>
                  {metodoCfg && (
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 3 }}>
                      {metodoCfg.icon} {metodoCfg.label}
                    </div>
                  )}
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', fontFamily: 'monospace' }}>
                      #{pedido.numero.replace('PED-', '')}
                    </div>
                    <div style={{ fontSize: 9, color: '#9ca3af' }}>
                      {fmtData(pedido.data_criacao).split(' de ')[0]} de {fmtData(pedido.data_criacao).split(' de ')[1].substring(0,3)}.
                    </div>
                  </div>
                </div>

                <div style={{ padding: '10px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pedido.itens.map((item) => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0f2f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>
                        {item.produto.icon ?? CAT_ICONS[item.produto.categoria] ?? '📦'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#0a1628', lineHeight: 1.2 }}>
                          {item.produto.nome}
                        </div>
                        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1, fontWeight: 600 }}>
                          {item.aluno.nome.split(' ')[0]} {item.variante && `· Tm ${item.variante}`}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#0a1628' }}>
                        {fmtBRL(item.preco_unitario)}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ padding: '10px 13px', background: '#fafbff', borderTop: '1px solid rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>
                    Total · {pedido.itens.length} {pedido.itens.length === 1 ? 'item' : 'itens'}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: '#0a1628', letterSpacing: '-.03em' }}>
                    {fmtBRL(pedido.total)}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
