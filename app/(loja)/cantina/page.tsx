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
      <div style={{ background: '#f0f2f8', minHeight: '100vh', padding: '48px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🍽️</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0a1628', marginBottom: 8 }}>
          Cantina Escolar
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>
          Você não tem alunos vinculados. Cadastre seus filhos para acessar a cantina.
        </p>
        <Link href="/perfil/alunos" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: '#0a1628', color: '#fff', borderRadius: 13,
          padding: '12px 24px', fontSize: 14, fontWeight: 800, textDecoration: 'none',
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

  return (
    <div style={{ background: '#f0f2f8', minHeight: '100vh', paddingBottom: 80, margin:'0 auto' }}>
      
      {/* ── Top Bar ── */}
      <div style={{
        height: 52, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 10, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10
      }}>
        <Link href="/loja" style={{
          width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', textDecoration: 'none'
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </Link>
      </div>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg,#0a1628,#1e3a8a)', padding: '44px 14px 28px', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position:'absolute', top:-50, right:-30, width:160, height:160, background:'rgba(255,255,255,.05)', borderRadius:'50%' }} />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
          <div style={{
            width: 46, height: 46, background: 'white', borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, boxShadow: '0 4px 12px rgba(0,0,0,.15)'
          }}>
            🍔
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'white', letterSpacing: '-.02em', lineHeight: 1.2 }}>
              Cantina Digital
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', marginTop: 2, fontWeight: 500 }}>
              Gerencie a carteira dos seus filhos
            </div>
          </div>
        </div>
      </div>

      {/* Total Geral (opcional, mostra um resumo consolidado) */}
      <div style={{
        background: 'white', border: '1.5px solid rgba(0,0,0,.07)', borderRadius: 16,
        padding: '16px', margin: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,.04)'
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em' }}>Saldo Total Familiar</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#0a1628', letterSpacing: '-.03em', lineHeight: 1, marginTop: 4 }}>{fmtBRL(saldoTotal)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em' }}>Consumo 30d</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#ea580c', letterSpacing: '-.02em', lineHeight: 1, marginTop: 4 }}>{fmtBRL(consumoMes)}</div>
        </div>
      </div>

      {/* Cards por aluno */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {(alunos ?? []).map(aluno => {
          const carteira = (carteiras ?? []).find(c => c.aluno_id === aluno.id)
          const movsAluno = carteira
            ? (movs30 ?? []).filter(m => m.carteira_id === carteira.id)
            : []
          const ultimoConsumo = movsAluno.filter(m => m.tipo === 'consumo').sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
          const ultimaRecarga = movsAluno.filter(m => m.tipo === 'recarga').sort((a, b) => b.created_at.localeCompare(a.created_at))[0]

          return (
            <div key={aluno.id}>
              
              {/* Header do aluno */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', marginBottom: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10, background: '#f8f9fd', border: '1.5px solid rgba(0,0,0,.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#3b82f6'
                }}>
                  {aluno.nome.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0a1628', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {aluno.nome}
                  </div>
                  <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1, fontWeight: 600 }}>
                    {aluno.serie}{aluno.turma ? ` · Turma ${aluno.turma}` : ''}
                  </div>
                </div>
              </div>

              {carteira ? (
                <>
                  {/* Saldo Card */}
                  <div style={{
                    background: 'white', borderRadius: 16, padding: 16, margin: '0 14px 16px', position: 'relative', zIndex: 2,
                    boxShadow: '0 4px 14px rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1.5px solid rgba(0,0,0,.04)'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em' }}>Saldo Disponível</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: '#16a34a', letterSpacing: '-.03em', lineHeight: 1 }}>{fmtBRL(Number(carteira.saldo))}</div>
                      {!carteira.ativo && (
                        <div style={{ marginTop: 4, fontSize: 9, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase' }}>BLOQUEADA</div>
                      )}
                    </div>
                    <Link href={`/cantina/${aluno.id}/recarga`} style={{
                      background: '#16a34a', color: 'white', border: 'none', height: 38, padding: '0 14px', borderRadius: 10,
                      fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 3px 10px rgba(22,163,74,.3)', textDecoration: 'none'
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Recarregar
                    </Link>
                  </div>

                  {/* Actions Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, margin: '0 14px 16px' }}>
                    <Link href={`/cantina/${aluno.id}/cartao`} style={{
                      background: 'white', border: '1.5px solid rgba(0,0,0,.05)', borderRadius: 12, padding: '12px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textDecoration: 'none'
                    }}>
                      <div style={{ fontSize: 20 }}>📱</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#0a1628' }}>Cartão</div>
                    </Link>
                    <Link href={`/cantina/${aluno.id}/extrato`} style={{
                      background: 'white', border: '1.5px solid rgba(0,0,0,.05)', borderRadius: 12, padding: '12px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textDecoration: 'none'
                    }}>
                      <div style={{ fontSize: 20 }}>📋</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#0a1628' }}>Extrato</div>
                    </Link>
                    <Link href={`/cantina/${aluno.id}/configurar`} style={{
                      background: 'white', border: '1.5px solid rgba(0,0,0,.05)', borderRadius: 12, padding: '12px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textDecoration: 'none'
                    }}>
                      <div style={{ fontSize: 20 }}>⚙️</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#0a1628' }}>Ajustes</div>
                    </Link>
                  </div>

                  {/* Limites Info */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, margin: '0 14px 24px' }}>
                    <div style={{ background: 'white', border: '1.5px solid rgba(0,0,0,.07)', borderRadius: 14, padding: '12px 14px' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 2 }}>Limite Diário</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#0a1628' }}>{carteira.limite_diario ? fmtBRL(Number(carteira.limite_diario)) : 'Ilimitado'}</div>
                    </div>
                    <div style={{ background: 'white', border: '1.5px solid rgba(0,0,0,.07)', borderRadius: 14, padding: '12px 14px' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 2 }}>Último Uso</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#0a1628' }}>{ultimoConsumo ? fmtData(ultimoConsumo.created_at) : '—'}</div>
                    </div>
                  </div>
                </>
              ) : (
                /* Sem carteira */
                <div style={{ background: 'white', border: '1.5px solid rgba(0,0,0,.07)', borderRadius: 16, padding: '24px 20px', margin: '0 14px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>💳</div>
                  <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, fontWeight: 500 }}>
                    Este aluno ainda não tem carteira digital na cantina.
                  </p>
                  <form action={async () => {
                    'use server'
                    await ativarCarteiraAction(aluno.id)
                  }}>
                    <button type="submit" style={{
                      background: '#0a1628', color: '#fff', border: 'none', borderRadius: 12,
                      padding: '12px 20px', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(10,22,40,.3)'
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
