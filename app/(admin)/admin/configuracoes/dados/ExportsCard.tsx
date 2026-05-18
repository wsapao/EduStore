'use client'

import { useState, useTransition } from 'react'
import {
  exportarPedidosCsvAction,
  exportarAlunosCsvAction,
  exportarResponsaveisCsvAction,
} from '@/app/actions/configuracoes/dados'

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function ExportsCard() {
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [confirmAlunos, setConfirmAlunos] = useState(false)
  const [confirmResp, setConfirmResp] = useState(false)
  const [pendingPedidos, startPedidos] = useTransition()
  const [pendingAlunos, startAlunos] = useTransition()
  const [pendingResp, startResp] = useTransition()
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  function notify(tipo: 'ok' | 'erro', texto: string) {
    setMsg({ tipo, texto })
    if (tipo === 'ok') setTimeout(() => setMsg(null), 4000)
  }

  function exportarPedidos() {
    setMsg(null)
    startPedidos(async () => {
      const r = await exportarPedidosCsvAction({
        dataInicio: dataInicio ? new Date(dataInicio).toISOString() : null,
        dataFim: dataFim ? new Date(dataFim + 'T23:59:59').toISOString() : null,
      })
      if ('error' in r) {
        notify('erro', r.error)
        return
      }
      downloadFile(r.csv, r.filename, 'text/csv;charset=utf-8;')
      notify('ok', 'CSV de pedidos gerado.')
    })
  }

  function exportarAlunos() {
    setMsg(null)
    startAlunos(async () => {
      const r = await exportarAlunosCsvAction()
      if ('error' in r) {
        notify('erro', r.error)
        return
      }
      downloadFile(r.csv, r.filename, 'text/csv;charset=utf-8;')
      notify('ok', 'CSV de alunos gerado.')
    })
  }

  function exportarResponsaveis() {
    setMsg(null)
    startResp(async () => {
      const r = await exportarResponsaveisCsvAction()
      if ('error' in r) {
        notify('erro', r.error)
        return
      }
      downloadFile(r.csv, r.filename, 'text/csv;charset=utf-8;')
      notify('ok', 'CSV de responsáveis gerado.')
    })
  }

  return (
    <section style={cardStyle}>
      <header style={{ marginBottom: 16 }}>
        <h2 style={titleStyle}>Exportar dados (CSV)</h2>
        <p style={subStyle}>
          Baixe extrações em CSV (até 10 mil linhas). Use intervalos de data para reduzir o volume.
        </p>
      </header>

      {msg && (
        <div
          style={{
            ...alertBase,
            background:
              msg.tipo === 'erro' ? 'rgba(239,68,68,.12)' : 'rgba(16,185,129,.12)',
            border:
              msg.tipo === 'erro'
                ? '1px solid rgba(239,68,68,.4)'
                : '1px solid rgba(16,185,129,.4)',
            color: msg.tipo === 'erro' ? '#fecaca' : '#a7f3d0',
          }}
        >
          {msg.texto}
        </div>
      )}

      {/* Pedidos */}
      <div style={blockStyle}>
        <h3 style={blockTitleStyle}>Pedidos</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="De">
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Até">
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <button
            type="button"
            onClick={exportarPedidos}
            disabled={pendingPedidos}
            style={primaryBtn(pendingPedidos)}
          >
            {pendingPedidos ? 'Exportando…' : 'Exportar pedidos'}
          </button>
        </div>
      </div>

      {/* Alunos */}
      <div style={blockStyle}>
        <h3 style={blockTitleStyle}>Alunos</h3>
        <p style={warnText}>
          Inclui dados pessoais de menores. Verifique o destino antes de compartilhar.
        </p>
        <label style={checkRow}>
          <input
            type="checkbox"
            checked={confirmAlunos}
            onChange={(e) => setConfirmAlunos(e.target.checked)}
          />
          <span style={{ fontSize: 13 }}>
            Confirmo que entendo a sensibilidade desses dados.
          </span>
        </label>
        <button
          type="button"
          onClick={exportarAlunos}
          disabled={!confirmAlunos || pendingAlunos}
          style={primaryBtn(!confirmAlunos || pendingAlunos)}
        >
          {pendingAlunos ? 'Exportando…' : 'Exportar alunos'}
        </button>
      </div>

      {/* Responsáveis */}
      <div style={blockStyle}>
        <h3 style={blockTitleStyle}>Responsáveis</h3>
        <p style={warnText}>
          Inclui CPF, e-mail e telefone. Verifique o destino antes de compartilhar.
        </p>
        <label style={checkRow}>
          <input
            type="checkbox"
            checked={confirmResp}
            onChange={(e) => setConfirmResp(e.target.checked)}
          />
          <span style={{ fontSize: 13 }}>
            Confirmo que entendo a sensibilidade desses dados.
          </span>
        </label>
        <button
          type="button"
          onClick={exportarResponsaveis}
          disabled={!confirmResp || pendingResp}
          style={primaryBtn(!confirmResp || pendingResp)}
        >
          {pendingResp ? 'Exportando…' : 'Exportar responsáveis'}
        </button>
      </div>
    </section>
  )
}

// ---------- Helpers de estilo ----------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{label}</label>
      {children}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(15,23,42,.6)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: 24,
}
const titleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: 'var(--text-1)',
  margin: 0,
}
const subStyle: React.CSSProperties = {
  color: 'var(--text-3)',
  fontSize: 13,
  marginTop: 4,
  marginBottom: 0,
}
const blockStyle: React.CSSProperties = {
  borderTop: '1px solid rgba(255,255,255,.06)',
  paddingTop: 16,
  marginTop: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}
const blockTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: '#e2e8f0',
  margin: 0,
}
const warnText: React.CSSProperties = {
  fontSize: 12,
  color: '#fbbf24',
  margin: 0,
}
const checkRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  cursor: 'pointer',
  color: 'var(--text-2)',
}
const inputStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '8px 10px',
  color: 'var(--text-1)',
  fontSize: 13,
  fontFamily: 'inherit',
}
function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? 'rgba(99,102,241,.4)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '9px 16px',
    fontSize: 13,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    alignSelf: 'flex-start',
  }
}
const alertBase: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 8,
  fontSize: 13,
  marginBottom: 12,
}
