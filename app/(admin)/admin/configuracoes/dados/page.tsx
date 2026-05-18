import { redirect } from 'next/navigation'
import { hasPermission } from '@/lib/permissoes'
import { ExportsCard } from './ExportsCard'
import { LgpdCard } from './LgpdCard'

export default async function DadosConfigPage() {
  if (!(await hasPermission('configuracoes.ver'))) {
    redirect('/admin/configuracoes')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-1)', marginBottom: 6 }}>
          Backup & Dados
        </h1>
        <p style={{ color: 'var(--text-3)', fontSize: 13, margin: 0 }}>
          Exporte dados operacionais em CSV e atenda solicitações LGPD por CPF (exclusão e
          portabilidade).
        </p>
      </div>

      <ExportsCard />
      <LgpdCard />
    </div>
  )
}
