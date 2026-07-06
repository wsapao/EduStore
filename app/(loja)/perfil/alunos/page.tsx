import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Aluno } from '@/types/database'
import { getSeriesDisponiveis } from '@/lib/crm/series'
import { AlunosClient } from './AlunosClient'

export default async function AlunosPage({
  searchParams,
}: {
  searchParams: Promise<{ onboarding?: string }>
}) {
  const { onboarding } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: vinculos }, series] = await Promise.all([
    supabase
      .from('responsavel_aluno')
      .select('aluno:alunos(*)')
      .eq('responsavel_id', user.id),
    getSeriesDisponiveis(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const alunos: Aluno[] = (vinculos ?? []).map((v: any) => v.aluno as Aluno).filter(Boolean)

  return (
    <AlunosClient
      alunos={alunos}
      series={series}
      isOnboarding={onboarding === '1'}
    />
  )
}
