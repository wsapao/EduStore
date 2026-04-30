import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PDVClient } from './PDVClient'

export default async function PDVPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const role = user.app_metadata?.role
  if (role !== 'admin' && role !== 'operador') redirect('/loja')

  // Fetch responsavel/operador para obter a escola_id
  const { data: responsavel } = await supabase
    .from('responsaveis')
    .select('escola_id')
    .eq('id', user.id)
    .single()

  const escolaId = responsavel?.escola_id

  // Busca produtos da cantina ativos e disponíveis presencialmente
  let query = supabase
    .from('cantina_produtos')
    .select('*')
    .eq('ativo', true)
    .eq('disponivel_presencial', true)
    .order('categoria', { ascending: true })
    .order('ordem', { ascending: true })

  if (escolaId) {
    query = query.eq('escola_id', escolaId)
  }

  const { data: produtos } = await query

  return (
    <div style={{ padding: '0', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      <PDVClient produtos={produtos ?? []} />
    </div>
  )
}
