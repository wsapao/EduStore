import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { hasPermission } from '@/lib/permissoes'
import type { EscolaConfiguracoes } from '@/types/database'
import { PagamentosForm } from './PagamentosForm'
import { AsaasStatusCard } from './AsaasStatusCard'

export default async function PagamentosConfigPage() {
  if (!(await hasPermission('configuracoes.editar_pagamentos'))) {
    redirect('/admin/configuracoes')
  }

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginBottom: 16 }}>
          Pagamentos
        </h1>
        <p style={{ color: '#94a3b8' }}>Sua conta não está vinculada a uma escola.</p>
      </div>
    )
  }

  const { data: config } = await supabase
    .from('escola_configuracoes')
    .select('*')
    .eq('escola_id', escolaId)
    .single<EscolaConfiguracoes>()

  if (!config) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginBottom: 16 }}>
          Pagamentos
        </h1>
        <p style={{ color: '#ef4444' }}>Configurações da escola não encontradas.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginBottom: 24 }}>
        Pagamentos
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 820 }}>
        <Card titulo="Configurações operacionais">
          <PagamentosForm config={config} />
        </Card>

        <Card titulo="Asaas — credenciais (env)">
          <AsaasStatusCard />
        </Card>
      </div>
    </div>
  )
}

function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16,
      padding: 24,
    }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc', marginBottom: 16 }}>
        {titulo}
      </h2>
      {children}
    </section>
  )
}
