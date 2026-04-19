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

type ItemVendido = Pick<ItemPedido, 'id' | 'pedido_id' | 'produto_id' | 'preco_unitario'> & {
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

  const [
    { data: pedidosTodos },
    { data: pedidosRecentes },
    { data: produtosAll },
    { data: alunosAll },
    { data: responsaveisAll },
  ] = await Promise.all([
    pedidosResumoQuery,
    pedidosRecentesQuery,
    supabase.from('produtos').select('id, nome, categoria, ativo, esgotado, capacidade, prazo_compra, data_evento'),
    supabase.from('alunos').select('id'),
    supabase.from('responsaveis').select('id'),
  ])

  const pedidos = (pedidosTodos ?? []) as PedidoResumo[]
  const produtos = (produtosAll ?? []) as Array<Pick<Produto, 'id' | 'nome' | 'categoria' | 'ativo' | 'esgotado' | 'capacidade' | 'prazo_compra' | 'data_evento'>>

  const pedidosIds = pedidos.map((pedido) => pedido.id)
  const produtosComCapacidade = produtos.filter((produto) => produto.capacidade !== null)

  const [
    { data: itensVendidos },
    { data: ingressosEmitidos },
  ] = await Promise.all([
    pedidosIds.length > 0
      ? supabase
          .from('itens_pedido')
          .select('id, pedido_id, produto_id, preco_unitario, produto:produtos(nome, categoria)')
          .in('pedido_id', pedidosIds)
      : Promise.resolve({ data: [] }),
    produtosComCapacidade.length > 0
      ? supabase
          .from('ingressos')
          .select('produto_id, status')
          .in('produto_id', produtosComCapacidade.map((produto) => produto.id))
          .in('status', ['emitido', 'usado'])
      : Promise.resolve({ data: [] }),
  ])

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

  const periodoLinks: Array<{ key: PeriodoDashboard; label: string }> = [
    { key: '7d', label: '7 dias' },
    { key: '30d', label: '30 dias' },
    { key: 'mes', label: 'Mes atual' },
  ]

  return (
    <div className="flex flex-col gap-6 pb-20 animate-fade-in">
      {/* HEADER HERO */}
      <section className="relative overflow-hidden rounded-[28px] p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white shadow-2xl">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-40" />

        <div className="relative grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-8 items-stretch">
          
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-[11px] font-bold tracking-widest uppercase backdrop-blur-md">
                Central de Gestão
              </span>
              <span className="text-xs font-semibold text-white/70">
                {interval.label ? `Período analisado: ${interval.label}` : 'Últimos 30 dias'}
              </span>
            </div>

            <div>
              <h1 className="text-3xl md:text-4xl lg:text-[40px] leading-tight font-black tracking-tight max-w-2xl text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
                Cockpit da Operação
              </h1>
              <p className="text-[15px] leading-relaxed text-white/80 max-w-2xl mt-3">
                Acompanhe o fluxo de caixa, pendências urgentes e a saúde das vendas em tempo real.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
              {[
                { label: 'Receita confirmada', value: fmtBRL(receitaConfirmada) },
                { label: 'Ticket médio', value: fmtBRL(ticketMedio) },
                { label: 'Aguardando', value: String(aguardando) },
                { label: 'Ativos', value: `${produtosAtivos}` },
              ].map((item) => (
                <div key={item.label} className="glass-panel-dark rounded-2xl p-4 transition-transform hover:-translate-y-1">
                  <div className="text-[10px] font-bold tracking-widest uppercase text-white/60">
                    {item.label}
                  </div>
                  <div className="text-xl md:text-2xl font-black tracking-tight mt-1">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel-dark rounded-[22px] p-6 flex flex-col gap-4 self-stretch border-white/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl -z-10" />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.64)', fontWeight: 700 }}>
                  Estado geral
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 3 }}>Saude da operacao</div>
              </div>
              <div
                style={{
                  minWidth: 68,
                  height: 68,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 18,
                  fontWeight: 900,
                  background: 'conic-gradient(#38bdf8 0 240deg, rgba(255,255,255,.14) 240deg 360deg)',
                }}
              >
                <span
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background: '#10213e',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  67%
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
      <section className="glass-panel rounded-3xl p-5 flex flex-col md:flex-row gap-5 justify-between items-start md:items-end z-10 relative">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {periodoLinks.map(({ key, label }) => (
            <Link
              key={key}
              href={buildDashboardHref({ periodo: key })}
              style={{
                padding: '8px 14px',
                borderRadius: 999,
                textDecoration: 'none',
                fontSize: 12,
                fontWeight: 700,
                background: periodoAtual === key ? '#0f172a' : '#fff',
                color: periodoAtual === key ? '#fff' : '#64748b',
                border: `1.5px solid ${periodoAtual === key ? '#0f172a' : '#e2e8f0'}`,
              }}
            >
              {label}
            </Link>
          ))}
        </div>

        <form style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'end' }}>
          <input type="hidden" name="periodo" value="custom" />
          <div>
            <label style={labelStyle}>DE</label>
            <input name="from" type="date" defaultValue={interval.fromDateInput} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>ATE</label>
            <input name="to" type="date" defaultValue={interval.toDateInput} style={inputStyle} />
          </div>
          <button type="submit" style={primaryPillButton}>
            Aplicar periodo
          </button>
          <Link href={buildDashboardHref({ periodo: '30d' })} style={secondaryPillButton}>
            Limpar
          </Link>
        </form>
      </section>

      {/* CARDS DE DESTAQUE */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Receita confirmada',
            value: fmtBRL(receitaConfirmada),
            note: `${pedidosPagos.length} pedidos pagos`,
            bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200/50',
            textColor: 'text-emerald-950',
            accent: 'text-emerald-700'
          },
          {
            label: 'Ticket médio',
            value: fmtBRL(ticketMedio),
            note: aguardando > 0 ? `${aguardando} pedidos ainda aguardando` : 'Sem fila de pagamentos',
            bg: 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200/50',
            textColor: 'text-blue-950',
            accent: 'text-blue-700'
          },
          {
            label: 'Base ativa',
            value: `${(alunosAll ?? []).length} alunos`,
            note: `${(responsaveisAll ?? []).length} responsáveis cadastrados`,
            bg: 'bg-gradient-to-br from-violet-50 to-violet-100 border-violet-200/50',
            textColor: 'text-violet-950',
            accent: 'text-violet-700'
          },
          {
            label: 'Catálogo',
            value: `${produtosAtivos} ativos`,
            note: `${esgotados} esgotados · ${urgenciasPrazo} prazo crítico`,
            bg: 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200/50',
            textColor: 'text-orange-950',
            accent: 'text-orange-700'
          },
        ].map((card) => (
          <article
            key={card.label}
            className={`rounded-[22px] p-5 border ${card.bg} shadow-sm transition-transform hover:-translate-y-1`}
          >
            <div className={`text-[11px] uppercase tracking-widest font-bold ${card.accent}`}>
              {card.label}
            </div>
            <div className={`text-3xl font-black tracking-tight mt-2 ${card.textColor}`}>
              {card.value}
            </div>
            <div className={`text-sm mt-2 opacity-80 font-medium ${card.textColor}`}>
              {card.note}
            </div>
          </article>
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(320px, 1fr)', gap: 16 }}>
        <article style={panelStyle}>
          <PanelHeader
            eyebrow="Performance"
            title="Receita diaria confirmada"
            description="Leitura rapida para perceber dias mortos, picos e queda de recorrencia."
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 10, alignItems: 'end', minHeight: 208 }}>
            {salesSeries.map((point) => (
              <div key={point.label} style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>{point.orders}</div>
                <div
                  style={{
                    width: '100%',
                    borderRadius: 16,
                    background: 'linear-gradient(180deg, #1d4ed8, #60a5fa)',
                    minHeight: 18,
                    height: `${Math.max(18, point.height)}px`,
                    boxShadow: 'inset 0 -1px 0 rgba(255,255,255,.2)',
                  }}
                />
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>{point.label}</div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>{fmtCompactBRL(point.value)}</div>
              </div>
            ))}
          </div>
        </article>

        <article style={panelStyle}>
          <PanelHeader
            eyebrow="Acoes"
            title="Atalhos de gestor"
            description="Atalhos pensados para operacao diaria em vez de menu puro."
          />

          <div style={{ display: 'grid', gap: 10 }}>
            {[
              { href: '/admin/pedidos', title: 'Acompanhar pedidos', desc: 'Filtrar pagamentos, checar fila e destravar atendimento.' },
              { href: '/admin/produtos', title: 'Gerenciar catalogo', desc: 'Ativar, pausar, ajustar capacidade e corrigir estoque.' },
              { href: '/admin/checkin', title: 'Validar ingressos', desc: 'Ir direto para o fluxo de check-in em eventos.' },
              { href: '/admin/cantina', title: 'Operacao da cantina', desc: 'Carteiras, consumo e status dos pedidos em um unico lugar.' },
            ].map((action) => (
              <Link
                key={action.href}
                href={action.href}
                style={{
                  textDecoration: 'none',
                  color: '#0f172a',
                  borderRadius: 18,
                  padding: '14px 16px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 800 }}>{action.title}</div>
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
                    borderRadius: 18,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    padding: '12px 14px',
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
                Operacao recente
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
          title: 'Catalogo rompido',
          value: `${esgotados} itens`,
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
    <div style={{ display: 'grid', gap: 4, marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#94a3b8' }}>
        {eyebrow}
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-.03em', color: '#0f172a', margin: 0 }}>
        {title}
      </h2>
      <p style={{ fontSize: 13, lineHeight: 1.65, color: '#64748b', margin: 0 }}>{description}</p>
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
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 24,
  padding: 20,
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
