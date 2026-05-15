import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { hasPermission } from '@/lib/permissoes'
import type { EscolaConfiguracoes } from '@/types/database'
import { getStatusAsaasWebhookAction } from '@/app/actions/configuracoes/integracoes'
import { IntegracoesForm } from './IntegracoesForm'

export default async function IntegracoesConfigPage() {
  if (!(await hasPermission('configuracoes.editar_identidade'))) {
    redirect('/admin/configuracoes')
  }

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginBottom: 16 }}>Integrações</h1>
        <p style={{ color: '#94a3b8' }}>Sua conta não está vinculada a uma escola.</p>
      </div>
    )
  }

  // Paraleliza queries independentes (antes rodavam em série).
  const [
    { data: config },
    asaasStatus,
  ] = await Promise.all([
    supabase
      .from('escola_configuracoes')
      .select('*')
      .eq('escola_id', escolaId)
      .single<EscolaConfiguracoes>(),
    getStatusAsaasWebhookAction(),
  ])

  if (!config) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginBottom: 16 }}>Integrações</h1>
        <p style={{ color: '#ef4444' }}>Configurações da escola não encontradas.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginBottom: 24 }}>Integrações</h1>
      <div style={{ maxWidth: 820 }}>
        <IntegracoesForm config={config} asaasStatus={asaasStatus} />
      </div>
    </div>
  )
}
