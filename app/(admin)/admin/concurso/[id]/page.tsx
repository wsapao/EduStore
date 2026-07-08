import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { currentPermissions } from '@/lib/permissoes'
import { createAdminClient } from '@/lib/supabase/admin'
import { CONCURSO, MODALIDADES } from '@/lib/concurso/config'
import { getAdminPillStyle, getAdminTone, type AdminUiTone } from '@/lib/admin-ui-tones'

function fmtBRL(v: number | null) {
  if (v == null) return '—'
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDataHora(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function fmtDataNascimento(iso: string) {
  // date puro (sem hora) — interpretar como local para não voltar 1 dia
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR')
}

function fmtCPF(cpf: string) {
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return cpf
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

const STATUS_CONFIG: Record<string, { label: string; tone: AdminUiTone }> = {
  pago:      { label: 'Pago',      tone: 'success' },
  pendente:  { label: 'Pendente',  tone: 'warning' },
  expirado:  { label: 'Expirado',  tone: 'neutral' },
  cancelado: { label: 'Cancelado', tone: 'danger' },
}

export default async function InscricaoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  // Guard server-side: o menu escondido NÃO é controle de acesso.
  const permissoes = await currentPermissions()
  if (!permissoes.includes('concurso.ver')) {
    redirect('/admin')
  }

  const { id } = await params
  const supabase = createAdminClient()
  const { data: inscricao } = await supabase
    .from('inscricoes_concurso')
    .select('*')
    .eq('id', id)
    .eq('escola_id', CONCURSO.escolaId)
    .maybeSingle()

  if (!inscricao) notFound()

  const modalidade = MODALIDADES.find((m) => m.slug === inscricao.modalidade)
  const statusCfg = STATUS_CONFIG[inscricao.status_pagamento] ?? { label: inscricao.status_pagamento, tone: 'muted' as AdminUiTone }
  const statusTone = getAdminTone(statusCfg.tone)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 80, maxWidth: 860 }}>
      <div>
        <Link href="/admin/concurso" style={{
          fontSize: 13, fontWeight: 700, color: 'var(--text-3)', textDecoration: 'none',
        }}>
          ← Voltar
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', margin: 0, letterSpacing: '-.02em' }}>
            <span style={{ fontFamily: 'monospace', color: '#f59e0b' }}>{inscricao.numero}</span>
            {' · '}{inscricao.aluno_nome}
          </h1>
          <span style={getAdminPillStyle(statusCfg.tone)}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: statusTone.dot, display: 'inline-block',
            }} />
            {statusCfg.label}
          </span>
        </div>
      </div>

      <Secao titulo="Estudante">
        <Campo rotulo="Nome" valor={inscricao.aluno_nome} />
        <Campo rotulo="Nascimento" valor={fmtDataNascimento(inscricao.aluno_nascimento)} />
        <Campo rotulo="Turno" valor={inscricao.turno} />
        <Campo rotulo="Série em 2026" valor={inscricao.serie_2026} />
        <Campo rotulo="Modalidade" valor={modalidade ? `${modalidade.icone} ${modalidade.nome}` : inscricao.modalidade} />
        <Campo rotulo="Instituição atual" valor={inscricao.instituicao_atual} />
      </Secao>

      <Secao titulo="Responsável 1">
        <Campo rotulo="Nome" valor={inscricao.resp1_nome} />
        <Campo rotulo="CPF" valor={fmtCPF(inscricao.resp1_cpf)} />
        <Campo rotulo="E-mail" valor={inscricao.resp1_email} />
        <Campo rotulo="Telefone" valor={inscricao.resp1_telefone ?? '—'} />
        <Campo rotulo="Endereço" valor={inscricao.resp1_endereco ?? '—'} />
        <Campo rotulo="Profissão" valor={inscricao.resp1_profissao ?? '—'} />
        <Campo rotulo="Parentesco" valor={inscricao.resp1_parentesco ?? '—'} />
      </Secao>

      {inscricao.resp2_nome && (
        <Secao titulo="Responsável 2">
          <Campo rotulo="Nome" valor={inscricao.resp2_nome} />
          <Campo rotulo="Endereço" valor={inscricao.resp2_endereco ?? '—'} />
          <Campo rotulo="Telefone" valor={inscricao.resp2_telefone ?? '—'} />
          <Campo rotulo="Profissão" valor={inscricao.resp2_profissao ?? '—'} />
          <Campo rotulo="Parentesco" valor={inscricao.resp2_parentesco ?? '—'} />
        </Secao>
      )}

      {inscricao.tem_irmaos && (
        <Secao titulo="Irmãos">
          <Campo rotulo="Tem irmãos" valor="Sim" />
          <Campo rotulo="Séries em 2026" valor={inscricao.irmaos_series_2026 ?? '—'} />
        </Secao>
      )}

      <Secao titulo="Pagamento">
        <Campo rotulo="Status" valor={statusCfg.label} />
        <Campo rotulo="Valor" valor={fmtBRL(inscricao.valor)} />
        <Campo rotulo="Valor líquido" valor={fmtBRL(inscricao.valor_liquido)} />
        <Campo rotulo="Gateway ID" valor={inscricao.gateway_id ?? '—'} mono />
        <Campo rotulo="PIX TX ID" valor={inscricao.pix_tx_id ?? '—'} mono />
        <Campo rotulo="Expiração do PIX" valor={fmtDataHora(inscricao.pix_expiracao)} />
        <Campo rotulo="Pago em" valor={fmtDataHora(inscricao.pago_em)} />
        <Campo rotulo="Inscrição criada em" valor={fmtDataHora(inscricao.created_at)} />
      </Secao>

      <Secao titulo="LGPD">
        <Campo rotulo="Consentimento em" valor={fmtDataHora(inscricao.consentimento_em)} />
      </Secao>
    </div>
  )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
        fontSize: 12, fontWeight: 800, color: 'var(--text-2)',
        letterSpacing: '.05em', textTransform: 'uppercase',
      }}>
        {titulo}
      </div>
      <div style={{
        padding: '14px 16px',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14,
      }}>
        {children}
      </div>
    </div>
  )
}

function Campo({ rotulo, valor, mono }: { rotulo: string; valor: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '.05em' }}>
        {rotulo.toUpperCase()}
      </span>
      <span style={{
        fontSize: 13, fontWeight: 600, color: 'var(--text-1)',
        fontFamily: mono ? 'monospace' : undefined,
        overflowWrap: 'anywhere',
      }}>
        {valor}
      </span>
    </div>
  )
}
