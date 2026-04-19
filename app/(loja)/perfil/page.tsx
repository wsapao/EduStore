import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PerfilClient } from './PerfilClient'
import type { Responsavel } from '@/types/database'

export default async function PerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: responsavel } = await supabase
    .from('responsaveis')
    .select('*')
    .eq('id', user.id)
    .single<Responsavel>()

  if (!responsavel) redirect('/login')

  // Conta alunos vinculados
  const { count: totalAlunos } = await supabase
    .from('responsavel_aluno')
    .select('*', { count: 'exact', head: true })
    .eq('responsavel_id', user.id)

  // Conta pedidos
  const { count: totalPedidos } = await supabase
    .from('pedidos')
    .select('*', { count: 'exact', head: true })
    .eq('responsavel_id', user.id)

  return (
    <PerfilClient
      responsavel={responsavel}
      totalAlunos={totalAlunos ?? 0}
      totalPedidos={totalPedidos ?? 0}
    />
  )
}
