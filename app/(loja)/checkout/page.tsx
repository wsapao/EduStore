import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CheckoutClient } from './CheckoutClient'

export default async function CheckoutPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Termo padrão de compra (config /admin/configuracoes/checkout).
  // Aplicado como fallback quando o produto não define texto_termo próprio.
  const { data: resp } = await supabase
    .from('responsaveis')
    .select('escola_id')
    .eq('id', user.id)
    .maybeSingle<{ escola_id: string | null }>()

  let termoPadrao: string | null = null
  if (resp?.escola_id) {
    const { data: config } = await supabase
      .from('escola_configuracoes')
      .select('termo_padrao_compra')
      .eq('escola_id', resp.escola_id)
      .maybeSingle<{ termo_padrao_compra: string | null }>()
    termoPadrao = config?.termo_padrao_compra ?? null
  }

  return <CheckoutClient termoPadrao={termoPadrao} />
}
