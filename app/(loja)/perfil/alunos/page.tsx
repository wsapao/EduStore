import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Aluno } from '@/types/database'
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

  const { data: vinculos } = await supabase
    .from('responsavel_aluno')
    .select('aluno:alunos(*)')
    .eq('responsavel_id', user.id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const alunos: Aluno[] = (vinculos ?? []).map((v: any) => v.aluno as Aluno).filter(Boolean)

  return (
    <AlunosClient
      alunos={alunos}
      isOnboarding={onboarding === '1'}
    />
  )
}
