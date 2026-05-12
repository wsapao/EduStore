import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { hasPermission } from '@/lib/permissoes'
import type { Escola } from '@/types/database'
import { IdentidadeForm } from './IdentidadeForm'
import { MidiasCard } from './MidiasCard'
import { EnderecoForm } from './EnderecoForm'

export default async function LojaConfigPage() {
  if (!(await hasPermission('configuracoes.editar_identidade'))) {
    redirect('/admin/configuracoes')
  }

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginBottom: 16 }}>
          Identidade & Personalização
        </h1>
        <p style={{ color: '#94a3b8' }}>
          Sua conta não está vinculada a uma escola.
        </p>
      </div>
    )
  }

  const { data: escola } = await supabase
    .from('escolas')
    .select('*')
    .eq('id', escolaId)
    .single<Escola>()

  if (!escola) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginBottom: 16 }}>
          Identidade & Personalização
        </h1>
        <p style={{ color: '#ef4444' }}>Escola não encontrada.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginBottom: 24 }}>
        Identidade & Personalização
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 820 }}>
        <Card titulo="Identidade da loja">
          <IdentidadeForm escola={escola} />
        </Card>

        <Card titulo="Logo, banner e favicon">
          <MidiasCard escola={escola} />
        </Card>

        <Card titulo="Endereço fiscal">
          <EnderecoForm escola={escola} />
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
