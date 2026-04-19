import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ProdutosClient } from './ProdutosClient'

export default async function AdminCantinaProdutosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') redirect('/loja')

  const adminClient = createAdminClient()
  const { data: resp } = await adminClient.from('responsaveis').select('escola_id').eq('id', user.id).single()
  const escolaId = resp?.escola_id

  const { data: produtos } = await adminClient
    .from('cantina_produtos')
    .select('*')
    .eq('escola_id', escolaId)
    .order('ordem', { ascending: true })

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
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>Cardápio da cantina</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '3px 0 0' }}>
            {(produtos ?? []).filter(p => p.ativo).length} produtos ativos
          </p>
        </div>
      </div>

      <ProdutosClient produtos={produtos ?? []} />
    </div>
  )
}
