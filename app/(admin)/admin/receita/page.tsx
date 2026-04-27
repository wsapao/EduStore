import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { MetodoPagamento } from '@/types/database'

type PeriodoDashboard = '7d' | '30d' | 'mes' | 'custom'

interface ItemReceita {
  produto_id: string
  produto_nome: string
  categoria: string
  metodo: MetodoPagamento
  quantidade: number
  bruto: number
  liquido: number | null
}

const METODO_LABEL: Record<MetodoPagamento, string> = {
  pix: 'PIX',
  cartao: 'Cartão',
  boleto: 'Boleto',
}

const METODO_COLOR: Record<MetodoPagamento, string> = {
  pix: '#10b981',
  cartao: '#6366f1',
  boleto: '#f59e0b',
}

function fmtBRL(v: number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtPct(v: number) {
  return `${v.toFixed(2).replace('.', ',')}%`
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

function resolveDateRange(periodo: PeriodoDashboard, from?: string, to?: string) {
  const now = new Date()
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))

  let start: Date | null = null
  let end: Date | null = null

  if (periodo === '7d') {
    start = new Date(today); start.setUTCDate(start.getUTCDate() - 6); end = new Date(today)
  } else if (periodo === '30d') {
    start = new Date(today); start.setUTCDate(start.getUTCDate() - 29); end = new Date(today)
  } else if (periodo === 'mes') {
    start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)); end = new Date(today)
  } else {
    start = parseDateInput(from); end = parseDateInput(to)
  }

  return {
    fromIso: start ? `${toDateInputValue(start)}T00:00:00.000Z` : null,
    toIso: end ? `${toDateInputValue(end)}T23:59:59.999Z` : null,
    fromInput: start ? toDateInputValue(start) : '',
    toInput: end ? toDateInputValue(end) : '',
    label: start && end
      ? `${start.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} até ${end.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`
      : '',
  }
}

