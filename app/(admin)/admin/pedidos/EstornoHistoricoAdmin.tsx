'use client'

import { useState } from 'react'

interface EstornoResolvidoAdmin {
  id: string
  status: 'aprovado' | 'negado'
  motivo: string
  obs_admin: string | null
  valor_total: number
  created_at: string
  resolvido_em: string | null
}

interface Props {
  estornos: EstornoResolvidoAdmin[]
}

function fmtBRL(v: number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function EstornoHistoricoAdmin({ estornos }: Props) {
  const [aberto, setAberto] = useState(false)

  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={() => setAberto(v => !v)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 11, color: '#94a3b8', fontWeight: 600, padding: '4px 0',
          display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        {aberto ? '▲' : '▼'} Ver estornos anteriores ({estornos.length})
      </button>

      {aberto && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {estornos.map(e => (
            <div
              key={e.id}
              style={{
                padding: '8px 10px', borderRadius: 6,
                background: e.status === 'aprovado' ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
                border: `1px solid ${e.status === 'aprovado' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                fontSize: 11, color: 'rgba(255,255,255,0.7)',
              }}
            >
              <div style={{ fontWeight: 700, color: e.status === 'aprovado' ? '#34d399' : '#f87171', marginBottom: 3 }}>
                {e.status === 'aprovado' ? '✓ Aprovado' : '✕ Negado'} — {fmtBRL(e.valor_total)}
                {e.resolvido_em ? ` · ${fmtData(e.resolvido_em)}` : ''}
              </div>
              <div>Motivo: {e.motivo}</div>
              {e.obs_admin && <div style={{ marginTop: 2 }}>Obs. admin: {e.obs_admin}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
