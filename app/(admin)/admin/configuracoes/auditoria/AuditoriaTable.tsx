'use client'

import { Fragment, useState } from 'react'
import type { AuditEntry } from '@/app/actions/configuracoes/auditoria'

const cellHeader: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: 11,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.05em',
  color: '#94a3b8',
  borderBottom: '1px solid rgba(255,255,255,.08)',
}

const cell: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 13,
  color: '#e2e8f0',
  borderBottom: '1px solid rgba(255,255,255,.04)',
  verticalAlign: 'top',
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return iso
  }
}

export function AuditoriaTable({
  entries,
  loading,
}: {
  entries: AuditEntry[]
  loading: boolean
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
        Carregando…
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div
        style={{
          padding: 32,
          textAlign: 'center',
          color: '#94a3b8',
          fontSize: 13,
          border: '1px solid rgba(255,255,255,.06)',
          borderRadius: 12,
          background: 'rgba(0,0,0,.2)',
        }}
      >
        Nenhum evento de auditoria encontrado para os filtros atuais.
      </div>
    )
  }

  return (
    <div
      style={{
        background: 'rgba(0,0,0,.2)',
        border: '1px solid rgba(255,255,255,.06)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: 'rgba(255,255,255,.03)' }}>
          <tr>
            <th style={cellHeader}>Data/Hora</th>
            <th style={cellHeader}>Usuário</th>
            <th style={cellHeader}>Módulo</th>
            <th style={cellHeader}>Ação</th>
            <th style={cellHeader}>Descrição / IP</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const expanded = expandedId === e.id
            const hasMetadata = !!e.metadata && Object.keys(e.metadata).length > 0
            return (
              <Fragment key={e.id}>
                <tr
                  onClick={() => hasMetadata && setExpandedId(expanded ? null : e.id)}
                  style={{ cursor: hasMetadata ? 'pointer' : 'default' }}
                >
                  <td style={cell}>{formatDate(e.created_at)}</td>
                  <td style={cell}>{e.user_email ?? <span style={{ color: '#64748b' }}>—</span>}</td>
                  <td style={cell}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'rgba(59,130,246,.12)',
                        color: '#93c5fd',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {e.modulo}
                    </span>
                  </td>
                  <td style={{ ...cell, fontFamily: 'monospace', fontSize: 12 }}>{e.acao}</td>
                  <td style={cell}>
                    <div>{e.descricao ?? <span style={{ color: '#64748b' }}>—</span>}</div>
                    {e.ip && (
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        IP: {e.ip}
                      </div>
                    )}
                    {hasMetadata && !expanded && (
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        clique para ver metadata
                      </div>
                    )}
                  </td>
                </tr>
                {expanded && hasMetadata && (
                  <tr>
                    <td colSpan={5} style={{ ...cell, background: 'rgba(0,0,0,.3)' }}>
                      <pre
                        style={{
                          fontSize: 11,
                          color: '#cbd5e1',
                          margin: 0,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {JSON.stringify(e.metadata, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
