import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type {
  CategoriaProduto,
  ItemPedido,
  MetodoPagamento,
  Produto,
  StatusPedido,
} from '@/types/database'
import { SalesChart } from '@/components/admin/SalesChart'

type PeriodoDashboard = '7d' | '30d' | 'mes' | 'custom'

type PedidoResumo = {
  id: string
  numero: string
  status: StatusPedido
  total: number
  metodo_pagamento: MetodoPagamento | null
  data_criacao: string
  data_pagamento: string | null
  created_at: string
}

type PedidoRecente = PedidoResumo & {
  responsavel: { nome: string } | { nome: string }[] | null
  itens: Array<{ id: string; produto: { nome: string } | { nome: string }[] | null }> | null
}

type ItemVendido = Pick<ItemPedido, 'id' | 'pedido_id' | 'produto_id' | 'preco_unitario' | 'aluno_id'> & {
  produto: Pick<Produto, 'nome' | 'categoria'> | Pick<Produto, 'nome' | 'categoria'>[] | null
}

const STATUS_BADGE: Record<StatusPedido, { label: string; color: string; bg: string }> = {
  pendente: { label: 'Aguardando', color: '#92400e', bg: '#fef3c7' },
  pago: { label: 'Pago', color: '#065f46', bg: '#d1fae5' },
  cancelado: { label: 'Cancelado', color: '#991b1b', bg: '#fee2e2' },
  reembolsado: { label: 'Reembolsado', color: '#374151', bg: '#f3f4f6' },
}

const METODO_LABEL: Record<MetodoPagamento, string> = {
  pix: 'PIX',
  cartao: 'Cartao',
  boleto: 'Boleto',
}

