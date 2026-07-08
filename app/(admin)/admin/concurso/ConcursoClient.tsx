'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { MODALIDADES } from '@/lib/concurso/config'
import { gerarCSV, type ResumoFinanceiro } from '@/lib/concurso/relatorio'
import { getAdminButtonStyle, getAdminPillStyle, getAdminTone, type AdminUiTone } from '@/lib/admin-ui-tones'
import type { InscricaoListaRow } from './page'

function fmtBRL(v: number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const STATUS_CONFIG: Record<string, { label: string; tone: AdminUiTone }> = {
  pago:      { label: 'Pago',      tone: 'success' },
  pendente:  { label: 'Pendente',  tone: 'warning' },
  expirado:  { label: 'Expirado',  tone: 'neutral' },
  cancelado: { label: 'Cancelado', tone: 'danger' },
}

const MODALIDADE_NOME: Record<string, string> = Object.fromEntries(
  MODALIDADES.map((m) => [m.slug, `${m.icone} ${m.nome}`]),
)

function normalizaDigitos(s: string) {
  return s.replace(/\D/g, '')
}

export function ConcursoClient({ rows, resumo }: { rows: InscricaoListaRow[]; resumo: ResumoFinanceiro }) {
  const [filtroStatus, setFiltroStatus] = useState('todas')
  const [filtroModalidade, setFiltroModalidade] = useState('todas')
  const [busca, setBusca] = useState('')

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const qDigitos = normalizaDigitos(q)
    return rows.filter((r) => {
      if (filtroStatus !== 'todas' && r.status_pagamento !== filtroStatus) return false
      if (filtroModalidade !== 'todas' && r.modalidade !== filtroModalidade) return false
      if (!q) return true
      const porNome =
        r.aluno_nome.toLowerCase().includes(q) ||
        r.resp1_nome.toLowerCase().includes(q)
      const porCpf = qDigitos.length > 0 && normalizaDigitos(r.resp1_cpf).includes(qDigitos)
      return porNome || porCpf
    })
  }, [rows, filtroStatus, filtroModalidade, busca])

  function exportarCSV() {
    const csv = gerarCSV(filtradas)
    // BOM para o Excel abrir o UTF-8 corretamente
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'inscricoes-concurso-2027.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const temPagos = (resumo.porStatus.pago ?? 0) > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 80 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', margin: 0, letterSpacing: '-.02em' }}>
            Concurso de Bolsas — Seletivas Esportivas 2027
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '4px 0 0' }}>
            {rows.length} {rows.length === 1 ? 'inscrição' : 'inscrições'}
            {filtradas.length !== rows.length ? ` · ${filtradas.length} no filtro atual` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={exportarCSV}
          disabled={filtradas.length === 0}
          style={{
            ...getAdminButtonStyle('accent', 'solid', { height: 38, padding: '0 16px', fontSize: 12, borderRadius: 999 }),
            opacity: filtradas.length === 0 ? 0.5 : 1,
            cursor: filtradas.length === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          ⬇ Exportar CSV
        </button>
      </div>

      {/* Resumo financeiro */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <ResumoCard rotulo="TOTAL ARRECADADO" valor={fmtBRL(resumo.totalBruto)} />
        <ResumoCard
          rotulo="LÍQUIDO"
          valor={temPagos ? fmtBRL(resumo.totalLiquido) : '—'}
          nota="após taxas Asaas"
        />
        <ResumoCard rotulo="PAGAS" valor={String(resumo.porStatus.pago ?? 0)} cor={getAdminTone('success').text} />
        <ResumoCard rotulo="PENDENTES" valor={String(resumo.porStatus.pendente ?? 0)} cor={getAdminTone('warning').text} />
        <ResumoCard rotulo="EXPIRADAS" valor={String(resumo.porStatus.expirado ?? 0)} cor={getAdminTone('neutral').text} />
      </div>

      {/* Breakdown por modalidade */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {MODALIDADES.map((m) => (
          <span key={m.slug} style={getAdminPillStyle('neutral', { fontSize: 12, padding: '5px 12px' })}>
            {m.icone} {m.nome}: <strong>{resumo.porModalidade[m.slug] ?? 0}</strong>
          </span>
        ))}
      </div>

      {/* Filtros */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14,
        display: 'flex', alignItems: 'end', gap: 10, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <label style={labelStyle}>BUSCA</label>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Aluno, responsável ou CPF"
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label style={labelStyle}>STATUS</label>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} style={inputStyle}>
            <option value="todas">Todas</option>
            <option value="pago">Pagas</option>
            <option value="pendente">Pendentes</option>
            <option value="expirado">Expiradas</option>
            <option value="cancelado">Canceladas</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>MODALIDADE</label>
          <select value={filtroModalidade} onChange={(e) => setFiltroModalidade(e.target.value)} style={inputStyle}>
            <option value="todas">Todas</option>
            {MODALIDADES.map((m) => (
              <option key={m.slug} value={m.slug}>{m.nome}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
        overflowX: 'auto',
      }}>
        {filtradas.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', fontSize: 14, color: 'var(--text-3)' }}>
            {rows.length === 0
              ? 'Nenhuma inscrição recebida ainda.'
              : 'Nenhuma inscrição corresponde aos filtros.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Nº', 'Aluno', 'Série 2026', 'Modalidade', 'Responsável', 'Telefone', 'Status', 'Valor', 'Data'].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((r) => {
                const cfg = STATUS_CONFIG[r.status_pagamento] ?? { label: r.status_pagamento, tone: 'muted' as AdminUiTone }
                const tone = getAdminTone(cfg.tone)
                return (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={tdStyle}>
                      <Link href={`/admin/concurso/${r.id}`} style={{
                        fontWeight: 800, color: '#f59e0b', textDecoration: 'none',
                        fontFamily: 'monospace', fontSize: 13,
                      }}>
                        {r.numero}
                      </Link>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text-1)' }}>
                      <Link href={`/admin/concurso/${r.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {r.aluno_nome}
                      </Link>
                    </td>
                    <td style={tdStyle}>{r.serie_2026}</td>
                    <td style={tdStyle}>{MODALIDADE_NOME[r.modalidade] ?? r.modalidade}</td>
                    <td style={tdStyle}>{r.resp1_nome}</td>
                    <td style={tdStyle}>{r.resp1_telefone ?? '—'}</td>
                    <td style={tdStyle}>
                      <span style={getAdminPillStyle(cfg.tone)}>
                        <span style={{
                          width: 5, height: 5, borderRadius: '50%',
                          background: tone.dot, display: 'inline-block',
                        }} />
                        {cfg.label}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--text-1)' }}>{fmtBRL(Number(r.valor))}</td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{fmtData(r.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function ResumoCard({ rotulo, valor, nota, cor }: { rotulo: string; valor: string; nota?: string; cor?: string }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
      padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '.05em' }}>
        {rotulo}
      </span>
      <span style={{ fontSize: 20, fontWeight: 800, color: cor ?? 'var(--text-1)' }}>{valor}</span>
      {nota && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{nota}</span>}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-3)',
  marginBottom: 6,
  letterSpacing: '.05em',
}

const inputStyle: React.CSSProperties = {
  height: 42,
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  padding: '0 12px',
  fontSize: 13,
  color: 'var(--text-1)',
  fontFamily: 'inherit',
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 14px',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-3)',
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
  color: 'var(--text-2)',
  verticalAlign: 'middle',
}
