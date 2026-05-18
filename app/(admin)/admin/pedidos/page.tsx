import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { confirmarPagamentoAction, cancelarPedidoAction } from '@/app/actions/admin'
import type { StatusPedido, MetodoPagamento } from '@/types/database'
import { EstornoAdminCard } from './EstornoAdminCard'
import { EstornoHistoricoAdmin } from './EstornoHistoricoAdmin'
import { getAdminButtonStyle, getAdminPillStyle, getAdminTone } from '@/lib/admin-ui-tones'

function fmtBRL(v: number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const STATUS_CONFIG: Record<StatusPedido, { label: string; tone: 'warning' | 'success' | 'danger' | 'neutral' }> = {
  pendente:    { label: 'Aguardando',  tone: 'warning' },
  pago:        { label: 'Pago',        tone: 'success' },
  cancelado:   { label: 'Cancelado',   tone: 'danger' },
  reembolsado: { label: 'Reembolsado', tone: 'neutral' },
}

const METODO_CONFIG: Record<MetodoPagamento, { label: string; icon: string }> = {
  pix:    { label: 'PIX', icon: '⚡' },
  cartao: { label: 'Cartão', icon: '💳' },
  boleto: { label: 'Boleto', icon: '📄' },
}

interface PedidoAdminItem {
  id: string
  preco_unitario: number
  variante: string | null
  produto: { nome: string | null; categoria: string | null } | { nome: string | null; categoria: string | null }[] | null
  aluno: { nome: string | null; serie: string | null } | { nome: string | null; serie: string | null }[] | null
}

interface PedidoAdminPagamento {
  metodo: MetodoPagamento
  status: string
  pix_tx_id: string | null
  boleto_linha_digitavel: string | null
}

interface PedidoAdminRow {
  id: string
  numero: string
  status: StatusPedido
  total: number
  metodo_pagamento: MetodoPagamento | null
  data_criacao: string
  data_pagamento: string | null
  termo_aceito: boolean
  termo_aceito_em: string | null
  responsavel: { id: string; nome: string; email: string } | { id: string; nome: string; email: string }[] | null
  itens: PedidoAdminItem[]
  pagamento: PedidoAdminPagamento | PedidoAdminPagamento[] | null
}

interface PedidoAdminNormalizado extends Omit<PedidoAdminRow, 'responsavel' | 'itens' | 'pagamento'> {
  responsavel: { id: string; nome: string; email: string } | null
  itens: Array<{
    id: string
    preco_unitario: number
    variante: string | null
    produto: { nome: string | null; categoria: string | null } | null
    aluno: { nome: string | null; serie: string | null } | null
  }>
  pagamento: PedidoAdminPagamento | null
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

export default async function AdminPedidos({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string; from?: string; to?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') redirect('/loja')

  const { status: filtroStatus, q, page, from: fromDate, to: toDate } = await searchParams
  const filtroAtual = filtroStatus ?? 'todos'
  const busca = q?.trim() ?? ''
  const fromIso = fromDate ? `${fromDate}T00:00:00.000Z` : null
  const toIso = toDate ? `${toDate}T23:59:59.999Z` : null
  const currentPage = Math.max(1, Number.parseInt(page ?? '1', 10) || 1)
  const pageSize = 12
  const from = (currentPage - 1) * pageSize
  const to = from + pageSize - 1

  let responsavelIds: string[] = []
  if (busca) {
    const { data: responsaveisEncontrados } = await supabase
      .from('responsaveis')
      .select('id')
      .or(`nome.ilike.%${busca}%,email.ilike.%${busca}%,cpf.ilike.%${busca}%`)
      .limit(50)

    responsavelIds = (responsaveisEncontrados ?? []).map((item) => item.id)
  }

  let pedidosQuery = supabase
    .from('pedidos')
    .select(`
      id, numero, status, total, metodo_pagamento, data_criacao, data_pagamento,
      termo_aceito, termo_aceito_em,
      responsavel:responsaveis(id, nome, email),
      itens:itens_pedido(
        id, preco_unitario, variante,
        produto:produtos(nome, categoria),
        aluno:alunos(nome, serie)
      ),
      pagamento:pagamentos(metodo, status, pix_tx_id, boleto_linha_digitavel)
    `)
    .order('created_at', { ascending: false })

  if (filtroAtual !== 'todos') {
    pedidosQuery = pedidosQuery.eq('status', filtroAtual)
  }

  if (busca) {
    const conditions = [`numero.ilike.%${busca}%`]
    if (responsavelIds.length > 0) conditions.push(`responsavel_id.in.(${responsavelIds.join(',')})`)
    pedidosQuery = pedidosQuery.or(conditions.join(','))
  }

  if (fromIso) {
    pedidosQuery = pedidosQuery.gte('created_at', fromIso)
  }
  if (toIso) {
    pedidosQuery = pedidosQuery.lte('created_at', toIso)
  }

  pedidosQuery = pedidosQuery.range(from, to)

  let totalQuery = supabase.from('pedidos').select('id', { count: 'exact', head: true })
  if (filtroAtual !== 'todos') {
    totalQuery = totalQuery.eq('status', filtroAtual)
  }
  if (busca) {
    const conditions = [`numero.ilike.%${busca}%`]
    if (responsavelIds.length > 0) conditions.push(`responsavel_id.in.(${responsavelIds.join(',')})`)
    totalQuery = totalQuery.or(conditions.join(','))
  }
  if (fromIso) {
    totalQuery = totalQuery.gte('created_at', fromIso)
  }
  if (toIso) {
    totalQuery = totalQuery.lte('created_at', toIso)
  }

  // Paraleliza queries independentes (antes rodavam em série).
  const [
    { data: pedidosRaw },
    { count: totalFiltrado },
    { data: contagens },
  ] = await Promise.all([
    pedidosQuery,
    totalQuery,
    supabase.from('pedidos').select('status'),
  ])
  const counts = (contagens ?? []).reduce<Record<string, number>>((acc, pedido) => {
    acc[pedido.status] = (acc[pedido.status] ?? 0) + 1
    return acc
  }, {})
  const total = (contagens ?? []).length
  const totalPages = Math.max(1, Math.ceil((totalFiltrado ?? 0) / pageSize))

  const pedidos: PedidoAdminNormalizado[] = ((pedidosRaw ?? []) as unknown as PedidoAdminRow[]).map((pedido) => ({
    ...pedido,
    responsavel: firstOf(pedido.responsavel),
    pagamento: firstOf(pedido.pagamento),
    itens: (pedido.itens ?? []).map((item) => ({
      ...item,
      produto: firstOf(item.produto),
      aluno: firstOf(item.aluno),
    })),
  }))

  // Buscar estornos pendentes para os pedidos desta página
  const pedidoIdsPage = pedidos.map(p => p.id)
  const adminClient = createAdminClient()

  const { data: todosEstornosRaw } = pedidoIdsPage.length
    ? await adminClient
        .from('pedido_estornos')
        .select('id, pedido_id, status, motivo, obs_admin, valor_total, created_at, resolvido_em, itens:pedido_estornos_itens(item_pedido_id, valor_item)')
        .in('pedido_id', pedidoIdsPage)
        .order('created_at', { ascending: false })
    : { data: [] }

  // Mapa de detalhes dos itens já carregados nos pedidos
  const itemDetailsMap = pedidos.flatMap(p => p.itens).reduce<Record<string, { produto_nome: string; aluno_nome: string; variante: string | null }>>(
    (acc, item) => {
      acc[item.id] = {
        produto_nome: item.produto?.nome ?? '—',
        aluno_nome: item.aluno?.nome ?? '—',
        variante: item.variante ?? null,
      }
      return acc
    },
    {}
  )

  // Enriquecer itens do estorno pendente com nomes de produto/aluno
  const estornoByPedidoId = ((todosEstornosRaw ?? []) as any[])
    .filter(e => e.status === 'pendente')
    .reduce<Record<string, any>>(
      (acc, e) => {
        acc[e.pedido_id] = {
          ...e,
          itens: (e.itens ?? []).map((i: any) => ({
            ...i,
            ...(itemDetailsMap[i.item_pedido_id] ?? { produto_nome: '—', aluno_nome: '—', variante: null }),
          })),
        }
        return acc
      },
      {}
    )

  // History: all resolved estornos per pedido
  const estornosHistoricoByPedidoId = ((todosEstornosRaw ?? []) as any[])
    .filter(e => e.status !== 'pendente')
    .reduce<Record<string, any[]>>(
      (acc, e) => {
        if (!acc[e.pedido_id]) acc[e.pedido_id] = []
        acc[e.pedido_id].push(e)
        return acc
      },
      {}
    )

  const filtros: { value: string; label: string }[] = [
    { value: 'todos', label: `Todos (${total})` },
    { value: 'pendente', label: `Aguardando (${counts.pendente ?? 0})` },
    { value: 'pago', label: `Pagos (${counts.pago ?? 0})` },
    { value: 'cancelado', label: `Cancelados (${counts.cancelado ?? 0})` },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 80 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', margin: 0, letterSpacing: '-.02em' }}>
            Pedidos
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '4px 0 0' }}>
            {totalFiltrado ?? 0} {totalFiltrado === 1 ? 'pedido encontrado' : 'pedidos encontrados'}
            {filtroAtual !== 'todos' ? ` · filtro ${filtroAtual}` : ''}
            {busca ? ` · busca "${busca}"` : ''}
            {fromDate || toDate ? ` · período ${formatRangeLabel(fromDate, toDate)}` : ''}
          </p>
        </div>
      </div>

      <form style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14,
        display: 'flex', alignItems: 'end', gap: 10, flexWrap: 'wrap',
      }}>
        <input type="hidden" name="status" value={filtroAtual} />
        <div style={{ flex: 1, minWidth: 240 }}>
          <label style={labelStyle}>BUSCA</label>
          <input
            name="q"
            defaultValue={busca}
            placeholder="Número, nome, email ou CPF"
            style={inputStyleWide}
          />
        </div>
        <div>
          <label style={labelStyle}>DE</label>
          <input name="from" type="date" defaultValue={fromDate ?? ''} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>ATÉ</label>
          <input name="to" type="date" defaultValue={toDate ?? ''} style={inputStyle} />
        </div>
        <button type="submit" style={getAdminButtonStyle('accent', 'solid', { height: 36, padding: '0 14px', fontSize: 12, borderRadius: 999 })}>
          Buscar
        </button>
        {(busca || fromDate || toDate) && (
          <Link href={filtroAtual === 'todos' ? '/admin/pedidos' : `/admin/pedidos?status=${filtroAtual}`} style={getAdminButtonStyle('neutral', 'soft', { height: 36, padding: '0 14px', fontSize: 12, borderRadius: 999 })}>
            Limpar
          </Link>
        )}
      </form>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {filtros.map(({ value, label }) => (
          <Link key={value} href={buildPageHref('/admin/pedidos', {
            status: value === 'todos' ? undefined : value,
            q: busca || undefined,
            from: fromDate || undefined,
            to: toDate || undefined,
          })} style={{
            padding: '7px 14px', borderRadius: 999,
            fontSize: 12, fontWeight: 700,
            textDecoration: 'none',
            background: filtroAtual === value ? '#ffedd5' : 'var(--surface)',
            color: filtroAtual === value ? '#9a3412' : 'var(--text-2)',
            border: filtroAtual === value ? '1px solid #fdba74' : '1px solid var(--border)',
            transition: 'all .2s'
          }}>
            {label}
          </Link>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {pedidos.length === 0 && (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
            padding: '60px 20px', textAlign: 'center',
            fontSize: 14, color: 'var(--text-3)',
          }}>
            Nenhum pedido encontrado.
          </div>
        )}

        {pedidos.map((p) => {
          const statusCfg = STATUS_CONFIG[p.status]
          const statusTone = getAdminTone(statusCfg.tone)
          const metodoCfg = p.metodo_pagamento ? METODO_CONFIG[p.metodo_pagamento] : null
          const responsavelNome = p.responsavel?.nome ?? '—'
          const responsavelEmail = p.responsavel?.email ?? ''
          const itens = p.itens ?? []
          const pagamento = p.pagamento

          return (
            <div key={p.id} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 12, overflow: 'hidden',
            }}>
              <div style={{
                padding: '14px 16px',
                background: 'var(--surface)',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              }}>
                <Link href={`/pedido/${p.id}`} style={{
                  fontWeight: 800, color: '#f59e0b', textDecoration: 'none',
                  fontFamily: 'monospace', fontSize: 13,
                }}>
                  #{p.numero}
                </Link>

                <span style={{
                  ...getAdminPillStyle(statusCfg.tone),
                }}>
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: statusTone.dot, display: 'inline-block',
                  }} />
                  {statusCfg.label}
                </span>

                {estornoByPedidoId[p.id] && (
                  <span style={{
                    ...getAdminPillStyle('warning', { gap: 4 }),
                  }}>
                    ⚠️ Estorno pendente
                  </span>
                )}

                {metodoCfg && (
                  <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>
                    {metodoCfg.icon} {metodoCfg.label}
                  </span>
                )}

                <span style={{ flex: 1 }} />

                {p.termo_aceito && (
                  <span style={{
                    ...getAdminPillStyle('warning', { gap: 4, padding: '3px 8px', borderRadius: 6 }),
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    Termo Aceito
                  </span>
                )}

                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  {fmtData(p.data_criacao)}
                </span>
              </div>

              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'rgba(245,158,11,.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: '#f59e0b', flexShrink: 0,
                  }}>
                    {responsavelNome.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{responsavelNome}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{responsavelEmail}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {itens.map((item) => (
                    <div key={item.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 8,
                      fontSize: 13, border: '1px solid rgba(255,255,255,.03)'
                    }}>
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>
                          {item.produto?.nome ?? '—'}
                        </span>
                        <span style={{ color: 'var(--text-3)', marginLeft: 8 }}>
                          {item.aluno?.nome} · {item.aluno?.serie}
                        </span>
                        {item.variante && (
                          <span style={{ color: '#c2410c', marginLeft: 8, fontWeight: 700 }}>
                            {item.variante}
                          </span>
                        )}
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--text-1)', flexShrink: 0 }}>
                        {fmtBRL(Number(item.preco_unitario))}
                      </span>
                    </div>
                  ))}
                </div>

                {pagamento?.pix_tx_id && (
                  <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace' }}>
                    PIX TX: {pagamento.pix_tx_id}
                  </div>
                )}
              </div>

              <div style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                flexWrap: 'wrap',
              }}>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>TOTAL </span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>
                    {fmtBRL(Number(p.total))}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {p.status === 'pendente' && (
                    <>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <form action={confirmarPagamentoAction.bind(null, p.id) as any}>
                        <button type="submit" style={{
                          ...getAdminButtonStyle('success', 'soft', { height: 34, padding: '0 14px', fontSize: 12, fontWeight: 700, borderRadius: 8 }),
                        }}>
                          ✓ Confirmar pagamento
                        </button>
                      </form>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <form action={cancelarPedidoAction.bind(null, p.id) as any}>
                        <button type="submit" style={{
                          ...getAdminButtonStyle('danger', 'soft', { height: 34, padding: '0 14px', fontSize: 12, fontWeight: 700, borderRadius: 8 }),
                        }}>
                          ✕ Cancelar
                        </button>
                      </form>
                    </>
                  )}
                  {p.status === 'pago' && (
                    <span style={{ fontSize: 12, color: '#166534', fontWeight: 700 }}>
                      ✓ Pago em {p.data_pagamento ? fmtData(p.data_pagamento) : '—'}
                    </span>
                  )}
                  {p.status === 'cancelado' && (
                    <span style={{ fontSize: 12, color: '#b91c1c', fontWeight: 700 }}>
                      Pedido cancelado
                    </span>
                  )}
                </div>
              </div>

              {estornoByPedidoId[p.id] && (
                <EstornoAdminCard
                  estorno={estornoByPedidoId[p.id]}
                  metodoPagamento={p.pagamento?.metodo ?? p.metodo_pagamento ?? 'pix'}
                />
              )}
              {estornosHistoricoByPedidoId[p.id]?.length > 0 && (
                <EstornoHistoricoAdmin estornos={estornosHistoricoByPedidoId[p.id]} />
              )}
            </div>
          )
        })}

        {totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            paddingTop: 4, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>
              Página {currentPage} de {totalPages}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link
                href={currentPage > 1 ? buildPageHref('/admin/pedidos', {
                  status: filtroAtual === 'todos' ? undefined : filtroAtual,
                  q: busca || undefined,
                  from: fromDate || undefined,
                  to: toDate || undefined,
                  page: String(currentPage - 1),
                }) : '#'}
                style={pagerButton(currentPage > 1)}
              >
                ← Anterior
              </Link>
              <Link
                href={currentPage < totalPages ? buildPageHref('/admin/pedidos', {
                  status: filtroAtual === 'todos' ? undefined : filtroAtual,
                  q: busca || undefined,
                  from: fromDate || undefined,
                  to: toDate || undefined,
                  page: String(currentPage + 1),
                }) : '#'}
                style={pagerButton(currentPage < totalPages)}
              >
                Próxima →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function buildPageHref(pathname: string, params: Record<string, string | undefined>) {
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) sp.set(key, value)
  }
  const query = sp.toString()
  return query ? `${pathname}?${query}` : pathname
}

function pagerButton(enabled: boolean) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    padding: '0 12px',
    borderRadius: 999,
    textDecoration: 'none',
    fontSize: 12,
    fontWeight: 700,
    background: enabled ? '#f8fafc' : '#f8fafc',
    color: enabled ? '#475569' : '#94a3b8',
    pointerEvents: enabled ? 'auto' : 'none',
    border: enabled ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
  } as const
}

function formatRangeLabel(from?: string, to?: string) {
  if (from && to) return `${from} até ${to}`
  if (from) return `a partir de ${from}`
  if (to) return `até ${to}`
  return ''
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-3)',
  marginBottom: 6,
  letterSpacing: '.05em',
}

const inputStyle: React.CSSProperties = {
  height: 42,
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  padding: '0 12px',
  fontSize: 13,
  color: 'var(--text-1)',
  fontFamily: 'inherit',
}

const inputStyleWide: React.CSSProperties = {
  ...inputStyle,
  width: '100%',
  boxSizing: 'border-box',
}