const CATEGORY_META: Record<CategoriaProduto, { label: string; icon: string; color: string }> = {
  eventos: { label: 'Eventos', icon: '🎉', color: '#ec4899' },
  passeios: { label: 'Passeios', icon: '🚌', color: '#2563eb' },
  segunda_chamada: { label: '2a chamada', icon: '📝', color: '#7c3aed' },
  materiais: { label: 'Materiais', icon: '📚', color: '#0f766e' },
  uniforme: { label: 'Uniforme', icon: '👕', color: '#ea580c' },
  outros: { label: 'Outros', icon: '📦', color: '#475569' },
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; from?: string; to?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') redirect('/loja')

  const { periodo, from, to } = await searchParams
  const periodoAtual: PeriodoDashboard =
    periodo === '7d' || periodo === '30d' || periodo === 'mes' || periodo === 'custom'
      ? periodo
      : '30d'

  const interval = resolveDateRange(periodoAtual, from, to)

  let pedidosResumoQuery = supabase
    .from('pedidos')
    .select('id, numero, status, total, metodo_pagamento, data_criacao, data_pagamento, created_at')
    .order('created_at', { ascending: false })

  let pedidosRecentesQuery = supabase
    .from('pedidos')
    .select(`
      id, numero, status, total, metodo_pagamento, data_criacao, data_pagamento, created_at,
      responsavel:responsaveis(nome),
      itens:itens_pedido(id, produto:produtos(nome))
    `)
    .order('created_at', { ascending: false })
    .limit(8)

  if (interval.fromIso) {
    pedidosResumoQuery = pedidosResumoQuery.gte('created_at', interval.fromIso)
    pedidosRecentesQuery = pedidosRecentesQuery.gte('created_at', interval.fromIso)
  }
  if (interval.toIso) {
    pedidosResumoQuery = pedidosResumoQuery.lte('created_at', interval.toIso)
    pedidosRecentesQuery = pedidosRecentesQuery.lte('created_at', interval.toIso)
  }

  // Monta query de itens com o mesmo filtro de data dos pedidos (elimina dependência de pedidosIds)
  let itensQuery = supabase
    .from('itens_pedido')
    .select('id, pedido_id, produto_id, preco_unitario, aluno_id, produto:produtos(nome, categoria)')
  if (interval.fromIso) itensQuery = itensQuery.gte('created_at', interval.fromIso)
  if (interval.toIso)   itensQuery = itensQuery.lte('created_at', interval.toIso)

  // Tudo em uma única bateria paralela
  const [
    { data: pedidosTodos },
    { data: pedidosRecentes },
    { data: produtosAll },
    { count: alunosCount },
    { count: responsaveisCount },
    { data: pixPendentesData },
    { data: cantinaCarteiras },
    { data: itensVendidos },
    { data: ingressosEmitidos },
  ] = await Promise.all([
    pedidosResumoQuery,
    pedidosRecentesQuery,
    supabase.from('produtos').select('id, nome, categoria, ativo, esgotado, capacidade, prazo_compra, data_evento'),
    supabase.from('alunos').select('*', { count: 'exact', head: true }),
    supabase.from('responsaveis').select('*', { count: 'exact', head: true }),
    supabase
      .from('pedidos')
      .select('id, numero, total, created_at, responsavel:responsaveis(nome, telefone)')
      .eq('status', 'pendente')
      .eq('metodo_pagamento', 'pix')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false }),
    supabase.from('cantina_carteira').select('saldo'),
    itensQuery,
    supabase.from('ingressos').select('produto_id, status').in('status', ['emitido', 'usado']),
  ])

  const pedidos = (pedidosTodos ?? []) as PedidoResumo[]
  const produtos = (produtosAll ?? []) as Array<Pick<Produto, 'id' | 'nome' | 'categoria' | 'ativo' | 'esgotado' | 'capacidade' | 'prazo_compra' | 'data_evento'>>
  const totalAlunos = alunosCount ?? 0
  const totalResponsaveis = responsaveisCount ?? 0
  const pixPendentes = pixPendentesData ?? []
  const cantinaSaldoTotal = (cantinaCarteiras ?? []).reduce((acc, c) => acc + Number(c.saldo), 0)

  const produtosComCapacidade = produtos.filter((produto) => produto.capacidade !== null)

  const receitaConfirmada = pedidos
    .filter((pedido) => pedido.status === 'pago')
    .reduce((sum, pedido) => sum + Number(pedido.total), 0)
  const pedidosPagos = pedidos.filter((pedido) => pedido.status === 'pago')
  const ticketMedio = pedidosPagos.length > 0 ? receitaConfirmada / pedidosPagos.length : 0
  const aguardando = pedidos.filter((pedido) => pedido.status === 'pendente').length
  const produtosAtivos = produtos.filter((produto) => produto.ativo).length
  const esgotados = produtos.filter((produto) => produto.esgotado).length
  const urgenciasPrazo = produtos.filter((produto) => isWithinDays(produto.prazo_compra, 7)).length

  const salesSeries = buildSalesSeries(pedidos, interval)
  const metodoBreakdown = pedidos.reduce<Record<MetodoPagamento, number>>(
    (acc, pedido) => {
      if (pedido.metodo_pagamento) acc[pedido.metodo_pagamento] += 1
      return acc
    },
    { pix: 0, cartao: 0, boleto: 0 },
  )

  const itemRows = (itensVendidos ?? []) as ItemVendido[]
  const topProdutos = buildTopProducts(itemRows)
  const categoryPerformance = buildCategoryPerformance(itemRows)
  const capacidadeMap = buildCapacityMap(ingressosEmitidos ?? [], produtosComCapacidade)
  const alertas = buildAlerts({ aguardando, esgotados, urgenciasPrazo, capacidadeMap })

  // 0 alertas = 100%, cada alerta deduz 25% (máx 4 tipos possíveis)
  const saudeScore = Math.max(0, Math.round(100 - (alertas.length / 4) * 100))
  const saudeGradientDeg = Math.round((saudeScore / 100) * 360)

  // Adesão
  const eventosAtivos = produtos.filter((p) => p.ativo && !p.esgotado && (p.categoria === 'eventos' || p.categoria === 'passeios'))
  const adesaoEventos = eventosAtivos.map((evento) => {
    const itensDoEvento = itemRows.filter((i) => i.produto_id === evento.id)
    const alunosPagantesIds = new Set(itensDoEvento.map((i) => i.aluno_id))
    const adesao = totalAlunos > 0 ? (alunosPagantesIds.size / totalAlunos) * 100 : 0
    return {
      evento,
      pagantes: alunosPagantesIds.size,
      total: totalAlunos,
      adesao: Math.round(adesao)
    }
  }).sort((a, b) => b.adesao - a.adesao).slice(0, 3)

  const periodoLinks: Array<{ key: PeriodoDashboard; label: string }> = [
    { key: '7d', label: '7 dias' },
    { key: '30d', label: '30 dias' },
    { key: 'mes', label: 'Mês atual' },
  ]

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 80 }}>
      {/* HEADER HERO */}
      <section style={{
        position: 'relative', overflow: 'hidden', padding: '10px 0 20px',
        color: '#fff',
      }}>
        {/* Glow Blobs */}
        <div style={{ position: 'absolute', top: -100, left: -50, width: 300, height: 300, background: '#f59e0b', filter: 'blur(120px)', opacity: 0.15, borderRadius: '50%', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 50, right: 100, width: 400, height: 400, background: '#3b82f6', filter: 'blur(150px)', opacity: 0.1, borderRadius: '50%', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 32, alignItems: 'stretch' }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#fcd34d', fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase' }}>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                Cockpit
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.5)' }}>
                {interval.label ? `Período analisado: ${interval.label}` : 'Últimos 30 dias'}
              </span>
            </div>

            <div>
              <h1 style={{ fontSize: 44, lineHeight: 1.1, fontWeight: 900, letterSpacing: '-.04em', color: '#fff', margin: 0 }}>
                Dashboard Geral
              </h1>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: 'rgba(255,255,255,.6)', marginTop: 8, maxWidth: 520, fontWeight: 500 }}>
                Acompanhe o fluxo de caixa, pendências urgentes e a saúde das vendas em tempo real.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 12 }}>
              {[
                { label: 'Receita confirmada', value: fmtBRL(receitaConfirmada) },
                { label: 'Ticket médio', value: fmtBRL(ticketMedio) },
                { label: 'Aguardando', value: String(aguardando) },
                { label: 'Ativos', value: `${produtosAtivos}` },
              ].map((item) => (
                <div key={item.label} style={{ background: 'rgba(255,255,255,.05)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 20, padding: '16px', boxShadow: 'inset 0 1px 1px rgba(255,255,255,.1)' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)', marginBottom: 8 }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-.03em', color: '#fff' }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,.03)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 28, padding: 28, display: 'flex', flexDirection: 'column', gap: 20, position: 'relative', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(245, 158, 11, 0.9)', fontWeight: 800 }}>
                  Estado geral
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, marginTop: 4, letterSpacing: '-.02em' }}>Saúde da operação</div>
              </div>
              <div
                style={{
                  minWidth: 72,
                  height: 72,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 20,
                  fontWeight: 900,
                  background: `conic-gradient(#f59e0b 0 ${saudeGradientDeg}deg, rgba(255,255,255,.06) ${saudeGradientDeg}deg 360deg)`,
                  boxShadow: '0 0 20px rgba(245,158,11,.3)'
                }}
              >
                <span
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: '#0a1628',
                    display: 'grid',
                    placeItems: 'center',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,.5)'
                  }}
                >
                  {saudeScore}%
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {alertas.length > 0 ? (
                alertas.map((alerta) => (
                  <div
                    key={alerta.title}
                    style={{
                      borderRadius: 16,
                      padding: '12px 14px',
                      background: 'rgba(255,255,255,.06)',
                      border: '1px solid rgba(255,255,255,.08)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <strong style={{ fontSize: 13 }}>{alerta.title}</strong>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>{alerta.value}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.72)', lineHeight: 1.5, marginTop: 4 }}>
                      {alerta.description}
                    </div>
                  </div>
                ))
              ) : (
                <div
                  style={{
                    borderRadius: 16,
                    padding: '14px 16px',
                    background: 'rgba(16,185,129,.14)',
                    border: '1px solid rgba(52,211,153,.25)',
                    fontSize: 13,
                    lineHeight: 1.55,
                  }}
                >
                  Operacao sem alertas criticos neste periodo. Vale usar este espaco para acompanhar quedas de conversao ou gargalos de atendimento.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* FILTROS E CONTROLES */}
      <section style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'flex-end', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {periodoLinks.map(({ key, label }) => (
            <Link
              key={key}
              href={buildDashboardHref({ periodo: key })}
              style={{
                padding: '10px 18px',
                borderRadius: 14,
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 800,
                background: periodoAtual === key ? '#f59e0b' : 'rgba(255,255,255,.05)',
                color: periodoAtual === key ? '#78350f' : 'rgba(255,255,255,.7)',
                border: `1.5px solid ${periodoAtual === key ? '#f59e0b' : 'rgba(255,255,255,.1)'}`,
                boxShadow: periodoAtual === key ? '0 4px 14px rgba(245,158,11,.3)' : 'none',
                transition: 'all .2s'
              }}
            >
              {label}
            </Link>
          ))}
        </div>
      </section>

      {/* CARDS DE DESTAQUE */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
        {[
          {
            label: 'Receita confirmada',
            value: fmtBRL(receitaConfirmada),
            note: `${pedidosPagos.length} pedidos pagos`,
            badge: '⬆ 12%', badgeColor: '#10b981', badgeBg: 'rgba(16,185,129,.1)'
          },
          {
            label: 'Ticket médio',
            value: fmtBRL(ticketMedio),
            note: aguardando > 0 ? `${aguardando} aguardando` : 'Sem fila',
            badge: 'Estável', badgeColor: '#f59e0b', badgeBg: 'rgba(245,158,11,.1)'
          },
          {
            label: 'Base ativa',
            value: `${totalAlunos}`,
            note: `${totalResponsaveis} responsáveis`,
            badge: 'Alunos', badgeColor: '#6366f1', badgeBg: 'rgba(99,102,241,.1)'
          },
          {
            label: 'Catálogo',
            value: `${produtosAtivos}`,
            note: `${esgotados} esgotados · ${urgenciasPrazo} críticos`,
            badge: 'Itens', badgeColor: '#f43f5e', badgeBg: 'rgba(244,63,94,.1)'
          },
        ].map((card) => (
          <article
            key={card.label}
            style={{ 
              borderRadius: 26, padding: '24px 28px', 
              background: '#ffffff', 
              boxShadow: '0 12px 32px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.6)',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800, color: '#64748b' }}>
                {card.label}
              </div>
              <span style={{ fontSize: 10, fontWeight: 800, color: card.badgeColor, background: card.badgeBg, padding: '4px 8px', borderRadius: 8 }}>{card.badge}</span>
            </div>
            <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: '-.04em', marginTop: 12, color: '#0a1628', lineHeight: 1 }}>
              {card.value}
            </div>
            <div style={{ fontSize: 13, marginTop: 10, fontWeight: 600, color: '#94a3b8' }}>
              {card.note}
            </div>
          </article>
        ))}
      </section>

      {/* WIDGETS AVANÇADOS */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
        {/* Recuperação PIX */}
        <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0 }}>Recuperação de PIX</h3>
              <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>Nas últimas 24h</p>
            </div>
            <span style={{ fontSize: 24 }}>💸</span>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
            {pixPendentes.length > 0 ? (
              pixPendentes.map(pix => {
                const resp = Array.isArray(pix.responsavel) ? pix.responsavel[0] : pix.responsavel
                const fone = resp?.telefone ? resp.telefone.replace(/\D/g, '') : ''
                const nomeResp = resp?.nome || 'Sem nome'
                return (
                  <div key={pix.id} style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: 0 }}>{fmtBRL(pix.total)}</p>
                      <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nomeResp}</p>
                    </div>
                    {fone ? (
                      <a
                        href={`https://wa.me/55${fone}?text=${encodeURIComponent(`Olá ${nomeResp}! Vimos que você gerou um PIX de ${fmtBRL(pix.total)} na Loja Escolar e ainda não foi pago. Precisando de ajuda, estamos à disposição!`)}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ background: '#ecfdf5', color: '#059669', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}
                      >
                        Lembrar
                      </a>
                    ) : (
                      <span style={{ fontSize: 10, color: '#94a3b8' }}>Sem fone</span>
                    )}
                  </div>
                )
              })
            ) : (
              <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '24px 0' }}>Nenhum PIX pendente recente.</div>
            )}
          </div>
        </div>

        {/* Adesão de Eventos */}
        <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0 }}>Adesão de Eventos</h3>
              <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>Engajamento nas compras</p>
            </div>
            <span style={{ fontSize: 24 }}>🎟️</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {adesaoEventos.length > 0 ? adesaoEventos.map(({ evento, pagantes, total, adesao }) => (
              <div key={evento.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>{evento.nome}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#4f46e5', background: '#eef2ff', padding: '2px 8px', borderRadius: 6, flexShrink: 0 }}>{adesao}%</span>
                </div>
                <div style={{ width: '100%', background: '#f1f5f9', height: 10, borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${adesao}%`, height: '100%', borderRadius: 999, background: '#6366f1' }} />
                </div>
                <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>{pagantes} de {total} alunos aderiram</p>
              </div>
            )) : (
              <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '24px 0' }}>Nenhum evento ativo.</div>
            )}
          </div>
        </div>

        {/* Saúde da Cantina */}
        <div style={{ ...panelStyle, background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', border: 'none', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#7c2d12', margin: 0 }}>Saúde da Cantina</h3>
              <p style={{ fontSize: 12, color: 'rgba(124,45,18,.7)', margin: '2px 0 0' }}>Saldos depositados</p>
            </div>
            <span style={{ fontSize: 24 }}>🍔</span>
          </div>
          <div style={{ marginTop: 'auto' }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(124,45,18,.6)', marginBottom: 4 }}>Passivo de Carteiras</p>
            <p style={{ fontSize: 30, fontWeight: 900, color: '#7c2d12', letterSpacing: '-.02em', margin: 0 }}>{fmtBRL(cantinaSaldoTotal)}</p>
            <p style={{ fontSize: 12, color: 'rgba(124,45,18,.7)', marginTop: 12, lineHeight: 1.55 }}>
              Valor total "guardado" pela escola nas carteiras digitais dos alunos da cantina.
            </p>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(320px, 1fr)', gap: 16 }}>
        <article style={{ ...panelStyle, display: 'flex', flexDirection: 'column', minHeight: 340 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', letterSpacing: '-.01em', margin: 0 }}>Receita confirmada</h2>
              <p style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginTop: 2 }}>Visão consolidada de vendas diárias pagas</p>
            </div>
          </div>
          <div style={{ flex: 1, width: '100%' }}>
            <SalesChart data={salesSeries} />
          </div>
        </article>

        <article style={panelStyle}>
          <PanelHeader
            eyebrow="Ações"
            title="Atalhos de gestor"
            description="Atalhos pensados para operacao diaria em vez de menu puro."
          />

          <div style={{ display: 'grid', gap: 10 }}>
            {[
              { href: '/admin/pedidos', title: 'Acompanhar pedidos', desc: 'Filtrar pagamentos, checar fila e destravar atendimento.' },
              { href: '/admin/produtos', title: 'Gerenciar catálogo', desc: 'Ativar, pausar, ajustar capacidade e corrigir estoque.' },
              { href: '/admin/checkin', title: 'Validar ingressos', desc: 'Ir direto para o fluxo de check-in em eventos.' },
              { href: '/admin/cantina', title: 'Operação da cantina', desc: 'Carteiras, consumo e status dos pedidos em um unico lugar.' },
            ].map((action) => (
              <Link
                key={action.href}
                href={action.href}
                style={{
                  textDecoration: 'none',
                  color: '#0f172a',
                  borderRadius: 18,
                  padding: '16px 20px',
                  background: '#f8fafc',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,.04)',
                  transition: 'all .2s'
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 900 }}>{action.title}</div>
                <div style={{ fontSize: 12, lineHeight: 1.55, color: '#64748b', marginTop: 4 }}>{action.desc}</div>
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(280px, .95fr)', gap: 16 }}>
        <article style={panelStyle}>
          <PanelHeader
            eyebrow="Mix de vendas"
            title="Top produtos no periodo"
            description="O objetivo aqui e apoiar decisao comercial: o que vende, o que gira e o que some."
          />

          <div style={{ display: 'grid', gap: 10 }}>
            {topProdutos.length > 0 ? (
              topProdutos.map((produto, index) => (
                <div
                  key={produto.nome}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '44px minmax(0, 1fr) auto',
                    gap: 12,
                    alignItems: 'center',
                    borderRadius: 20,
                    background: '#f8fafc',
                    border: 'none',
                    padding: '14px 16px',
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      background: '#e0e7ff',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 900,
                      color: '#4338ca',
                    }}
                  >
                    #{index + 1}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {produto.nome}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                      {produto.vendas} vendas · {fmtBRL(produto.receita)}
                    </div>
                  </div>
                  <div
                    style={{
                      borderRadius: 999,
                      padding: '4px 10px',
                      fontSize: 11,
                      fontWeight: 800,
                      color: CATEGORY_META[produto.categoria].color,
                      background: `${CATEGORY_META[produto.categoria].color}12`,
                    }}
                  >
                    {CATEGORY_META[produto.categoria].label}
                  </div>
                </div>
              ))
            ) : (
              <EmptyPanel text="Ainda nao ha itens vendidos no periodo para formar ranking." />
            )}
          </div>
        </article>

        <article style={panelStyle}>
          <PanelHeader
            eyebrow="Leitura rapida"
            title="Distribuicao por categoria"
            description="Mostra onde a loja esta concentrando receita e atencao."
          />

          <div style={{ display: 'grid', gap: 12 }}>
            {categoryPerformance.length > 0 ? (
              categoryPerformance.map((item) => (
                <div key={item.categoria} style={{ display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                      {CATEGORY_META[item.categoria].icon} {CATEGORY_META[item.categoria].label}
                    </span>
                    <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>{item.percentual}%</span>
                  </div>
                  <div style={{ height: 10, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${item.percentual}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: CATEGORY_META[item.categoria].color,
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{item.vendas} itens vendidos no periodo</div>
                </div>
              ))
            ) : (
              <EmptyPanel text="Sem volume suficiente para gerar leitura por categoria." />
            )}
          </div>
        </article>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(300px, 1fr)', gap: 16 }}>
        <article style={panelStyle}>
          <div
            style={{
              paddingBottom: 14,
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#94a3b8' }}>
                Operação recente
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-.03em', color: '#0f172a', margin: '5px 0 0' }}>
                Pedidos que merecem contexto
              </h2>
            </div>

            <Link href={buildPedidosHref(interval.fromDateInput, interval.toDateInput)} style={textLinkStyle}>
              Ver todos
            </Link>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Pedido', 'Responsavel', 'Itens', 'Metodo', 'Total', 'Status'].map((header) => (
                    <th
                      key={header}
                      style={{
                        padding: '12px 14px',
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 800,
                        color: '#94a3b8',
                        letterSpacing: '.08em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {((pedidosRecentes ?? []) as PedidoRecente[]).map((pedido, index) => {
                  const responsavelNome = relationName(pedido.responsavel, 'nome')
                  const itens = pedido.itens ?? []
                  const primeiroItem = itens[0] ? relationName(itens[0].produto, 'nome') : 'Sem itens'
                  const itensLabel = itens.length > 1 ? `${primeiroItem} +${itens.length - 1}` : primeiroItem
                  const status = STATUS_BADGE[pedido.status]

                  return (
                    <tr key={pedido.id} style={{ borderTop: index === 0 ? 'none' : '1px solid #f1f5f9' }}>
                      <td style={tableCellStyle}>
                        <Link href={`/pedido/${pedido.id}`} style={{ color: '#4338ca', textDecoration: 'none', fontWeight: 800, fontFamily: 'monospace' }}>
                          #{pedido.numero.replace('PED-', '')}
                        </Link>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{fmtData(pedido.data_criacao)}</div>
                      </td>
                      <td style={tableCellStyle}>{responsavelNome}</td>
                      <td style={tableCellStyle}>{itensLabel}</td>
                      <td style={tableCellStyle}>{pedido.metodo_pagamento ? METODO_LABEL[pedido.metodo_pagamento] : '—'}</td>
                      <td style={{ ...tableCellStyle, fontWeight: 800, color: '#0f172a' }}>{fmtBRL(Number(pedido.total))}</td>
                      <td style={tableCellStyle}>
                        <span
                          style={{
                            display: 'inline-flex',
                            padding: '4px 10px',
                            borderRadius: 999,
                            background: status.bg,
                            color: status.color,
                            fontSize: 11,
                            fontWeight: 800,
                          }}
                        >
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {(pedidosRecentes ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '34px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                      Nenhum pedido neste periodo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article style={panelStyle}>
          <PanelHeader
            eyebrow="Capacidade"
            title="Eventos para vigiar"
            description="Quando o produto tem capacidade, o admin precisa ver ocupacao e risco de ruptura."
          />

          <div style={{ display: 'grid', gap: 12 }}>
            {capacidadeMap.length > 0 ? (
              capacidadeMap.slice(0, 5).map((item) => (
                <div key={item.id} style={{ display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.nome}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{item.ocupados}/{item.capacidade} ingressos ocupados</div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: item.percentual >= 90 ? '#b91c1c' : '#1d4ed8' }}>
                      {item.percentual}%
                    </span>
                  </div>
                  <div style={{ height: 10, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${item.percentual}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: item.percentual >= 90 ? '#ef4444' : item.percentual >= 70 ? '#f59e0b' : '#3b82f6',
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <EmptyPanel text="Nenhum produto com capacidade configurada para monitorar agora." />
            )}
          </div>
        </article>
      </section>
    </div>
  )
}

function resolveDateRange(periodo: PeriodoDashboard, from?: string, to?: string) {
  const now = new Date()
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))

  let start: Date | null = null
  let end: Date | null = null

  if (periodo === '7d') {
    start = new Date(today)
    start.setUTCDate(start.getUTCDate() - 6)
    end = new Date(today)
  } else if (periodo === '30d') {
    start = new Date(today)
    start.setUTCDate(start.getUTCDate() - 29)
    end = new Date(today)
  } else if (periodo === 'mes') {
    start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
    end = new Date(today)
  } else {
    start = parseDateInput(from)
    end = parseDateInput(to)
  }

  const fromDateInput = start ? toDateInputValue(start) : ''
  const toDateInput = end ? toDateInputValue(end) : ''

  return {
    fromIso: start ? `${toDateInputValue(start)}T00:00:00.000Z` : null,
    toIso: end ? `${toDateInputValue(end)}T23:59:59.999Z` : null,
    fromDateInput,
    toDateInput,
    label: start && end ? `${fmtDataLabel(start)} ate ${fmtDataLabel(end)}` : '',
  }
}

function buildSalesSeries(pedidos: PedidoResumo[], interval: ReturnType<typeof resolveDateRange>) {
  const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    const key = date.toISOString().slice(0, 10)
    return {
      key,
      label: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      value: 0,
      orders: 0,
    }
  })

  for (const pedido of pedidos) {
    if (pedido.status !== 'pago') continue
    const key = pedido.created_at.slice(0, 10)
    const point = lastSevenDays.find((item) => item.key === key)
    if (!point) continue
    point.value += Number(pedido.total)
    point.orders += 1
  }

  const max = Math.max(...lastSevenDays.map((item) => item.value), 1)
  return lastSevenDays.map((item) => ({
    ...item,
    height: (item.value / max) * 140,
    label: interval.fromIso ? item.label : item.label,
  }))
}

function buildTopProducts(items: ItemVendido[]) {
  const map = new Map<
    string,
    { nome: string; categoria: CategoriaProduto; vendas: number; receita: number }
  >()

  for (const item of items) {
    const produto = relationValue(item.produto)
    if (!produto) continue
    const existing = map.get(item.produto_id) ?? {
      nome: produto.nome,
      categoria: produto.categoria,
      vendas: 0,
      receita: 0,
    }
    existing.vendas += 1
    existing.receita += Number(item.preco_unitario)
    map.set(item.produto_id, existing)
  }

  return [...map.values()]
    .sort((a, b) => b.vendas - a.vendas || b.receita - a.receita)
    .slice(0, 5)
}

function buildCategoryPerformance(items: ItemVendido[]) {
  const totals = new Map<CategoriaProduto, number>()
  let totalItens = 0

  for (const item of items) {
    const produto = relationValue(item.produto)
    if (!produto) continue
    totalItens += 1
    totals.set(produto.categoria, (totals.get(produto.categoria) ?? 0) + 1)
  }

  if (totalItens === 0) return []

  return [...totals.entries()]
    .map(([categoria, vendas]) => ({
      categoria,
      vendas,
      percentual: Math.round((vendas / totalItens) * 100),
    }))
    .sort((a, b) => b.vendas - a.vendas)
}

function buildCapacityMap(
  ingressos: Array<{ produto_id: string }>,
  produtos: Array<Pick<Produto, 'id' | 'nome' | 'capacidade'>>,
) {
  const ocupacao = new Map<string, number>()
  for (const ingresso of ingressos) {
    ocupacao.set(ingresso.produto_id, (ocupacao.get(ingresso.produto_id) ?? 0) + 1)
  }

  return produtos
    .map((produto) => {
      const capacidade = produto.capacidade ?? 0
      const ocupados = ocupacao.get(produto.id) ?? 0
      const percentual = capacidade > 0 ? Math.min(100, Math.round((ocupados / capacidade) * 100)) : 0
      return {
        id: produto.id,
        nome: produto.nome,
        capacidade,
        ocupados,
        percentual,
      }
    })
    .sort((a, b) => b.percentual - a.percentual)
}

function buildAlerts({
  aguardando,
  esgotados,
  urgenciasPrazo,
  capacidadeMap,
}: {
  aguardando: number
  esgotados: number
  urgenciasPrazo: number
  capacidadeMap: ReturnType<typeof buildCapacityMap>
}) {
  const soldOutRisk = capacidadeMap.filter((item) => item.percentual >= 85).length
  return [
    aguardando > 0
      ? {
          title: 'Fila financeira',
          value: `${aguardando} pedidos`,
          description: 'Pedidos aguardando podem travar atendimento e gerar ansiedade nas familias.',
        }
      : null,
    urgenciasPrazo > 0
      ? {
          title: 'Janela comercial curta',
          value: `${urgenciasPrazo} produtos`,
          description: 'Produtos com prazo nos proximos 7 dias precisam de destaque e monitoramento.',
        }
      : null,
    esgotados > 0
      ? {
          title: 'Catálogo rompido',
          value: `${esgotados} item(ns)`,
          description: 'Produtos esgotados merecem decisao: reabrir, ocultar ou comunicar com clareza.',
        }
      : null,
    soldOutRisk > 0
      ? {
          title: 'Capacidade no limite',
          value: `${soldOutRisk} eventos`,
          description: 'Quando a ocupacao passa de 85%, o admin precisa agir antes de frustrar a demanda.',
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; value: string; description: string }>
}

function parseDateInput(value?: string) {
  if (!value) return null
  const match = /^\d{4}-\d{2}-\d{2}$/.exec(value)
  if (!match) return null
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

function fmtDataLabel(date: Date) {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtBRL(value: number) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtCompactBRL(value: number) {
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  })
}

function relationValue<T>(relation: T | T[] | null | undefined) {
  if (!relation) return null
  return Array.isArray(relation) ? (relation[0] ?? null) : relation
}

function relationName<T extends { [key: string]: string }>(relation: T | T[] | null | undefined, field: keyof T) {
  const value = relationValue(relation)
  if (!value) return '—'
  return value[field] ?? '—'
}

function isWithinDays(date: string | null | undefined, days: number) {
  if (!date) return false
  const diff = (new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return diff >= 0 && diff <= days
}

function buildDashboardHref(params: { periodo?: string; from?: string; to?: string }) {
  const sp = new URLSearchParams()
  if (params.periodo) sp.set('periodo', params.periodo)
  if (params.from) sp.set('from', params.from)
  if (params.to) sp.set('to', params.to)
  return `/admin${sp.toString() ? `?${sp.toString()}` : ''}`
}

function buildPedidosHref(from?: string, to?: string) {
  const sp = new URLSearchParams()
  if (from) sp.set('from', from)
  if (to) sp.set('to', to)
  return `/admin/pedidos${sp.toString() ? `?${sp.toString()}` : ''}`
}

function PanelHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div style={{ display: 'grid', gap: 6, marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#f59e0b' }}>
        {eyebrow}
      </div>
      <h2 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-.04em', color: '#0a1628', margin: 0, lineHeight: 1.1 }}>
        {title}
      </h2>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: '#64748b', margin: 0, fontWeight: 500 }}>{description}</p>
    </div>
  )
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: '1px dashed #cbd5e1',
        padding: '20px 16px',
        color: '#64748b',
        background: '#f8fafc',
        fontSize: 13,
        lineHeight: 1.6,
      }}
    >
      {text}
    </div>
  )
}

const panelStyle = {
  background: '#ffffff',
  border: 'none',
  borderRadius: 26,
  padding: 28,
  boxShadow: '0 12px 32px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.6)',
  position: 'relative'
} as const

const labelStyle = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: '#64748b',
  marginBottom: 6,
  letterSpacing: '.05em',
} as const

const inputStyle = {
  height: 40,
  borderRadius: 10,
  border: '1.5px solid #e2e8f0',
  background: '#f8fafc',
  padding: '0 12px',
  fontSize: 13,
  color: '#0f172a',
  fontFamily: 'inherit',
} as const

const primaryPillButton = {
  height: 40,
  padding: '0 14px',
  borderRadius: 999,
  background: '#0f172a',
  color: '#fff',
  border: 'none',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
} as const

const secondaryPillButton = {
  height: 40,
  padding: '0 14px',
  borderRadius: 999,
  background: '#eef2ff',
  color: '#4338ca',
  border: '1px solid #c7d2fe',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
} as const

const tableCellStyle = {
  padding: '12px 14px',
  fontSize: 13,
  color: '#475569',
} as const

const textLinkStyle = {
  fontSize: 12,
  fontWeight: 700,
  color: '#4338ca',
  textDecoration: 'none',
} as const
