import { redirect } from 'next/navigation'
import { currentPermissions } from '@/lib/permissoes'
import { ConfigSidebar } from './ConfigSidebar'

export default async function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  const permissoes = await currentPermissions()
  if (!permissoes.includes('configuracoes.ver')) {
    redirect('/admin')
  }

  return (
    <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start', minHeight: 'calc(100dvh - 96px)' }}>
      <ConfigSidebar permissoes={permissoes} />
      <div style={{ flex: 1, padding: '24px 32px' }}>
        {children}
      </div>
    </div>
  )
}
