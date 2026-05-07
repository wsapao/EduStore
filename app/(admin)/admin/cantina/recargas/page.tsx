import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { RecargasClient } from './RecargasClient'

export const dynamic = 'force-dynamic'

export default async function RecargasAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (perfil?.role !== 'admin') redirect('/cantina')

  const adminClient = createAdminClient()

  const { data: recargas } = await adminClient
    .from('cantina_recargas')
    .select(`
      id, status, metodo, valor, created_at,
      confirmada_em, cancelada_em, estornada_em, gateway_id,
      carteira:cantina_carteiras!carteira_id(
        aluno:alunos!aluno_id(nome, serie)
      )
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  const lista = (recargas ?? []).map((r: any) => ({
    id: r.id,
    status: r.status,
    metodo: r.metodo,
    valor: Number(r.valor),
    created_at: r.created_at,
    confirmada_em: r.confirmada_em,
    cancelada_em: r.cancelada_em,
    estornada_em: r.estornada_em,
    gateway_id: r.gateway_id,
    aluno_nome: r.carteira?.aluno?.nome ?? '—',
    aluno_serie: r.carteira?.aluno?.serie ?? '',
  }))

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <Link href="/admin/cantina" style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, textDecoration: 'none', color: '#f1f5f9',
        }}>←</Link>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#f8fafc', margin: 0 }}>
            💰 Recargas
          </h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
            Gerencie, estorne ou cancele recargas
          </p>
        </div>
      </div>

      <RecargasClient recargas={lista} />
    </div>
  )
}
