import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ConfigurarClient } from './ConfigurarClient'

export default async function ConfigurarCartinaPage({
  params,
}: {
  params: Promise<{ aluno_id: string }>
}) {
  const { aluno_id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Valida vínculo
  const { data: vinculo } = await supabase
    .from('responsavel_aluno')
    .select('aluno_id')
    .eq('responsavel_id', user.id)
    .eq('aluno_id', aluno_id)
    .single()

  if (!vinculo) redirect('/cantina')

  const { data: aluno } = await supabase
    .from('alunos')
    .select('nome, serie')
    .eq('id', aluno_id)
    .single()

  const { data: carteira } = await supabase
    .from('cantina_carteiras')
    .select('id, saldo, limite_diario, ativo, bloqueio_motivo, senha_pin')
    .eq('aluno_id', aluno_id)
    .single()

  if (!carteira) redirect('/cantina')

  // Buscar restrições atuais
  const { data: restricoes } = await supabase
    .from('cantina_restricoes')
    .select('*')
    .eq('aluno_id', aluno_id)

  // Buscar todos os produtos da cantina da escola para preencher o select
  // Primeiro, achar o escola_id do aluno
  const { data: responsavel } = await supabase.from('responsaveis').select('escola_id').eq('id', user.id).single()
  const { data: produtos } = await supabase
    .from('cantina_produtos')
    .select('id, nome, categoria')
    .eq('escola_id', responsavel?.escola_id)
    .order('nome')

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px 16px 100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link href="/cantina" style={{
          width: 36, height: 36, borderRadius: 'var(--r-md)',
          background: 'var(--surface)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, textDecoration: 'none', color: 'var(--text-1)',
          boxShadow: 'var(--shadow-xs)',
        }}>←</Link>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>
            Configurar — {aluno?.nome}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
            {aluno?.serie} · Limite e bloqueio da carteira
          </div>
        </div>
      </div>

      {/* Saldo atual (leitura) */}
      <div style={{
        background: 'linear-gradient(135deg, var(--brand), #2d5a8a)',
        borderRadius: 'var(--r-xl)', padding: '18px 20px', marginBottom: 20, color: '#fff',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'rgba(255,255,255,.7)', marginBottom: 4 }}>
          Saldo disponível
        </div>
        <div style={{ fontSize: 28, fontWeight: 800 }}>
          {carteira.saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', marginTop: 4 }}>
          {carteira.ativo ? '✅ Carteira ativa' : `🔒 Bloqueada: ${carteira.bloqueio_motivo ?? ''}`}
        </div>
      </div>

      <ConfigurarClient
        alunoId={aluno_id}
        alunoNome={aluno?.nome ?? ''}
        limiteDiario={carteira.limite_diario}
        ativo={carteira.ativo}
        bloqueioMotivo={carteira.bloqueio_motivo}
        hasPin={!!carteira.senha_pin}
        restricoes={restricoes || []}
        produtos={produtos || []}
      />
    </div>
  )
}
