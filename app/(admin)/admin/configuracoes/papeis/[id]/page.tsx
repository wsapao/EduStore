import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { hasPermission } from '@/lib/permissoes'
import { PapelEditor } from '../PapelEditor'

export default async function EditarPapelPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await hasPermission('configuracoes.gerenciar_papeis'))) {
    redirect('/admin/configuracoes')
  }

  const { id } = await params
  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) redirect('/admin/configuracoes/papeis')

  const { data: papel } = await supabase
    .from('papeis')
    .select('id, nome, descricao, preset, chave_preset')
    .eq('id', id)
    .eq('escola_id', escolaId)
    .maybeSingle()

  if (!papel) redirect('/admin/configuracoes/papeis')

  const { data: perms } = await supabase
    .from('papel_permissoes')
    .select('chave')
    .eq('papel_id', id)

  return (
    <PapelEditor
      initial={{
        papelId: papel.id,
        nome: papel.nome,
        descricao: papel.descricao ?? '',
        preset: papel.preset,
        chavesAtuais: (perms ?? []).map((p: { chave: string }) => p.chave),
      }}
    />
  )
}
