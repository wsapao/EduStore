import { redirect } from 'next/navigation'
import { hasPermission } from '@/lib/permissoes'
import { PapelEditor } from '../PapelEditor'

export default async function NovoPapelPage() {
  if (!(await hasPermission('configuracoes.gerenciar_papeis'))) {
    redirect('/admin/configuracoes')
  }
  return (
    <PapelEditor
      initial={{
        nome: '',
        descricao: '',
        preset: false,
        chavesAtuais: [],
      }}
    />
  )
}
