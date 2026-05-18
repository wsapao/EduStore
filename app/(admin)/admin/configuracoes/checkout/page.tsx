import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { hasPermission } from '@/lib/permissoes'
import type { EscolaConfiguracoes } from '@/types/database'
import { CheckoutForm } from './CheckoutForm'

export default async function CheckoutConfigPage() {
  if (!(await hasPermission('configuracoes.editar_identidade'))) {
    redirect('/admin/configuracoes')
  }

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-1)', marginBottom: 16 }}>Checkout</h1>
        <p style={{ color: 'var(--text-3)' }}>Sua conta não está vinculada a uma escola.</p>
      </div>
    )
  }

  const { data: config } = await supabase
    .from('escola_configuracoes')
    .select('*')
    .eq('escola_id', escolaId)
    .single<EscolaConfiguracoes>()

  if (!config) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-1)', marginBottom: 16 }}>Checkout</h1>
        <p style={{ color: '#ef4444' }}>Configurações da escola não encontradas.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-1)', marginBottom: 24 }}>Checkout</h1>
      <div style={{ maxWidth: 820 }}>
        <section style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 24,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)', marginBottom: 16 }}>
            Regras de pedidos e carrinho
          </h2>
          <CheckoutForm config={config} />
        </section>
      </div>
    </div>
  )
}
