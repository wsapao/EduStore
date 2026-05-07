import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { RecargasClient } from './RecargasClient'
import { SolicitacoesClient } from './SolicitacoesClient'

export const dynamic = 'force-dynamic'

export default async function RecargasAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (user.app_metadata?.role !== 'admin') redirect('/loja')

  const adminClient = createAdminClient()

  const [{ data: recargas }, { data: solicitacoes }] = await Promise.all([
    adminClient
      .from('cantina_recargas')
      .select(`
        id, status, metodo, valor, created_at,
        confirmada_em, cancelada_em, estornada_em, gateway_id,
        carteira:cantina_carteiras!carteira_id(
          aluno:alunos!aluno_id(nome, serie)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100),
    adminClient
      .from('cantina_solicitacoes_estorno')
      .select(`
        id, motivo, created_at,
        recarga:cantina_recargas!recarga_id(
          id, valor, metodo, gateway_id,
          carteira:cantina_carteiras!carteira_id(
            aluno:alunos!aluno_id(nome, serie)
          )
        )
      `)
      .eq('status', 'pendente')
      .order('created_at', { ascending: true }),
  ])

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

  const listaSolicitacoes = (solicitacoes ?? []).map((s: any) => ({
    id: s.id,
    motivo: s.motivo,
    created_at: s.created_at,
    recarga_id: s.recarga?.id ?? '',
    valor: Number(s.recarga?.valor ?? 0),
    metodo: s.recarga?.metodo ?? '',
    gateway_id: s.recarga?.gateway_id ?? null,
    aluno_nome: s.recarga?.carteira?.aluno?.nome ?? '—',
    aluno_serie: s.recarga?.carteira?.aluno?.serie ?? '',
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

      {listaSolicitacoes.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
            padding: '12px 16px',
            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 10,
          }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#f59e0b' }}>
                {listaSolicitacoes.length} solicitação{listaSolicitacoes.length > 1 ? 'ões' : ''} de estorno pendente{listaSolicitacoes.length > 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: 12, color: '#92400e' }}>
                Aguardando sua aprovação ou negação
              </div>
            </div>
          </div>
          <SolicitacoesClient solicitacoes={listaSolicitacoes} />
        </div>
      )}

      <RecargasClient recargas={lista} />
    </div>
  )
}
