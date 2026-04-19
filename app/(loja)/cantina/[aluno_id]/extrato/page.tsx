import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const PAGE_SIZE = 20

function fmtMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const TIPO_CONFIG: Record<string, { icon: string; label: string; cor: string }> = {
  recarga:       { icon: '💰', label: 'Recarga',       cor: '#10b981' },
  consumo:       { icon: '🍽️', label: 'Consumo',       cor: '#ef4444' },
  estorno:       { icon: '↩️', label: 'Estorno',       cor: '#f59e0b' },
  ajuste_manual: { icon: '✏️', label: 'Ajuste manual', cor: '#6366f1' },
}

export default async function ExtratoCantinaPage({
  params,
  searchParams,
}: {
  params: Promise<{ aluno_id: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { aluno_id } = await params
  const { page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1', 10))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Valida vínculo responsável → aluno
  const { data: vinculo } = await supabase
    .from('responsavel_aluno')
    .select('aluno_id')
    .eq('responsavel_id', user.id)
    .eq('aluno_id', aluno_id)
    .single()

  if (!vinculo) redirect('/cantina')

  // Dados do aluno
  const { data: aluno } = await supabase
    .from('alunos')
    .select('nome, serie')
    .eq('id', aluno_id)
    .single()

  // Carteira
  const { data: carteira } = await supabase
    .from('cantina_carteiras')
    .select('id, saldo')
    .eq('aluno_id', aluno_id)
    .single()

  if (!carteira) redirect('/cantina')

  // Movimentações paginadas
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const { data: movs, count } = await supabase
    .from('cantina_movimentacoes')
    .select('*', { count: 'exact' })
    .eq('carteira_id', carteira.id)
    .order('created_at', { ascending: false })
    .range(from, to)

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))

  // Stats do mês
  const inicioMes = new Date()
  inicioMes.setDate(1)
  inicioMes.setHours(0, 0, 0, 0)

  const { data: statsMes } = await supabase
    .from('cantina_movimentacoes')
    .select('tipo, valor')
    .eq('carteira_id', carteira.id)
    .gte('created_at', inicioMes.toISOString())

  const consumoMes = (statsMes ?? []).filter(m => m.tipo === 'consumo').reduce((s, m) => s + m.valor, 0)
  const recargasMes = (statsMes ?? []).filter(m => m.tipo === 'recarga').reduce((s, m) => s + m.valor, 0)

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '16px 16px 100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Link href="/cantina" style={{
          width: 36, height: 36, borderRadius: 'var(--r-md)',
          background: 'var(--surface)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, textDecoration: 'none', color: 'var(--text-1)',
          boxShadow: 'var(--shadow-xs)',
        }}>←</Link>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>
            Extrato — {aluno?.nome}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
            {aluno?.serie} · Histórico de movimentações
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
        {[
          { label: 'Saldo atual', value: fmtMoeda(carteira.saldo), cor: 'var(--brand)' },
          { label: 'Consumo este mês', value: fmtMoeda(consumoMes), cor: 'var(--danger)' },
          { label: 'Recargas este mês', value: fmtMoeda(recargasMes), cor: 'var(--success)' },
        ].map(stat => (
          <div key={stat.label} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)', padding: '14px 12px',
            boxShadow: 'var(--shadow-xs)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-3)', marginBottom: 6 }}>
              {stat.label}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: stat.cor }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Lista de movimentações */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
      }}>
        {/* Header da lista */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-1)' }}>
            Movimentações
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
            {count ?? 0} registros · Página {page} de {totalPages}
          </div>
        </div>

        {(!movs || movs.length === 0) ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', marginBottom: 6 }}>
              Nenhuma movimentação ainda
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
              O extrato aparecerá aqui após a primeira recarga ou consumo.
            </div>
          </div>
        ) : (
          movs.map((mov, i) => {
            const cfg = TIPO_CONFIG[mov.tipo] ?? TIPO_CONFIG.ajuste_manual
            const isEntrada = mov.tipo === 'recarga' || mov.tipo === 'estorno'
            return (
              <div key={mov.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px',
                borderBottom: i < movs.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                {/* Ícone */}
                <div style={{
                  width: 38, height: 38, borderRadius: 'var(--r-md)',
                  background: `${cfg.cor}18`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, flexShrink: 0,
                }}>
                  {cfg.icon}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>
                    {mov.descricao || cfg.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                    {fmtData(mov.created_at)}
                  </div>
                </div>

                {/* Valor + saldo */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 800,
                    color: isEntrada ? 'var(--success)' : 'var(--danger)',
                  }}>
                    {isEntrada ? '+' : '-'}{fmtMoeda(mov.valor)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                    saldo: {fmtMoeda(mov.saldo_apos)}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          {page > 1 && (
            <Link href={`/cantina/${aluno_id}/extrato?page=${page - 1}`} style={{
              padding: '8px 16px', borderRadius: 'var(--r-md)',
              background: 'var(--surface)', border: '1px solid var(--border)',
              fontSize: 13, fontWeight: 600, color: 'var(--text-2)',
              textDecoration: 'none',
            }}>
              ← Anterior
            </Link>
          )}
          <span style={{
            padding: '8px 16px', borderRadius: 'var(--r-md)',
            background: 'var(--brand)', color: '#fff',
            fontSize: 13, fontWeight: 700,
          }}>
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link href={`/cantina/${aluno_id}/extrato?page=${page + 1}`} style={{
              padding: '8px 16px', borderRadius: 'var(--r-md)',
              background: 'var(--surface)', border: '1px solid var(--border)',
              fontSize: 13, fontWeight: 600, color: 'var(--text-2)',
              textDecoration: 'none',
            }}>
              Próxima →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
