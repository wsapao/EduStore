import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ativarCarteiraAction } from '@/app/actions/cantina'

function fmtBRL(v: number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export default async function CantinaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Buscar alunos vinculados
  const { data: vinculos } = await supabase
    .from('responsavel_aluno')
    .select('aluno_id')
    .eq('responsavel_id', user.id)

  const alunoIds = (vinculos ?? []).map(v => v.aluno_id)

  if (alunoIds.length === 0) {
    return (
      <div style={{ maxWidth: 640, margin: '48px auto', padding: '0 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🍽️</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', marginBottom: 8 }}>
          Cantina Escolar
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-2)', marginBottom: 24 }}>
          Você não tem alunos vinculados. Cadastre seus filhos para acessar a cantina.
        </p>
        <Link href="/perfil/alunos" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'var(--brand)', color: '#fff', borderRadius: 'var(--r-md)',
          padding: '12px 24px', fontSize: 14, fontWeight: 700, textDecoration: 'none',
        }}>
          Cadastrar filhos
        </Link>
      </div>
    )
  }

  const trinta = new Date()
  trinta.setDate(trinta.getDate() - 30)

  // Todas as queries em paralelo (alunos, carteiras, movimentações e pedidos juntos)
  const [{ data: alunos }, { data: carteiras }, { data: pedidosPendentes }] = await Promise.all([
    supabase.from('alunos').select('id, nome, serie, turma').in('id', alunoIds),
    supabase.from('cantina_carteiras').select('*').in('aluno_id', alunoIds),
    supabase.from('cantina_pedidos').select('id').in('aluno_id', alunoIds).eq('tipo', 'online').in('status', ['aberto', 'confirmado', 'pronto']),
  ])

  // Movimentações usando aluno_id diretamente (sem precisar dos carteiraIds)
  const { data: movs30 } = await supabase
    .from('cantina_movimentacoes')
    .select('carteira_id, tipo, valor, created_at')
    .in('carteira_id', (carteiras ?? []).map(c => c.id).length > 0 ? (carteiras ?? []).map(c => c.id) : [''])
    .gte('created_at', trinta.toISOString())

  const saldoTotal = (carteiras ?? []).reduce((s, c) => s + Number(c.saldo), 0)
  const consumoMes = (movs30 ?? [])
    .filter(m => m.tipo === 'consumo')
    .reduce((s, m) => s + Number(m.valor), 0)

  const statCards = [
    { label: 'Saldo total', value: fmtBRL(saldoTotal), icon: '💰', bg: '#ecfdf5', color: '#065f46' },
    { label: 'Consumo no mês', value: fmtBRL(consumoMes), icon: '🍽️', bg: '#fef3c7', color: '#92400e' },
    { label: 'Pedidos pendentes', value: String((pedidosPendentes ?? []).length), icon: '⏳', bg: '#eef2ff', color: '#3730a3' },
  ]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px 48px', display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Hero */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-xl)', padding: '28px 28px 24px',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 'var(--r-lg)',
            background: 'var(--brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, boxShadow: '0 4px 14px rgba(26,47,90,.25)',
          }}>
            🍽️
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', margin: 0, letterSpacing: '-.02em' }}>
              Cantina Escolar
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '3px 0 0', fontWeight: 500 }}>
              Carteiras digitais dos seus filhos
            </p>
          </div>
        </div>

        {/* Mini stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {statCards.map(({ label, value, icon, bg, color }) => (
            <div key={label} style={{
              background: bg, borderRadius: 'var(--r-md)', padding: '14px 16px',
            }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color, letterSpacing: '-.02em' }}>{value}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color, opacity: .7, marginTop: 2 }}>
                {label.toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cards por aluno */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {(alunos ?? []).map(aluno => {
          const carteira = (carteiras ?? []).find(c => c.aluno_id === aluno.id)
          const movsAluno = carteira
            ? (movs30 ?? []).filter(m => m.carteira_id === carteira.id)
            : []
          const consumoAlunoMes = movsAluno.filter(m => m.tipo === 'consumo').reduce((s, m) => s + Number(m.valor), 0)
          const ultimoConsumo = movsAluno.filter(m => m.tipo === 'consumo').sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
          const ultimaRecarga = movsAluno.filter(m => m.tipo === 'recarga').sort((a, b) => b.created_at.localeCompare(a.created_at))[0]

          return (
            <div key={aluno.id} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)', overflow: 'hidden',
              boxShadow: 'var(--shadow-sm)',
            }}>
              {/* Header do aluno */}
              <div style={{
                padding: '20px 24px 16px',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 'var(--r-pill)',
                    background: 'linear-gradient(135deg,#667eea,#764ba2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, fontWeight: 700, color: '#fff',
                    flexShrink: 0,
                  }}>
                    {aluno.nome.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>
                      {aluno.nome}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>
                      {aluno.serie}{aluno.turma ? ` · Turma ${aluno.turma}` : ''}
                    </div>
                  </div>
                </div>

                {carteira ? (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--brand)', letterSpacing: '-.03em' }}>
                      {fmtBRL(Number(carteira.saldo))}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>SALDO DISPONÍVEL</div>
                    {!carteira.ativo && (
                      <div style={{
                        marginTop: 4, fontSize: 11, fontWeight: 700,
                        color: '#991b1b', background: '#fee2e2',
                        padding: '2px 8px', borderRadius: 'var(--r-pill)', display: 'inline-block',
                      }}>
                        BLOQUEADA
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Corpo */}
              {carteira ? (
                <div style={{ padding: '16px 24px 20px' }}>
                  {/* Mini stats do aluno */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
                    <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '10px 12px' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginBottom: 4 }}>LIMITE DIÁRIO</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>
                        {carteira.limite_diario ? fmtBRL(Number(carteira.limite_diario)) : 'Sem limite'}
                      </div>
                    </div>
                    <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '10px 12px' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginBottom: 4 }}>ÚLT. CONSUMO</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>
                        {ultimoConsumo ? fmtData(ultimoConsumo.created_at) : '—'}
                      </div>
                    </div>
                    <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '10px 12px' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginBottom: 4 }}>ÚLT. RECARGA</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>
                        {ultimaRecarga ? fmtData(ultimaRecarga.created_at) : '—'}
                      </div>
                    </div>
                  </div>

                  {/* Botões */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[
                      { href: `/cantina/${aluno.id}/recarga`, label: '💳 Recarregar', primary: true },
                      { href: `/cantina/${aluno.id}/cartao`, label: '📱 Cartão virtual', primary: false },
                      { href: `/cantina/${aluno.id}/extrato`, label: '📋 Extrato', primary: false },
                      { href: `/cantina/${aluno.id}/configurar`, label: '⚙️ Configurar', primary: false },
                    ].map(({ href, label, primary }) => (
                      <Link key={href} href={href} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '9px 16px', borderRadius: 'var(--r-md)',
                        fontSize: 13, fontWeight: 700, textDecoration: 'none',
                        background: primary ? 'var(--brand)' : 'var(--surface-2)',
                        color: primary ? '#fff' : 'var(--text-2)',
                        border: primary ? 'none' : '1px solid var(--border)',
                        transition: 'all .15s var(--ease)',
                      }}>
                        {label}
                      </Link>
                    ))}
                  </div>

                  {consumoAlunoMes > 0 && (
                    <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>
                      Consumo nos últimos 30 dias: <strong style={{ color: 'var(--text-2)' }}>{fmtBRL(consumoAlunoMes)}</strong>
                    </div>
                  )}
                </div>
              ) : (
                /* Sem carteira */
                <div style={{ padding: '20px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>💳</div>
                  <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 16 }}>
                    Este aluno ainda não tem carteira digital na cantina.
                  </p>
                  <form action={async () => {
                    'use server'
                    await ativarCarteiraAction(aluno.id)
                  }}>
                    <button type="submit" style={{
                      background: 'var(--brand)', color: '#fff',
                      border: 'none', borderRadius: 'var(--r-md)',
                      padding: '10px 20px', fontSize: 13, fontWeight: 700,
                      cursor: 'pointer',
                    }}>
                      Ativar carteira
                    </button>
                  </form>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
