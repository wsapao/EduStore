import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

function fmtMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

const TIPO_ICON: Record<string, string> = {
  recarga: '💰', consumo: '🍽️', estorno: '↩️', ajuste_manual: '✏️',
}

export default async function AdminCantinaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') redirect('/loja')

  const adminClient = createAdminClient()

  // Escola do admin
  const { data: resp } = await adminClient.from('responsaveis').select('escola_id').eq('id', user.id).single()
  const escolaId = resp?.escola_id

  // Stats
  const [
    { data: carteiras },
    { data: movsDoMes },
    { data: pedidosOnlinePendentes },
    { data: movsRecentes },
    { data: produtos },
  ] = await Promise.all([
    adminClient.from('cantina_carteiras').select('saldo').eq('escola_id', escolaId),
    adminClient.from('cantina_movimentacoes')
      .select('tipo, valor, carteira_id, cantina_carteiras!inner(escola_id)')
      .eq('cantina_carteiras.escola_id', escolaId)
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    adminClient.from('cantina_pedidos')
      .select('id', { count: 'exact', head: true })
      .eq('escola_id', escolaId)
      .eq('tipo', 'online')
      .in('status', ['confirmado', 'pronto']),
    adminClient.from('cantina_movimentacoes')
      .select(`
        id, tipo, valor, descricao, created_at,
        carteira:cantina_carteiras!carteira_id(aluno:alunos!aluno_id(nome, serie))
      `)
      .order('created_at', { ascending: false })
      .limit(10),
    adminClient.from('cantina_produtos')
      .select('id, nome, preco, categoria, icone, ativo, estoque')
      .eq('escola_id', escolaId)
      .order('ordem', { ascending: true }),
  ])

  const saldoTotal = (carteiras ?? []).reduce((s, c) => s + (c.saldo ?? 0), 0)
  const recargasMes = (movsDoMes ?? []).filter(m => m.tipo === 'recarga').reduce((s, m) => s + m.valor, 0)
  const consumoMes = (movsDoMes ?? []).filter(m => m.tipo === 'consumo').reduce((s, m) => s + m.valor, 0)

  const cardStyle = {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)', padding: '18px',
    boxShadow: 'var(--shadow-xs)',
  }

  const panelStyle = {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>🍽️ Cantina</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '4px 0 0' }}>
            Gestão de carteiras, produtos e movimentações
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/admin/cantina/produtos" style={{
            padding: '9px 16px', borderRadius: 'var(--r-md)',
            background: 'var(--brand)', color: '#fff',
            fontSize: 13, fontWeight: 700, textDecoration: 'none',
          }}>
            📦 Produtos
          </Link>
          <Link href="/admin/cantina/carteiras" style={{
            padding: '9px 16px', borderRadius: 'var(--r-md)',
            background: 'var(--surface)', border: '1px solid var(--border)',
            color: 'var(--text-2)', fontSize: 13, fontWeight: 700, textDecoration: 'none',
          }}>
            👜 Carteiras
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Saldo em carteiras', value: fmtMoeda(saldoTotal), note: 'Disponível para consumo', icon: '💳' },
          { label: 'Recargas do mês', value: fmtMoeda(recargasMes), note: 'Entradas na carteira', icon: '💰' },
          { label: 'Consumo do mês', value: fmtMoeda(consumoMes), note: 'Compras realizadas', icon: '🍽️' },
          { label: 'Pedidos online', value: String(pedidosOnlinePendentes?.length ?? 0), note: 'Aguardando retirada', icon: '📱' },
        ].map(stat => (
          <div key={stat.label} style={cardStyle}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>{stat.icon}</div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-3)', marginBottom: 4 }}>
              {stat.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand)' }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{stat.note}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {/* Movimentações recentes */}
        <div style={panelStyle}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)' }}>Movimentações recentes</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Últimas 10 operações</div>
          </div>
          <div>
            {(movsRecentes ?? []).length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                Nenhuma movimentação ainda.
              </div>
            ) : (movsRecentes ?? []).map((mov, i) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const m = mov as any
              const isEntrada = m.tipo === 'recarga' || m.tipo === 'estorno'
              return (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 16px',
                  borderBottom: i < (movsRecentes?.length ?? 0) - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <span style={{ fontSize: 18 }}>{TIPO_ICON[m.tipo] ?? '📋'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.carteira?.aluno?.nome ?? '—'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {m.descricao ?? m.tipo} · {fmtData(m.created_at)}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: isEntrada ? 'var(--success)' : 'var(--danger)', flexShrink: 0 }}>
                    {isEntrada ? '+' : '-'}{fmtMoeda(m.valor)}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <Link href="/admin/cantina/carteiras" style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', textDecoration: 'none' }}>
              Ver extrato completo →
            </Link>
          </div>
        </div>

        {/* Produtos */}
        <div style={panelStyle}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)' }}>Cardápio</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              {(produtos ?? []).filter(p => p.ativo).length} ativos de {(produtos ?? []).length} cadastrados
            </div>
          </div>
          <div>
            {(produtos ?? []).slice(0, 8).map((p, i) => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '11px 16px',
                borderBottom: i < Math.min(8, (produtos?.length ?? 0)) - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <span style={{ fontSize: 20 }}>{p.icone ?? '🍽️'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>{p.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{p.categoria}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand)' }}>{fmtMoeda(p.preco)}</div>
                  <div style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 'var(--r-pill)',
                    background: p.ativo ? 'var(--success-light)' : 'var(--danger-light)',
                    color: p.ativo ? '#065f46' : '#991b1b', marginTop: 2,
                  }}>
                    {p.ativo ? 'Ativo' : 'Inativo'}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <Link href="/admin/cantina/produtos" style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', textDecoration: 'none' }}>
              Gerenciar cardápio →
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .cantina-grid { grid-template-columns: 1fr !important; }
          .cantina-stats { grid-template-columns: repeat(2,1fr) !important; }
        }
      `}</style>
    </div>
  )
}
