import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminTone } from '@/lib/admin-ui-tones'
import { summarizeCantinaMovementsMonth } from '@/lib/cantina/dashboard'
import { redirect } from 'next/navigation'
import { currentPermissions } from '@/lib/permissoes'
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

const dangerTone = getAdminTone('danger')

export default async function AdminCantinaPage() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')
    if (!(await currentPermissions()).includes('cantina.ver')) redirect('/admin')

    const adminClient = createAdminClient()

    // Escola do admin
    const { data: resp } = await adminClient.from('responsaveis').select('escola_id').eq('id', user.id).single()
    const escolaId = resp?.escola_id

    if (!escolaId) {
      throw new Error('Usuário admin não possui uma escola_id vinculada na tabela responsaveis.')
    }

    // Stats
    const [
      { data: carteiras, error: e1 },
      { data: movsDoMes, error: e2 },
      { data: pedidosOnlinePendentes, error: e3 },
      { data: movsRecentes, error: e4 },
      { data: produtos, error: e5 },
      { count: estornosPendentesCount },
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
      adminClient.from('cantina_solicitacoes_estorno')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pendente'),
    ])

    const errors = [e1, e2, e3, e4, e5].filter(Boolean)
    if (errors.length > 0) {
      throw new Error(`Erro no banco de dados: ${JSON.stringify(errors[0])}`)
    }

    const saldoTotal = (carteiras ?? []).reduce((s, c) => s + (c.saldo ?? 0), 0)
    const { recargasMes, consumoMes, estornosMes } = summarizeCantinaMovementsMonth(movsDoMes ?? [])

    const cardStyle = {
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-xl)', padding: '20px',
      boxShadow: 'var(--shadow-sm)', backdropFilter: 'blur(12px)',
    }

    const panelStyle = {
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-xl)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
      backdropFilter: 'blur(16px)',
    }

    return (
      <div style={{ paddingBottom: 80 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--text-1)', margin: 0, letterSpacing: '-.03em' }}>🍽️ Cantina</h1>
            <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '6px 0 0', fontWeight: 500 }}>
              Gestão de carteiras, produtos e movimentações
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/admin/cantina/produtos" style={{
              padding: '0 20px', height: 42, borderRadius: 12, display: 'inline-flex', alignItems: 'center',
              background: 'linear-gradient(135deg, #f97316, #fb923c)', color: '#fff', border: '1px solid #ea580c',
              fontSize: 13, fontWeight: 800, textDecoration: 'none', transition: 'all .2s'
            }}>
              📦 Produtos
            </Link>
            <Link href="/admin/cantina/carteiras" style={{
              padding: '0 20px', height: 42, borderRadius: 12, display: 'inline-flex', alignItems: 'center',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              color: 'var(--text-1)', fontSize: 13, fontWeight: 800, textDecoration: 'none', transition: 'all .2s'
            }}>
              👜 Carteiras
            </Link>
            <Link href="/admin/cantina/recargas" style={{
              padding: '0 20px', height: 42, borderRadius: 12, display: 'inline-flex', alignItems: 'center',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              color: 'var(--text-1)', fontSize: 13, fontWeight: 800, textDecoration: 'none', transition: 'all .2s'
            }}>
              💰 Recargas
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 16, marginBottom: 24 }} className="cantina-stats">
          {[
            { label: 'Saldo em carteiras', value: fmtMoeda(saldoTotal), note: 'Disponível para consumo', icon: '💳' },
            { label: 'Recargas do mês', value: fmtMoeda(recargasMes), note: 'Entradas na carteira', icon: '💰' },
            { label: 'Consumo do mês', value: fmtMoeda(consumoMes), note: 'Compras realizadas', icon: '🍽️' },
            {
              label: 'Estornos do mês',
              value: fmtMoeda(estornosMes),
              note: 'Recargas revertidas no período',
              icon: '↩️',
              valueColor: dangerTone.text,
              labelColor: '#991b1b',
              noteColor: '#7f1d1d',
              background: 'linear-gradient(180deg, #fff8f8 0%, #ffffff 100%)',
              border: `1px solid ${dangerTone.border}`,
            },
            { label: 'Pedidos online', value: String(pedidosOnlinePendentes?.length ?? 0), note: 'Aguardando retirada', icon: '📱' },
          ].map(stat => (
            <div key={stat.label} style={{ ...cardStyle, background: stat.background ?? cardStyle.background, border: stat.border ?? cardStyle.border }}>
              <div style={{ fontSize: 24, marginBottom: 10 }}>{stat.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: stat.labelColor ?? 'var(--text-3)', marginBottom: 6 }}>
                {stat.label}
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: stat.valueColor ?? '#f59e0b', letterSpacing: '-.02em' }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: stat.noteColor ?? 'var(--text-3)', marginTop: 6, fontWeight: 600 }}>{stat.note}</div>
            </div>
          ))}
        </div>

        {/* Alerta de estornos pendentes */}
        {(estornosPendentesCount ?? 0) > 0 && (
          <Link href="/admin/cantina/recargas" style={{ textDecoration: 'none', display: 'block', marginBottom: 20 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px',
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.35)',
              borderRadius: 'var(--r-xl)',
              cursor: 'pointer',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                  background: 'rgba(245,158,11,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20,
                }}>↩️</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#f59e0b' }}>
                    {estornosPendentesCount} solicitação{(estornosPendentesCount ?? 0) > 1 ? 'ões' : ''} de estorno aguardando análise
                  </div>
                  <div style={{ fontSize: 12, color: '#92400e', marginTop: 3 }}>
                    Clique para revisar e aprovar ou negar
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 18, color: '#f59e0b', flexShrink: 0 }}>→</div>
            </div>
          </Link>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }} className="cantina-grid">
          {/* Movimentações recentes */}
          <div style={panelStyle}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--text-1)' }}>Movimentações recentes</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, fontWeight: 500 }}>Últimas 10 operações</div>
            </div>
            <div>
              {(movsRecentes ?? []).length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14, fontWeight: 600 }}>
                  Nenhuma movimentação ainda.
                </div>
              ) : (movsRecentes ?? []).map((mov, i) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const m = mov as any
                const isEntrada = m.tipo === 'recarga' || m.tipo === 'estorno'
                return (
                  <div key={m.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 20px',
                    borderBottom: i < (movsRecentes?.length ?? 0) - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                      {TIPO_ICON[m.tipo] ?? '📋'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.carteira?.aluno?.nome ?? '—'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                        <span style={{ textTransform: 'capitalize' }}>{m.descricao ?? m.tipo}</span> · {fmtData(m.created_at)}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: isEntrada ? '#4ade80' : '#f87171', flexShrink: 0 }}>
                      {isEntrada ? '+' : '-'}{fmtMoeda(m.valor)}
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', textAlign: 'center', background: 'var(--surface-2)' }}>
              <Link href="/admin/cantina/carteiras" style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b', textDecoration: 'none' }}>
                Ver extrato completo →
              </Link>
            </div>
          </div>

          {/* Produtos */}
          <div style={panelStyle}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--text-1)' }}>Cardápio</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, fontWeight: 500 }}>
                {(produtos ?? []).filter(p => p.ativo).length} ativos de {(produtos ?? []).length} cadastrados
              </div>
            </div>
            <div>
              {(produtos ?? []).slice(0, 8).map((p, i) => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 20px',
                  borderBottom: i < Math.min(8, (produtos?.length ?? 0)) - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                    {p.icone ?? '🍽️'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-1)' }}>{p.nome}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{p.categoria}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: '#f59e0b' }}>{fmtMoeda(p.preco)}</div>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 999,
                      background: p.ativo ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
                      color: p.ativo ? '#4ade80' : '#f87171', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.05em'
                    }}>
                      {p.ativo ? 'Ativo' : 'Inativo'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', textAlign: 'center', background: 'var(--surface-2)' }}>
              <Link href="/admin/cantina/produtos" style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b', textDecoration: 'none' }}>
                Gerenciar cardápio →
              </Link>
            </div>
          </div>
        </div>

        <style>{`
          @media (max-width: 1280px) {
            .cantina-stats { grid-template-columns: repeat(3,1fr) !important; }
          }

          @media (max-width: 900px) {
            .cantina-grid { grid-template-columns: 1fr !important; }
            .cantina-stats { grid-template-columns: repeat(2,1fr) !important; }
          }

          @media (max-width: 560px) {
            .cantina-stats { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    )
  } catch (error: any) {
    return (
      <div style={{ padding: 40, background: '#7f1d1d', borderRadius: 20, color: '#fef2f2', border: '2px solid #b91c1c' }}>
        <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 12 }}>⚠️ Erro Crítico na Cantina</h2>
        <p style={{ fontSize: 14, fontWeight: 600, opacity: 0.9 }}>{error.message || String(error)}</p>
      </div>
    )
  }
}
