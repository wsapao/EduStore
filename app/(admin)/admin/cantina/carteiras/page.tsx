import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CarteirasClient } from './CarteirasClient'

export default async function AdminCantinaCarteirasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') redirect('/loja')

  const adminClient = createAdminClient()
  const { data: resp } = await adminClient.from('responsaveis').select('escola_id').eq('id', user.id).single()
  const escolaId = resp?.escola_id

  const { data: carteiras } = await adminClient
    .from('cantina_carteiras')
    .select(`
      id, saldo, limite_diario, ativo, bloqueio_motivo,
      aluno:alunos!aluno_id(id, nome, serie, turma)
    `)
    .eq('escola_id', escolaId)
    .order('created_at', { ascending: true })

  const saldoTotal = (carteiras ?? []).reduce((s, c) => s + (c.saldo ?? 0), 0)
  const bloqueadas = (carteiras ?? []).filter(c => !c.ativo).length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Link href="/admin/cantina" style={{
          width: 36, height: 36, borderRadius: 'var(--r-md)',
          background: 'var(--surface)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, textDecoration: 'none', color: 'var(--text-1)',
        }}>←</Link>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>Carteiras dos alunos</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '3px 0 0' }}>
            {(carteiras ?? []).length} carteiras · Saldo total: {saldoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            {bloqueadas > 0 && ` · ${bloqueadas} bloqueada${bloqueadas > 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
  <CarteirasClient carteiras={(carteiras ?? []) as any} />
    </div>
  )
}
