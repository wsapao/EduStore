import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { hasPermission } from '@/lib/permissoes'
import {
  getVersaoAtualTermos,
  listarVersoesTermosAction,
} from '@/app/actions/configuracoes/termos'
import { TermosForm } from './TermosForm'

export default async function TermosConfigPage() {
  if (!(await hasPermission('configuracoes.editar_identidade'))) {
    redirect('/admin/configuracoes')
  }

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-1)', marginBottom: 16 }}>
          Termos &amp; LGPD
        </h1>
        <p style={{ color: 'var(--text-3)' }}>Sua conta não está vinculada a uma escola.</p>
      </div>
    )
  }

  const [versaoUso, versaoPriv, histUso, histPriv] = await Promise.all([
    getVersaoAtualTermos({ tipo: 'termos_uso', escolaId }),
    getVersaoAtualTermos({ tipo: 'privacidade', escolaId }),
    listarVersoesTermosAction({ tipo: 'termos_uso' }),
    listarVersoesTermosAction({ tipo: 'privacidade' }),
  ])

  const historicoUso = 'versoes' in histUso ? histUso.versoes : []
  const historicoPriv = 'versoes' in histPriv ? histPriv.versoes : []

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-1)', marginBottom: 8 }}>
        Termos &amp; LGPD
      </h1>
      <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 24 }}>
        Edite e versione os Termos de Uso e a Política de Privacidade da sua escola.
        Cada nova publicação cria uma versão imutável e fica visível em /termos e /privacidade imediatamente.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 920 }}>
        <TermosForm
          tipo="termos_uso"
          titulo="Termos de Uso"
          versaoAtual={versaoUso}
          historico={historicoUso}
        />
        <TermosForm
          tipo="privacidade"
          titulo="Política de Privacidade"
          versaoAtual={versaoPriv}
          historico={historicoPriv}
        />
      </div>
    </div>
  )
}