export default async function ReceitaPage({
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
      ? periodo : '30d'

  const interval = resolveDateRange(periodoAtual, from, to)

  // Busca itens de pedidos pagos com pagamento associado (para ter valor_liquido)
  let query = supabase
    .from('itens_pedido')
    .select(`
      id,
      preco_unitario,
      produto:produtos(id, nome, categoria),
      pedido:pedidos!inner(
        id,
        status,
        total,
        metodo_pagamento,
        created_at,
        pagamento:pagamentos(metodo, total, valor_liquido, gateway_taxa)
      )
    `)
    .eq('pedido.status', 'pago')

  if (interval.fromIso) query = query.gte('pedido.created_at', interval.fromIso)
  if (interval.toIso)   query = query.lte('pedido.created_at', interval.toIso)

  const { data: itensRaw } = await query

  // Agrega por produto + método de pagamento
  // O valor líquido é rateado proporcionalmente ao peso do item no pedido
  const map = new Map<string, ItemReceita>()

  for (const item of (itensRaw ?? [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const i = item as any
    const produto = Array.isArray(i.produto) ? i.produto[0] : i.produto
    const pedido  = Array.isArray(i.pedido)  ? i.pedido[0]  : i.pedido
    if (!produto || !pedido) continue

    const pagamento = Array.isArray(pedido.pagamento) ? pedido.pagamento[0] : pedido.pagamento
    const metodo: MetodoPagamento = pagamento?.metodo ?? pedido.metodo_pagamento ?? 'pix'

    const brutoItem  = Number(i.preco_unitario)
    const totalPedido = Number(pedido.total) || 1

    // Rateio proporcional do líquido
    let liquidoItem: number | null = null
    if (pagamento?.valor_liquido != null) {
      const peso = brutoItem / totalPedido
      liquidoItem = Number(pagamento.valor_liquido) * peso
    }

    const key = `${produto.id}__${metodo}`
    const existing = map.get(key)

    if (existing) {
      existing.quantidade += 1
      existing.bruto      += brutoItem
      if (liquidoItem !== null) {
        existing.liquido = (existing.liquido ?? 0) + liquidoItem
      }
    } else {
      map.set(key, {
        produto_id:   produto.id,
        produto_nome: produto.nome,
        categoria:    produto.categoria,
        metodo,
        quantidade:   1,
        bruto:        brutoItem,
        liquido:      liquidoItem,
      })
    }
  }

  const linhas = [...map.values()].sort((a, b) => b.bruto - a.bruto)

  // Totais gerais
  const totalBruto   = linhas.reduce((s, l) => s + l.bruto, 0)
  const totalLiquido = linhas.filter(l => l.liquido != null).reduce((s, l) => s + (l.liquido ?? 0), 0)
  const totalTaxa    = totalBruto - totalLiquido
  const temLiquido   = linhas.some(l => l.liquido != null)

  const periodoLinks: Array<{ key: PeriodoDashboard; label: string }> = [
    { key: '7d', label: '7 dias' },
    { key: '30d', label: '30 dias' },
    { key: 'mes', label: 'Mês atual' },
  ]

  function buildHref(p: string) {
    return `/admin/receita?periodo=${p}`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 80 }}>

      {/* HEADER */}
      <section style={{ position: 'relative', overflow: 'hidden', padding: '10px 0 4px', color: '#fff' }}>
        <div style={{ position: 'absolute', top: -80, left: -40, width: 260, height: 260, background: '#10b981', filter: 'blur(120px)', opacity: 0.12, borderRadius: '50%', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#fcd34d', background: 'rgba(245,158,11,.15)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 999, padding: '5px 12px' }}>
                Financeiro
              </span>
              {interval.label && (
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', fontWeight: 600 }}>
                  {interval.label}
                </span>
              )}
            </div>
            <h1 style={{ fontSize: 38, fontWeight: 900, letterSpacing: '-.04em', margin: 0, lineHeight: 1.05 }}>
              Receita Líquida
            </h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,.55)', margin: 0, fontWeight: 500 }}>
              Valor real que entra na sua conta após as taxas do gateway de pagamento.
            </p>
          </div>
        </div>
      </section>

      {/* FILTROS */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {periodoLinks.map(({ key, label }) => (
          <Link
            key={key}
            href={buildHref(key)}
            style={{
              padding: '9px 16px', borderRadius: 12, textDecoration: 'none',
              fontSize: 13, fontWeight: 800,
              background: periodoAtual === key ? '#f59e0b' : 'rgba(255,255,255,.05)',
              color: periodoAtual === key ? '#78350f' : 'rgba(255,255,255,.7)',
              border: `1.5px solid ${periodoAtual === key ? '#f59e0b' : 'rgba(255,255,255,.1)'}`,
            }}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* CARDS DE TOTAIS */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {[
          {
            label: 'Receita Bruta',
            value: fmtBRL(totalBruto),
            note: 'Total faturado antes das taxas',
            color: '#f8fafc',
            accent: '#6366f1',
          },
          {
            label: 'Taxa do Gateway',
            value: temLiquido ? fmtBRL(totalTaxa) : '—',
            note: temLiquido ? `${fmtPct(totalBruto > 0 ? (totalTaxa / totalBruto) * 100 : 0)} sobre o bruto` : 'Aguardando primeiros pagamentos',
            color: '#f8fafc',
            accent: '#ef4444',
          },
          {
            label: 'Receita Líquida',
            value: temLiquido ? fmtBRL(totalLiquido) : '—',
            note: temLiquido ? 'O que cai na sua conta' : 'Disponível após o primeiro pagamento confirmado',
            color: '#f8fafc',
            accent: '#10b981',
          },
        ].map(card => (
          <div
            key={card.label}
            style={{
              borderRadius: 22,
              padding: '22px 24px',
              background: 'rgba(255,255,255,.04)',
              border: '1px solid rgba(255,255,255,.07)',
              backdropFilter: 'blur(16px)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: card.accent, marginBottom: 10 }}>
              {card.label}
            </div>
            <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-.03em', color: '#fff', lineHeight: 1 }}>
              {card.value}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', marginTop: 8, fontWeight: 500 }}>
              {card.note}
            </div>
          </div>
        ))}
      </section>

      {/* AVISO quando não há valor_liquido ainda */}
      {!temLiquido && (
        <div style={{
          borderRadius: 16, padding: '14px 18px',
          background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)',
          fontSize: 13, color: '#fcd34d', lineHeight: 1.6,
        }}>
          <strong>Nenhum valor líquido disponível ainda.</strong> O sistema captura automaticamente o valor líquido a partir do próximo pagamento confirmado pelo Asaas. Pedidos anteriores a esta atualização não possuem esse dado.
        </div>
      )}

      {/* TABELA POR PRODUTO */}
      <section style={{
        background: '#ffffff', borderRadius: 26, overflow: 'hidden',
        boxShadow: '0 12px 32px rgba(0,0,0,.35)',
      }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-.02em' }}>
            Detalhamento por produto
          </h2>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0', fontWeight: 500 }}>
            Cada linha representa um produto + método de pagamento. O líquido é rateado proporcionalmente por item.
          </p>
        </div>

        {linhas.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            Nenhuma venda encontrada neste período.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Produto', 'Método', 'Qtd', 'Bruto', 'Taxa gateway', 'Líquido', '% Taxa'].map(h => (
                    <th key={h} style={{
                      padding: '12px 16px', textAlign: 'left',
                      fontSize: 11, fontWeight: 800, color: '#94a3b8',
                      letterSpacing: '.07em', textTransform: 'uppercase',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha, i) => {
                  const taxa   = linha.liquido != null ? linha.bruto - linha.liquido : null
                  const pctTaxa = taxa != null && linha.bruto > 0 ? (taxa / linha.bruto) * 100 : null

                  return (
                    <tr key={`${linha.produto_id}__${linha.metodo}`} style={{ borderTop: i === 0 ? 'none' : '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{linha.produto_nome}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, textTransform: 'capitalize' }}>{linha.categoria}</div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '3px 10px', borderRadius: 999,
                          fontSize: 11, fontWeight: 800,
                          background: `${METODO_COLOR[linha.metodo]}15`,
                          color: METODO_COLOR[linha.metodo],
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: METODO_COLOR[linha.metodo] }} />
                          {METODO_LABEL[linha.metodo]}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 700, color: '#334155' }}>
                        {linha.quantidade}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                        {fmtBRL(linha.bruto)}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, color: taxa != null ? '#dc2626' : '#94a3b8', fontWeight: 600 }}>
                        {taxa != null ? `− ${fmtBRL(taxa)}` : '—'}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 900, color: linha.liquido != null ? '#059669' : '#94a3b8' }}>
                        {linha.liquido != null ? fmtBRL(linha.liquido) : '—'}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {pctTaxa != null ? (
                          <span style={{
                            fontSize: 12, fontWeight: 800, padding: '3px 8px', borderRadius: 8,
                            background: pctTaxa > 3 ? '#fef2f2' : '#f0fdf4',
                            color: pctTaxa > 3 ? '#dc2626' : '#059669',
                          }}>
                            {fmtPct(pctTaxa)}
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {/* Linha de totais */}
              <tfoot>
                <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
                  <td colSpan={3} style={{ padding: '14px 16px', fontSize: 13, fontWeight: 800, color: '#64748b' }}>
                    TOTAL
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 15, fontWeight: 900, color: '#0f172a' }}>
                    {fmtBRL(totalBruto)}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 800, color: temLiquido ? '#dc2626' : '#94a3b8' }}>
                    {temLiquido ? `− ${fmtBRL(totalTaxa)}` : '—'}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 15, fontWeight: 900, color: temLiquido ? '#059669' : '#94a3b8' }}>
                    {temLiquido ? fmtBRL(totalLiquido) : '—'}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 800, color: '#64748b' }}>
                    {temLiquido && totalBruto > 0 ? fmtPct((totalTaxa / totalBruto) * 100) : '—'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
