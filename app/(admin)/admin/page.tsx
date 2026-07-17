import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { currentPermissions, podeAcessarAdmin } from '@/lib/permissoes'
import Link from 'next/link'
import type {
  CategoriaProduto,
  ItemPedido,
  MetodoPagamento,
  Produto,
  StatusPedido,
} from '@/types/database'
import { SalesChart } from '@/components/admin/SalesChart'
import { getPreviewAdminData, isPreviewTemaAdmin } from '@/lib/preview-tema/admin-mocks'

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
  pendente: { label: 'Aguardando', color: '#c55300', bg: '#ffe8cf' },
  pago: { label: 'Pago', color: '#008932', bg: '#dff8e6' },
  cancelado: { label: 'Cancelado', color: '#e9152d', bg: '#ffe3e2' },
  reembolsado: { label: 'Reembolsado', color: '#3c3c43', bg: '#f2f2f7' },
}

const METODO_LABEL: Record<MetodoPagamento, string> = {
  pix: 'PIX',
  cartao: 'Cartao',
  boleto: 'Boleto',
}

const CATEGORY_META: Record<CategoriaProduto, { label: string; icon: string; color: string }> = {
  eventos: { label: 'Eventos', icon: '🎉', color: '#ff2d55' },
  passeios: { label: 'Passeios', icon: '🚌', color: '#0088ff' },
  segunda_chamada: { label: '2a chamada', icon: '📝', color: '#cb30e0' },
  materiais: { label: 'Materiais', icon: '📚', color: '#008575' },
  uniforme: { label: 'Uniforme', icon: '👕', color: '#ff383c' },
  outros: { label: 'Outros', icon: '📦', color: '#3c3c43' },
}

