import { redirect } from 'next/navigation'
import { hasPermission } from '@/lib/permissoes'
import { listarTemplatesEmailAction } from '@/app/actions/configuracoes/emails'
import { EmailsView } from './EmailsView'

export default async function EmailsConfigPage() {
  if (!(await hasPermission('configuracoes.editar_identidade'))) {
    redirect('/admin/configuracoes')
  }

  const r = await listarTemplatesEmailAction()
  if ('error' in r) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-1)', marginBottom: 8 }}>
          E-mails
        </h1>
        <p style={{ color: '#fca5a5' }}>{r.error}</p>
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-1)', marginBottom: 8 }}>
        E-mails
      </h1>
      <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 24, maxWidth: 720 }}>
        Edite os textos dos e-mails automáticos enviados aos responsáveis. Use {'{{variavel}}'} para
        inserir dados do pedido. Templates não customizados usam os textos padrão da plataforma.
      </p>
      <EmailsView templates={r.templates} />
    </div>
  )
}
