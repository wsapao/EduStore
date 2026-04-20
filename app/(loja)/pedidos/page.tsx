import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { sincronizarPixsExpiradosResponsavel } from '@/lib/pagamentos/pix'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Pedido, ItemPedido, Produto, Aluno, Pagamento, StatusPedido, MetodoPagamento } from '@/types/database'

// ── tipos ────────────────────────────────────────────────────────────────────
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

// ── helpers visuais ───────────────────────────────────────────────────────────
function fmtBRL(v: number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

const STATUS_CONFIG: Record<StatusPedido, { label: string; color: string; bg: string; dot: string }> = {
  pendente:    { label: 'Aguardando',  color: '#92400e', bg: '#fef3c7', dot: '#f59e0b' },
  pago:        { label: 'Pago',        color: '#065f46', bg: '#d1fae5', dot: '#10b981' },
  cancelado:   { label: 'Cancelado',   color: '#991b1b', bg: '#fee2e2', dot: '#ef4444' },
  reembolsado: { label: 'Reembolsado', color: '#374151', bg: '#f3f4f6', dot: '#9ca3af' },
}

const STATUS_PIX_EXPIRADO = {
  label: 'PIX expirado',
  color: '#9a3412',
  bg: '#ffedd5',
  dot: '#ea580c',
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

// ── page ──────────────────────────────────────────────────────────────────────
export default async function PedidosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await sincronizarPixsExpiradosResponsavel(user.id)

  // Busca pedidos com itens + produtos + alunos + pagamento + ingressos
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

  const pedidos: PedidoLista[] = ((pedidosRaw ?? []) as PedidoRaw[]).map((p) => ({
    ...p,
    pagamento: Array.isArray(p.pagamento) ? (p.pagamento[0] ?? null) : (p.pagamento ?? null),
    itens: (p.itens ?? []).map((i) => ({
      ...i,
      produto: i.produto as Produto,
      aluno: i.aluno as Aluno,
    })),
  }))

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 0 80px' }}>

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
        height: 60, padding: '0 20px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Link href="/loja" style={{
          width: 36, height: 36, borderRadius: 'var(--r-sm)',
          background: 'var(--surface-2)', border: '1.5px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-2)', textDecoration: 'none', flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-.02em', flex: 1 }}>
          Meus pedidos
        </span>
        {pedidos.length > 0 && (
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)' }}>
            {pedidos.length} {pedidos.length === 1 ? 'pedido' : 'pedidos'}
          </span>
        )}
      </div>

      <div style={{ padding: '20px 20px 0' }}>

        {/* Empty state */}
        {pedidos.length === 0 && (
          <EmptyState
            icon="🛍️"
            title="Nenhum pedido ainda"
            description="Seus pedidos vão aparecer aqui depois da compra."
            actionLabel="🏪 Ver produtos"
            actionHref="/loja"
          />
        )}

        {/* Lista de pedidos */}
        {pedidos.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {pedidos.map((pedido) => {
              const statusCfg = pedido.status === 'pendente' && pedido.pagamento?.status === 'expirado'
                ? STATUS_PIX_EXPIRADO
                : STATUS_CONFIG[pedido.status]
              const metodoCfg = pedido.metodo_pagamento ? METODO_CONFIG[pedido.metodo_pagamento] : null

              return (
                <Link
                  key={pedido.id}
                  href={`/pedido/${pedido.id}`}
                  style={{
                    display: 'block', textDecoration: 'none',
                    background: 'var(--surface-1)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 'var(--r-lg)',
                    overflow: 'hidden',
                    transition: 'box-shadow .15s, transform .15s',
                  }}
                >
                  {/* Cabeçalho do card */}
                  <div style={{
                    padding: '14px 16px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    {/* Status dot + label */}
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '4px 10px', borderRadius: 999,
                      background: statusCfg.bg, color: statusCfg.color,
                      fontSize: 11, fontWeight: 700, letterSpacing: '.03em',
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: statusCfg.dot, display: 'inline-block', flexShrink: 0,
                      }} />
                      {statusCfg.label.toUpperCase()}
                    </span>

                    {/* Método */}
                    {metodoCfg && (
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: 'var(--text-3)',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        {metodoCfg.icon} {metodoCfg.label}
                      </span>
                    )}

                    <span style={{ flex: 1 }} />

                    {/* Número + data */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', fontFamily: 'monospace' }}>
                        #{pedido.numero.replace('PED-', '')}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>
                        {fmtData(pedido.data_criacao)}
                      </div>
                    </div>
                  </div>

                  {/* Itens */}
                  <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {pedido.itens.map((item) => (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {/* Ícone da categoria */}
                        <div style={{
                          width: 40, height: 40, borderRadius: 'var(--r-sm)',
                          background: 'var(--surface-2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 18, flexShrink: 0,
                        }}>
                          {item.produto.icon ?? CAT_ICONS[item.produto.categoria] ?? '📦'}
                        </div>

                        {/* Nome + aluno */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 14, fontWeight: 600, color: 'var(--text-1)',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {item.produto.nome}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                            {item.aluno.nome} · {item.aluno.serie}
                          </div>
                          {item.variante && (
                            <div style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 700, marginTop: 3 }}>
                              Tamanho {item.variante}
                            </div>
                          )}
                        </div>

                        {/* Preço */}
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', flexShrink: 0 }}>
                          {fmtBRL(item.preco_unitario)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Rodapé: total + seta */}
                  <div style={{
                    padding: '12px 16px',
                    borderTop: '1px solid var(--border)',
                    background: 'var(--surface-2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 500 }}>
                      Total · {pedido.itens.length} {pedido.itens.length === 1 ? 'item' : 'itens'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)' }}>
                        {fmtBRL(pedido.total)}
                      </span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="var(--text-3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </div>

                  {/* Botões de ingresso (fora do Link para não conflitar) */}
                  {(() => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const ingressos = pedido.itens.flatMap((i: any) =>
                      Array.isArray(i.ingresso) ? i.ingresso : (i.ingresso ? [i.ingresso] : [])
                    )
                    if (ingressos.length === 0) return null
                    return (
                      <div style={{
                        padding: '10px 16px',
                        borderTop: '1px solid var(--border)',
                        display: 'flex', gap: 8, flexWrap: 'wrap',
                      }}>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {ingressos.map((ing: any) => (
                          <Link
                            key={ing.id}
                            href={`/ingresso/${ing.token}`}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              padding: '7px 14px', borderRadius: 999,
                              fontSize: 12, fontWeight: 700, textDecoration: 'none',
                              background: ing.status === 'emitido' ? '#eff6ff' : '#f3f4f6',
                              color: ing.status === 'emitido' ? '#1d4ed8' : '#6b7280',
                              border: ing.status === 'emitido' ? '1.5px solid #bfdbfe' : '1.5px solid #d1d5db',
                            }}
                          >
                            🎟️ Ver ingresso
                            {ing.status !== 'emitido' && (
                              <span style={{ fontSize: 10, opacity: .7 }}>({ing.status})</span>
                            )}
                          </Link>
                        ))}
                      </div>
                    )
                  })()}
                </Link>
              )
            })}
          </div>
        )}

        {/* Rodapé informativo */}
        {pedidos.length > 0 && (
          <p style={{
            textAlign: 'center', fontSize: 12, color: 'var(--text-3)',
            marginTop: 32, lineHeight: 1.6,
          }}>
            Clique em um pedido para ver detalhes e comprovante de pagamento.
          </p>
        )}
      </div>
    </div>
  )
}