const CREATIVE = {
  ink: '#1c1c1e',
  inkStrong: '#000000',
  muted: '#3c3c43',
  softText: '#6c6c70',
  accent: '#f97316',
  accentStrong: '#c2410c',
  accentSoft: '#fff3e9',
  accentBorder: '#ffd9b8',
  rose: '#ff2d55',
  roseSoft: '#ffedf2',
  link: '#c2410c',
  panelShadow: '0 18px 38px rgba(249,115,22,.1), inset 0 1px 0 rgba(255,255,255,.65)',
} as const

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; from?: string; to?: string }>
}) {
  const previewTema = isPreviewTemaAdmin()
  const supabase = await createClient()
  if (!previewTema) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')
    if (!podeAcessarAdmin(await currentPermissions())) redirect('/loja')
  }

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
  ] = (previewTema ? getPreviewAdminData(interval) : await Promise.all([
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ])) as any[]

  const pedidos = (pedidosTodos ?? []) as PedidoResumo[]
  const produtos = (produtosAll ?? []) as Array<Pick<Produto, 'id' | 'nome' | 'categoria' | 'ativo' | 'esgotado' | 'capacidade' | 'prazo_compra' | 'data_evento'>>
  const totalAlunos = alunosCount ?? 0
  const totalResponsaveis = responsaveisCount ?? 0
  type PixPendente = {
    id: string
    numero: string
    total: number
    created_at: string
    responsavel: { nome: string; telefone: string | null } | Array<{ nome: string; telefone: string | null }> | null
  }
  const pixPendentes = (pixPendentesData ?? []) as PixPendente[]
  const cantinaSaldoTotal = ((cantinaCarteiras ?? []) as Array<{ saldo: number }>)
    .reduce((acc, c) => acc + Number(c.saldo), 0)

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
    <div className="animate-fade-in admin-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 56 }}>
      {/* CABEÇALHO COMPACTO: título + saúde + chips de alerta */}
      <section style={{ position: 'relative', overflow: 'hidden', padding: '6px 0 0', color: CREATIVE.ink }}>
        <div style={{ position: 'absolute', top: -120, left: -60, width: 280, height: 280, background: CREATIVE.accent, filter: 'blur(120px)', opacity: 0.12, borderRadius: '50%', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 260 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 999, background: CREATIVE.accentSoft, border: `1px solid ${CREATIVE.accentBorder}`, color: CREATIVE.accentStrong, fontSize: 10, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase' }}>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: CREATIVE.accent }}></span>
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: CREATIVE.accent }}></span>
                </span>
                Cockpit
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: CREATIVE.softText }}>
                {interval.label ? `Período analisado: ${interval.label}` : 'Últimos 30 dias'}
              </span>
            </div>

            <h1 style={{ fontSize: 30, lineHeight: 1.1, fontWeight: 800, letterSpacing: '-.03em', color: CREATIVE.inkStrong, margin: 0 }}>
              Dashboard Geral
            </h1>
          </div>

          <div
            style={{ display: 'flex', alignItems: 'center', gap: 12 }}
            title={`Saúde da operação: ${saudeScore}%`}
          >
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: CREATIVE.softText, fontWeight: 800 }}>
                Saúde da operação
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: CREATIVE.muted, marginTop: 2 }}>
                {alertas.length === 0 ? 'Sem alertas críticos' : `${alertas.length} ponto(s) de atenção`}
              </div>
            </div>
            <div
              style={{
                minWidth: 60,
                height: 60,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                fontSize: 15,
                fontWeight: 800,
                background: `conic-gradient(${CREATIVE.accent} 0 ${saudeGradientDeg}deg, rgba(249,115,22,.12) ${saudeGradientDeg}deg 360deg)`,
              }}
            >
              <span style={{ width: 46, height: 46, borderRadius: '50%', background: '#ffffff', display: 'grid', placeItems: 'center', color: CREATIVE.inkStrong }}>
                {saudeScore}%
              </span>
            </div>
          </div>
        </div>

        {alertas.length > 0 && (
          <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            {alertas.map((alerta) => (
              <Link
                key={alerta.title}
                href={alerta.href}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  borderRadius: 999,
                  padding: '7px 14px',
                  background: '#ffffff',
                  border: `1px solid ${CREATIVE.accentBorder}`,
                  textDecoration: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  color: CREATIVE.inkStrong,
                  boxShadow: '0 1px 3px rgba(0,0,0,.04)',
                }}
              >
                <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: CREATIVE.accent }} />
                {alerta.title}
                <span style={{ color: CREATIVE.accentStrong }}>{alerta.value}</span>
                <span aria-hidden style={{ color: CREATIVE.softText }}>›</span>
              </Link>
            ))}
          </div>
        )}
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
                background: periodoAtual === key ? CREATIVE.accent : '#eef6ff',
                color: periodoAtual === key ? '#eef6ff' : CREATIVE.accentStrong,
                border: `1.5px solid ${periodoAtual === key ? CREATIVE.accent : CREATIVE.accentBorder}`,
                boxShadow: periodoAtual === key ? '0 8px 18px rgba(249,115,22,.22)' : 'none',
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
            badge: '⬆ 12%', badgeColor: '#34c759', badgeBg: 'rgba(52,199,89,.1)'
          },
          {
            label: 'Ticket médio',
            value: fmtBRL(ticketMedio),
            note: aguardando > 0 ? `${aguardando} aguardando` : 'Sem fila',
            badge: 'Estável', badgeColor: CREATIVE.accentStrong, badgeBg: 'rgba(249,115,22,.12)'
          },
          {
            label: 'Base ativa',
            value: `${totalAlunos}`,
            note: `${totalResponsaveis} responsáveis`,
            badge: 'Alunos', badgeColor: CREATIVE.rose, badgeBg: 'rgba(255,45,85,.1)'
          },
          {
            label: 'Catálogo',
            value: `${produtosAtivos}`,
            note: `${esgotados} esgotados · ${urgenciasPrazo} críticos`,
            badge: 'Itens', badgeColor: '#ff383c', badgeBg: 'rgba(255,56,60,.1)'
          },
        ].map((card) => (
          <article
            key={card.label}
            style={{
              borderRadius: 22, padding: '18px 20px',
              background: '#ffffff',
              boxShadow: CREATIVE.panelShadow,
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800, color: '#6c6c70' }}>
                {card.label}
              </div>
              <span style={{ fontSize: 10, fontWeight: 800, color: card.badgeColor, background: card.badgeBg, padding: '4px 8px', borderRadius: 8 }}>{card.badge}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.03em', marginTop: 10, color: '#1c1c1e', lineHeight: 1 }}>
              {card.value}
            </div>
            <div style={{ fontSize: 12, marginTop: 8, fontWeight: 600, color: '#8e8e93' }}>
              {card.note}
            </div>
          </article>
        ))}
      </section>

      {/* MÓDULOS SOB DEMANDA — só aparecem quando o módulo tem dados */}
      {(adesaoEventos.length > 0 || capacidadeMap.length > 0 || cantinaSaldoTotal > 0) && (
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {/* Adesão de Eventos */}
        {adesaoEventos.length > 0 && (
        <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#2c2c2e', margin: 0 }}>Adesão de Eventos</h3>
              <p style={{ fontSize: 12, color: '#8e8e93', margin: '2px 0 0' }}>Engajamento nas compras</p>
            </div>
            <span style={{ fontSize: 24 }}>🎟️</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {adesaoEventos.length > 0 ? adesaoEventos.map(({ evento, pagantes, total, adesao }) => (
              <div key={evento.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>{evento.nome}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: CREATIVE.accentStrong, background: CREATIVE.accentSoft, padding: '2px 8px', borderRadius: 6, flexShrink: 0 }}>{adesao}%</span>
                </div>
                <div style={{ width: '100%', background: '#f2f2f7', height: 10, borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${adesao}%`, height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${CREATIVE.accent}, ${CREATIVE.rose})` }} />
                </div>
                <p style={{ fontSize: 10, color: '#8e8e93', marginTop: 4 }}>{pagantes} de {total} alunos aderiram</p>
              </div>
            )) : (
              <div style={{ fontSize: 12, color: '#8e8e93', textAlign: 'center', padding: '24px 0' }}>Nenhum evento ativo.</div>
            )}
          </div>
        </div>
        )}

        {/* Eventos para vigiar (capacidade) */}
        {capacidadeMap.length > 0 && (
        <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#2c2c2e', margin: 0 }}>Eventos para vigiar</h3>
              <p style={{ fontSize: 12, color: '#8e8e93', margin: '2px 0 0' }}>Ocupação e risco de ruptura</p>
            </div>
            <span style={{ fontSize: 24 }}>📊</span>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {capacidadeMap.slice(0, 5).map((item) => (
              <div key={item.id} style={{ display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#1c1c1e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.nome}
                    </div>
                    <div style={{ fontSize: 11, color: '#8e8e93', marginTop: 2 }}>{item.ocupados}/{item.capacidade} ingressos ocupados</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: item.percentual >= 90 ? '#b91c1c' : CREATIVE.accentStrong }}>
                    {item.percentual}%
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: '#e5e5ea', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${item.percentual}%`,
                      height: '100%',
                      borderRadius: 999,
                      background: item.percentual >= 90 ? '#ef4444' : CREATIVE.accent,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        )}

        {/* Saúde da Cantina */}
        {cantinaSaldoTotal > 0 && (
        <div style={{ ...panelStyle, background: 'linear-gradient(135deg, #fff3e8, #ffe8cf)', border: 'none', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#3c3c43', margin: 0 }}>Saúde da Cantina</h3>
              <p style={{ fontSize: 12, color: 'rgba(60,60,67,.7)', margin: '2px 0 0' }}>Saldos depositados</p>
            </div>
            <span style={{ fontSize: 24 }}>🍔</span>
          </div>
          <div style={{ marginTop: 'auto' }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(60,60,67,.6)', marginBottom: 4 }}>Passivo de Carteiras</p>
            <p style={{ fontSize: 30, fontWeight: 900, color: '#3c3c43', letterSpacing: '-.02em', margin: 0 }}>{fmtBRL(cantinaSaldoTotal)}</p>
            <p style={{ fontSize: 12, color: 'rgba(60,60,67,.7)', marginTop: 12, lineHeight: 1.55 }}>
              Valor total "guardado" pela escola nas carteiras digitais dos alunos da cantina.
            </p>
          </div>
        </div>
        )}
      </section>
      )}

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(300px, 1fr)', gap: 16, alignItems: 'start' }}>
        <article style={{ ...panelStyle, display: 'flex', flexDirection: 'column', minHeight: 340 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#2c2c2e', letterSpacing: '-.01em', margin: 0 }}>Receita confirmada</h2>
              <p style={{ fontSize: 12, color: '#8e8e93', fontWeight: 500, marginTop: 2 }}>Visão consolidada de vendas diárias pagas</p>
            </div>
          </div>
          <div style={{ flex: 1, width: '100%' }}>
            <SalesChart data={salesSeries} />
          </div>
        </article>

        <article style={{ ...panelStyle, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#2c2c2e', margin: 0 }}>Recuperação de PIX</h3>
              <p style={{ fontSize: 12, color: '#8e8e93', margin: '2px 0 0' }}>Nas últimas 24h</p>
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
                  <div key={pix.id} style={{ background: '#fff', border: '1px solid #f2f2f7', borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2e', margin: 0 }}>{fmtBRL(pix.total)}</p>
                      <p style={{ fontSize: 11, color: '#8e8e93', margin: '2px 0 0', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nomeResp}</p>
                    </div>
                    {fone ? (
                      <a
                        href={`https://wa.me/55${fone}?text=${encodeURIComponent(`Olá ${nomeResp}! Vimos que você gerou um PIX de ${fmtBRL(pix.total)} na Loja Escolar e ainda não foi pago. Precisando de ajuda, estamos à disposição!`)}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ background: '#e7f9ed', color: '#059669', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}
                      >
                        Lembrar
                      </a>
                    ) : (
                      <span style={{ fontSize: 10, color: '#8e8e93' }}>Sem fone</span>
                    )}
                  </div>
                )
              })
            ) : (
              <div style={{ fontSize: 12, color: '#8e8e93', textAlign: 'center', padding: '24px 0' }}>Nenhum PIX pendente recente.</div>
            )}
          </div>
        </article>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(320px, 1fr)', gap: 16, alignItems: 'start' }}>
        <article style={panelStyle}>
          <div
            style={{
              paddingBottom: 14,
              borderBottom: '1px solid #f2f2f7',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#8e8e93' }}>
                Operação recente
              </div>
              <h2 style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.02em', color: '#1c1c1e', margin: '5px 0 0' }}>
                Pedidos recentes
              </h2>
            </div>

            <Link href={buildPedidosHref(interval.fromDateInput, interval.toDateInput)} style={textLinkStyle}>
              Ver todos
            </Link>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
              <thead>
                <tr style={{ background: '#f6f6f8' }}>
                  {['Pedido', 'Responsavel', 'Itens', 'Metodo', 'Total', 'Status'].map((header) => (
                    <th
                      key={header}
                      style={{
                        padding: '12px 14px',
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 800,
                        color: '#8e8e93',
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
                    <tr key={pedido.id} style={{ borderTop: index === 0 ? 'none' : '1px solid #f2f2f7' }}>
                      <td style={tableCellStyle}>
                        <Link href={`/pedido/${pedido.id}`} style={{ color: CREATIVE.link, textDecoration: 'none', fontWeight: 800, fontFamily: 'monospace' }}>
                          #{pedido.numero.replace('PED-', '')}
                        </Link>
                        <div style={{ fontSize: 11, color: '#8e8e93', marginTop: 2 }}>{fmtData(pedido.data_criacao)}</div>
                      </td>
                      <td style={tableCellStyle}>{responsavelNome}</td>
                      <td style={tableCellStyle}>{itensLabel}</td>
                      <td style={tableCellStyle}>{pedido.metodo_pagamento ? METODO_LABEL[pedido.metodo_pagamento] : '—'}</td>
                      <td style={{ ...tableCellStyle, fontWeight: 800, color: '#1c1c1e' }}>{fmtBRL(Number(pedido.total))}</td>
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
                    <td colSpan={6} style={{ padding: '34px 20px', textAlign: 'center', color: '#8e8e93', fontSize: 13 }}>
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
            eyebrow="Mix de vendas"
            title="Top produtos e categorias"
            description="O que vende e onde a receita se concentra."
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
                    background: '#f6f6f8',
                    border: 'none',
                    padding: '14px 16px',
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      background: CREATIVE.accentSoft,
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 900,
                      color: CREATIVE.accentStrong,
                    }}
                  >
                    #{index + 1}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#1c1c1e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {produto.nome}
                    </div>
                    <div style={{ fontSize: 12, color: '#8e8e93', marginTop: 3 }}>
                      {produto.vendas} vendas · {fmtBRL(produto.receita)}
                    </div>
                  </div>
                    {(() => {
                      const meta = CATEGORY_META[produto.categoria as keyof typeof CATEGORY_META] || CATEGORY_META.outros;
                      return (
                        <div
                          style={{
                            borderRadius: 999,
                            padding: '4px 10px',
                            fontSize: 11,
                            fontWeight: 800,
                            color: meta.color,
                            background: `${meta.color}12`,
                          }}
                        >
                          {meta.label}
                        </div>
                      );
                    })()}
                </div>
              ))
            ) : (
              <EmptyPanel text="Ainda nao ha itens vendidos no periodo para formar ranking." />
            )}
          </div>
          <div style={{ height: 1, background: '#f2f2f7', margin: '18px 0 14px' }} />
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#8e8e93', marginBottom: 10 }}>
            Distribuição por categoria
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {categoryPerformance.length > 0 ? (
              categoryPerformance.map((item) => {
                const meta = CATEGORY_META[item.categoria as keyof typeof CATEGORY_META] || CATEGORY_META.outros;
                return (
                <div key={item.categoria} style={{ display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1c1c1e' }}>
                      {meta.icon} {meta.label}
                    </span>
                    <span style={{ fontSize: 12, color: '#8e8e93', fontWeight: 700 }}>{item.percentual}%</span>
                  </div>
                  <div style={{ height: 10, borderRadius: 999, background: '#e5e5ea', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${item.percentual}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: meta.color,
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: '#8e8e93' }}>{item.vendas} itens vendidos no periodo</div>
                </div>
              )})
            ) : (
              <EmptyPanel text="Sem volume suficiente para gerar leitura por categoria." />
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
          href: '/admin/pedidos',
        }
      : null,
    urgenciasPrazo > 0
      ? {
          title: 'Janela comercial curta',
          value: `${urgenciasPrazo} produtos`,
          href: '/admin/produtos',
        }
      : null,
    esgotados > 0
      ? {
          title: 'Catálogo rompido',
          value: `${esgotados} item(ns)`,
          href: '/admin/produtos',
        }
      : null,
    soldOutRisk > 0
      ? {
          title: 'Capacidade no limite',
          value: `${soldOutRisk} eventos`,
          href: '/admin/produtos',
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; value: string; href: string }>
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
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: CREATIVE.accentStrong }}>
        {eyebrow}
      </div>
      <h2 style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.02em', color: CREATIVE.inkStrong, margin: 0, lineHeight: 1.1 }}>
        {title}
      </h2>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: '#8e8e93', margin: 0, fontWeight: 500 }}>{description}</p>
    </div>
  )
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: '1px dashed #c7c7cc',
        padding: '20px 16px',
        color: '#6c6c70',
        background: '#f6f6f8',
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
  border: `1px solid ${CREATIVE.accentBorder}`,
  borderRadius: 22,
  padding: 22,
  boxShadow: CREATIVE.panelShadow,
  position: 'relative'
} as const

const labelStyle = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: '#6c6c70',
  marginBottom: 6,
  letterSpacing: '.05em',
} as const

const inputStyle = {
  height: 40,
  borderRadius: 10,
  border: '1.5px solid #e5e5ea',
  background: '#f6f6f8',
  padding: '0 12px',
  fontSize: 13,
  color: '#1c1c1e',
  fontFamily: 'inherit',
} as const

const primaryPillButton = {
  height: 40,
  padding: '0 14px',
  borderRadius: 999,
  background: '#1c1c1e',
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
  background: CREATIVE.accentSoft,
  color: CREATIVE.link,
  border: `1px solid ${CREATIVE.accentBorder}`,
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
  color: '#3c3c43',
} as const

const textLinkStyle = {
  fontSize: 12,
  fontWeight: 700,
  color: CREATIVE.link,
  textDecoration: 'none',
} as const
