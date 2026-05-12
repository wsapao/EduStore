import { createClient } from '@/lib/supabase/server'
import { listarFatoresMfaAction } from '@/app/actions/configuracoes/conta'
import { DadosPessoaisForm } from './DadosPessoaisForm'
import { SenhaForm } from './SenhaForm'
import { MfaCard } from './MfaCard'
import { SessoesCard } from './SessoesCard'

export default async function ContaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const fatores = await listarFatoresMfaAction()
  const mfaAtivo = 'factors' in fatores && (fatores.factors?.length ?? 0) > 0
  const factorId = mfaAtivo ? fatores.factors![0].id : null

  const nomeAtual = (user.user_metadata as any)?.nome ?? ''
  const emailAtual = user.email ?? ''

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginBottom: 24 }}>
        Minha Conta
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720 }}>
        <Card titulo="Dados pessoais">
          <DadosPessoaisForm nomeAtual={nomeAtual} emailAtual={emailAtual} />
        </Card>

        <Card titulo="Alterar senha">
          <SenhaForm />
        </Card>

        <Card titulo="Autenticação em dois fatores (MFA)">
          <MfaCard mfaAtivo={mfaAtivo} factorId={factorId} />
        </Card>

        <Card titulo="Sessões ativas">
          <SessoesCard />
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
