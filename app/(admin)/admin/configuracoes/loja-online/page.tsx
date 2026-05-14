import { redirect } from 'next/navigation'

import { LojaOnlineForm } from './LojaOnlineForm'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { normalizeLojaFuncionamento } from '@/lib/loja-online/config'
import { hasPermission } from '@/lib/permissoes'
import { createClient } from '@/lib/supabase/server'
import type { Categoria, EscolaConfiguracoes, Produto } from '@/types/database'

type CategoriaOption = Pick<Categoria, 'id' | 'nome' | 'icone' | 'ativo'>
type ProdutoOption = Pick<Produto, 'id' | 'nome' | 'categoria' | 'ativo'>

export default async function LojaOnlineConfigPage() {
  if (!(await hasPermission('configuracoes.editar_identidade'))) {
    redirect('/admin/configuracoes')
  }

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)

  if (!escolaId) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginBottom: 16 }}>
          Loja Online
        </h1>
        <p style={{ color: '#94a3b8' }}>Sua conta não está vinculada a uma escola.</p>
      </div>
    )
  }

  const [{ data: config }, { data: categorias }, { data: produtos }] = await Promise.all([
    supabase
      .from('escola_configuracoes')
      .select('*')
      .eq('escola_id', escolaId)
      .single<EscolaConfiguracoes>(),
    supabase
      .from('categorias_produto')
      .select('id, nome, icone, ativo')
      .eq('escola_id', escolaId)
      .eq('ativo', true)
      .order('nome', { ascending: true }),
    supabase
      .from('produtos')
      .select('id, nome, categoria, ativo')
      .eq('escola_id', escolaId)
      .eq('ativo', true)
      .order('created_at', { ascending: false }),
  ])

  if (!config) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginBottom: 16 }}>
          Loja Online
        </h1>
        <p style={{ color: '#ef4444' }}>Configurações da escola não encontradas.</p>
      </div>
    )
  }

  const normalizedConfig: EscolaConfiguracoes = {
    ...config,
    loja_funcionamento: normalizeLojaFuncionamento(config.loja_funcionamento),
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginBottom: 24 }}>
        Loja Online
      </h1>

      <div style={{ maxWidth: 920 }}>
        <section style={cardStyle}>
          <h2 style={titleStyle}>Configurações da home e da operação</h2>
          <LojaOnlineForm
            config={normalizedConfig}
            categorias={(categorias ?? []) as CategoriaOption[]}
            produtos={(produtos ?? []) as ProdutoOption[]}
          />
        </section>
      </div>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16,
  padding: 24,
}

const titleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
  color: '#f8fafc',
  marginBottom: 16,
}
