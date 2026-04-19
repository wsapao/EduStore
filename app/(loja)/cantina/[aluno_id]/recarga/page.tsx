import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { RecargaClient } from './RecargaClient'

export default async function RecargaCantinaPage({
  params,
}: {
  params: Promise<{ aluno_id: string }>
}) {
  const { aluno_id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Valida vínculo
  const { data: vinculo } = await supabase
    .from('responsavel_aluno')
    .select('aluno_id')
    .eq('responsavel_id', user.id)
    .eq('aluno_id', aluno_id)
    .single()

  if (!vinculo) redirect('/cantina')

  const { data: aluno } = await supabase
    .from('alunos')
    .select('nome, serie')
    .eq('id', aluno_id)
    .single()

  const { data: carteira } = await supabase
    .from('cantina_carteiras')
    .select('id, saldo, ativo')
    .eq('aluno_id', aluno_id)
    .single()

  if (!carteira) redirect('/cantina')

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px 16px 100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link href="/cantina" style={{
          width: 36, height: 36, borderRadius: 'var(--r-md)',
          background: 'var(--surface)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, textDecoration: 'none', color: 'var(--text-1)',
          boxShadow: 'var(--shadow-xs)',
        }}>←</Link>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>
            Recarregar — {aluno?.nome}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
            {aluno?.serie} · Adicionar saldo à carteira
          </div>
        </div>
      </div>

      {!carteira.ativo && (
        <div style={{
          background: 'var(--danger-light)', border: '1.5px solid var(--danger)',
          borderRadius: 'var(--r-md)', padding: '12px 16px', marginBottom: 16,
          fontSize: 13, fontWeight: 600, color: '#991b1b',
        }}>
          🔒 Esta carteira está bloqueada. Desbloqueie em <Link href={`/cantina/${aluno_id}/configurar`} style={{ color: '#991b1b' }}>Configurar</Link> antes de recarregar.
        </div>
      )}

      <RecargaClient
        alunoId={aluno_id}
        alunoNome={aluno?.nome ?? ''}
        saldoAtual={carteira.saldo}
      />
    </div>
  )
}
