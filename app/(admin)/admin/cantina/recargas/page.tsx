import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminTone } from '@/lib/admin-ui-tones'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { currentPermissions } from '@/lib/permissoes'
import Link from 'next/link'
import { RecargasClient } from './RecargasClient'
import { SolicitacoesClient } from './SolicitacoesClient'

export const dynamic = 'force-dynamic'

export default async function RecargasAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!(await currentPermissions()).includes('cantina.ver')) redirect('/admin')

  const adminClient = createAdminClient()

  const [{ data: recargas }, { data: solicitacoes }] = await Promise.all([
    adminClient
      .from('cantina_recargas')
      .select(`
        id, status, metodo, valor, created_at,
        confirmada_em, cancelada_em, estornada_em, gateway_id, motivo_falha,
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
    motivo_falha: r.motivo_falha ?? null,
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

  const accentTone = getAdminTone('accent')
  const warningTone = getAdminTone('warning')
  const neutralTone = getAdminTone('neutral')

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <Link href="/admin/cantina" style={{
          width: 40, height: 40, borderRadius: 12,
          background: '#ffffff', border: `1px solid ${neutralTone.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, textDecoration: 'none', color: 'var(--text-1)',
          boxShadow: '0 10px 20px rgba(249,115,22,.08)',
        }}>←</Link>
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 999,
            background: accentTone.bg,
            border: `1px solid ${accentTone.border}`,
            color: accentTone.text,
            fontSize: 10,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '.08em',
            marginBottom: 8,
          }}>
            Financeiro da cantina
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 900, color: 'var(--text-1)', margin: 0, letterSpacing: '-.04em' }}>
            Recargas
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '6px 0 0', fontWeight: 500 }}>
            Gerencie, estorne ou cancele recargas
          </p>
        </div>
      </div>

      {listaSolicitacoes.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
            padding: '12px 16px',
            background: '#fff7ed', border: `1px solid ${warningTone.border}`,
            borderRadius: 16,
            boxShadow: '0 10px 24px rgba(245,158,11,.08)',
          }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: warningTone.text }}>
                {listaSolicitacoes.length} solicitação{listaSolicitacoes.length > 1 ? 'ões' : ''} de estorno pendente{listaSolicitacoes.length > 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: 12, color: '#9a3412' }}>
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
