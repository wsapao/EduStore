import { redirect } from 'next/navigation'
import { hasPermission } from '@/lib/permissoes'
import { listarAuditoriaAction } from '@/app/actions/configuracoes/auditoria'
import { AuditoriaView } from './AuditoriaView'

export default async function AuditoriaPage() {
  if (!(await hasPermission('configuracoes.ver'))) {
    redirect('/admin/configuracoes')
  }

  const result = await listarAuditoriaAction({})
  const initialEntries = 'entries' in result ? result.entries : []
  const initialError = 'error' in result ? result.error : null

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginBottom: 24 }}>
        Auditoria
      </h1>
      <AuditoriaView initialEntries={initialEntries} initialError={initialError} />
    </div>
  )
}
