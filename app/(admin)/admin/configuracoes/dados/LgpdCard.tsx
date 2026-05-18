'use client'

import { useState, useTransition } from 'react'
import {
  previewExclusaoLgpdAction,
  executarExclusaoLgpdAction,
  exportarPortabilidadeLgpdAction,
  type LgpdPreview,
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

function maskCpf(value: string): string {
  const d = value.replace(/\D+/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function maskEmail(email: string): string {
  const [user, domain] = email.split('@')
  if (!domain) return email
  const head = user.slice(0, 2)
  return `${head}${'*'.repeat(Math.max(2, user.length - 2))}@${domain}`
}

export function LgpdCard() {
  // Exclusão
  const [cpfExc, setCpfExc] = useState('')
  const [senha, setSenha] = useState('')
  const [preview, setPreview] = useState<LgpdPreview | null>(null)
  const [pendingPreview, startPreview] = useTransition()
  const [pendingExc, startExc] = useTransition()
  const [msgExc, setMsgExc] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  // Portabilidade
  const [cpfPort, setCpfPort] = useState('')
  const [pendingPort, startPort] = useTransition()
  const [msgPort, setMsgPort] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  function carregarPreview() {
    setMsgExc(null)
    setPreview(null)
    startPreview(async () => {
      const r = await previewExclusaoLgpdAction(cpfExc)
      if ('error' in r) {
        setMsgExc({ tipo: 'erro', texto: r.error })
        return
      }
      setPreview(r.preview)
    })
  }

  function executarExclusao() {
    if (!preview) return
    const ok = window.confirm(
      `Exclusão DEFINITIVA dos dados pessoais de ${preview.responsavel.nome}.\n` +
        `Os dados operacionais (pedidos, ingressos) serão preservados pelo prazo legal,\n` +
        `mas a identidade será anonimizada e o login será invalidado.\n\nTem certeza?`
    )
    if (!ok) return
    setMsgExc(null)
    startExc(async () => {
      const r = await executarExclusaoLgpdAction({
        cpf: cpfExc,
        senhaConfirmacao: senha,
      })
      if ('error' in r) {
        setMsgExc({ tipo: 'erro', texto: r.error })
        return
      }
      setMsgExc({ tipo: 'ok', texto: 'Responsável anonimizado com sucesso.' })
      setPreview(null)
      setCpfExc('')
      setSenha('')
    })
  }

  function gerarPortabilidade() {
    setMsgPort(null)
    startPort(async () => {
      const r = await exportarPortabilidadeLgpdAction(cpfPort)
      if ('error' in r) {
        setMsgPort({ tipo: 'erro', texto: r.error })
        return
      }
      downloadFile(r.json, r.filename, 'application/json;charset=utf-8;')
      setMsgPort({ tipo: 'ok', texto: 'Arquivo de portabilidade gerado.' })
    })
  }

  return (
    <section style={cardStyle}>
      <header style={{ marginBottom: 16 }}>
        <h2 style={titleStyle}>LGPD — Direitos do titular</h2>
        <p style={subStyle}>
          Atenda solicitações de exclusão (art. 18, VI) e portabilidade (art. 18, V) buscando o
          titular pelo CPF.
        </p>
      </header>

      {/* Exclusão */}
      <div style={blockStyle}>
        <h3 style={blockTitleStyle}>Exclusão por CPF</h3>

        {msgExc && (
          <div
            style={{
              ...alertBase,
              background:
                msgExc.tipo === 'erro' ? 'rgba(239,68,68,.12)' : 'rgba(16,185,129,.12)',
              border:
                msgExc.tipo === 'erro'
                  ? '1px solid rgba(239,68,68,.4)'
                  : '1px solid rgba(16,185,129,.4)',
              color: msgExc.tipo === 'erro' ? '#fecaca' : '#a7f3d0',
            }}
          >
            {msgExc.texto}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="CPF do titular">
            <input
              value={cpfExc}
              onChange={(e) => setCpfExc(maskCpf(e.target.value))}
              placeholder="000.000.000-00"
              style={{ ...inputStyle, width: 180 }}
            />
          </Field>
          <button
            type="button"
            onClick={carregarPreview}
            disabled={pendingPreview || cpfExc.replace(/\D+/g, '').length !== 11}
            style={secondaryBtn(
              pendingPreview || cpfExc.replace(/\D+/g, '').length !== 11
            )}
          >
            {pendingPreview ? 'Buscando…' : 'Carregar preview'}
          </button>
        </div>

        {preview && (
          <div style={previewBoxStyle}>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div style={kvLabel}>Nome</div>
                <div style={kvValue}>{preview.responsavel.nome}</div>
              </div>
              <div>
                <div style={kvLabel}>E-mail</div>
                <div style={kvValue}>{maskEmail(preview.responsavel.email)}</div>
              </div>
              <div>
                <div style={kvLabel}>Telefone</div>
                <div style={kvValue}>{preview.responsavel.telefone || '—'}</div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={kvLabel}>Alunos vinculados ({preview.alunosVinculados.length})</div>
              {preview.alunosVinculados.length === 0 ? (
                <div style={kvValueMuted}>Nenhum</div>
              ) : (
                <ul style={{ margin: '4px 0 0 0', padding: '0 0 0 18px', color: '#e2e8f0', fontSize: 13 }}>
                  {preview.alunosVinculados.map((a) => (
                    <li key={a.id}>
                      {a.nome} {a.serie ? `— ${a.serie}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div style={{ display: 'flex', gap: 24, marginTop: 12, flexWrap: 'wrap' }}>
              <Stat label="Pedidos" value={preview.totalPedidos} />
              <Stat label="Ingressos" value={preview.totalIngressos} />
              <Stat label="Carteiras cantina" value={preview.carteirasCantina} />
            </div>

            <div style={{ marginTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <Field label="Sua senha de admin (confirmação)">
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  style={{ ...inputStyle, width: 240 }}
                  autoComplete="current-password"
                />
              </Field>
              <button
                type="button"
                onClick={executarExclusao}
                disabled={pendingExc || !senha}
                style={dangerBtn(pendingExc || !senha)}
              >
                {pendingExc ? 'Excluindo…' : 'Excluir definitivamente'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Portabilidade */}
      <div style={blockStyle}>
        <h3 style={blockTitleStyle}>Portabilidade por CPF</h3>
        <p style={subStyle}>
          Gera um arquivo JSON com todos os dados do titular (responsável, alunos, pedidos,
          ingressos e carteiras de cantina).
        </p>

        {msgPort && (
          <div
            style={{
              ...alertBase,
              background:
                msgPort.tipo === 'erro' ? 'rgba(239,68,68,.12)' : 'rgba(16,185,129,.12)',
              border:
                msgPort.tipo === 'erro'
                  ? '1px solid rgba(239,68,68,.4)'
                  : '1px solid rgba(16,185,129,.4)',
              color: msgPort.tipo === 'erro' ? '#fecaca' : '#a7f3d0',
            }}
          >
            {msgPort.texto}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="CPF do titular">
            <input
              value={cpfPort}
              onChange={(e) => setCpfPort(maskCpf(e.target.value))}
              placeholder="000.000.000-00"
              style={{ ...inputStyle, width: 180 }}
            />
          </Field>
          <button
            type="button"
            onClick={gerarPortabilidade}
            disabled={pendingPort || cpfPort.replace(/\D+/g, '').length !== 11}
            style={primaryBtn(
              pendingPort || cpfPort.replace(/\D+/g, '').length !== 11
            )}
          >
            {pendingPort ? 'Gerando…' : 'Gerar arquivo de portabilidade'}
          </button>
        </div>
      </div>
    </section>
  )
}

// ---------- Subcomponentes ----------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{label}</label>
      {children}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={kvLabel}>{label}</div>
      <div style={{ ...kvValue, fontSize: 18, fontWeight: 800 }}>{value}</div>
    </div>
  )
}

// ---------- Estilos ----------

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
const inputStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '8px 10px',
  color: 'var(--text-1)',
  fontSize: 13,
  fontFamily: 'inherit',
}
const previewBoxStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 16,
  marginTop: 4,
}
const kvLabel: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-3)',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.05em',
}
const kvValue: React.CSSProperties = {
  fontSize: 14,
  color: '#e2e8f0',
  fontWeight: 600,
  marginTop: 2,
}
const kvValueMuted: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-3)',
  marginTop: 2,
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
function secondaryBtn(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.08)',
    color: disabled ? 'var(--text-3)' : '#e2e8f0',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '9px 16px',
    fontSize: 13,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    alignSelf: 'flex-start',
  }
}
function dangerBtn(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? 'rgba(239,68,68,.3)' : 'linear-gradient(135deg,#dc2626,#b91c1c)',
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
  marginBottom: 4,
}
