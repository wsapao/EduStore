import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { PdvClient } from './PdvClient'

export default async function OperadorPdvPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = user.app_metadata?.role
  if (role !== 'operador' && role !== 'admin') redirect('/loja')

  const adminClient = createAdminClient()

  // Escola do operador (via responsaveis ou operadores)
  const { data: resp } = await adminClient
    .from('responsaveis')
    .select('escola_id')
    .eq('id', user.id)
    .single()

  const escolaId = resp?.escola_id

  // Produtos ativos da cantina disponíveis no PDV
  const { data: produtos } = await adminClient
    .from('cantina_produtos')
    .select('*')
    .eq('escola_id', escolaId)
    .eq('ativo', true)
    .eq('disponivel_presencial', true)
    .order('categoria', { ascending: true })
    .order('nome', { ascending: true })

  return (
    <PdvClient
      produtos={produtos ?? []}
      operadorId={user.id}
    />
  )
}
