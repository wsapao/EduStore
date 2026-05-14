'use client'

import { useState } from 'react'
import type { AuditFiltro } from '@/app/actions/configuracoes/auditoria'

const MODULOS = [
  'identidade',
  'pagamentos',
  'cantina',
  'checkout',
  'loja-online',
  'integracoes',
  'termos',
  'usuarios',
  'conta',
  'papeis',
] as const

const inputStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,.25)',
  border: '1px solid rgba(255,255,255,.1)',
  borderRadius: 8,
  padding: '8px 10px',
  color: '#f8fafc',
  fontSize: 13,
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#cbd5e1',
  textTransform: 'uppercase',
  letterSpacing: '.05em',
  marginBottom: 4,
  display: 'block',
}

export function AuditoriaFilters({
  busca,
  onBuscaChange,
  onAplicar,
  onExportar,
  loading,
  exporting,
}: {
  busca: string
  onBuscaChange: (v: string) => void
  onAplicar: (f: AuditFiltro) => void
  onExportar: () => void
  loading: boolean
  exporting: boolean
}) {
  const [modulo, setModulo] = useState<string>('')
  const [dataInicio, setDataInicio] = useState<string>('')
  const [dataFim, setDataFim] = useState<string>('')

  function aplicar() {
    onAplicar({
      modulo: modulo || null,
      dataInicio: dataInicio ? new Date(dataInicio).toISOString() : null,
      dataFim: dataFim ? new Date(dataFim + 'T23:59:59').toISOString() : null,
    })
  }

  return (
    <div
      style={{
        background: 'rgba(0,0,0,.25)',
        border: '1px solid rgba(255,255,255,.06)',
        borderRadius: 12,
        padding: 16,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 12,
        alignItems: 'end',
      }}
    >
      <div>
        <label style={labelStyle}>Módulo</label>
        <select
          value={modulo}
          onChange={(e) => setModulo(e.target.value)}
          style={{ ...inputStyle, width: '100%' }}
        >
          <option value="">Todos</option>
          {MODULOS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Data início</label>
        <input
          type="date"
          value={dataInicio}
          onChange={(e) => setDataInicio(e.target.value)}
          style={{ ...inputStyle, width: '100%' }}
        />
      </div>

      <div>
        <label style={labelStyle}>Data fim</label>
        <input
          type="date"
          value={dataFim}
          onChange={(e) => setDataFim(e.target.value)}
          style={{ ...inputStyle, width: '100%' }}
        />
      </div>

      <div>
        <label style={labelStyle}>Busca local</label>
        <input
          type="text"
          placeholder="Filtrar resultados..."
          value={busca}
          onChange={(e) => onBuscaChange(e.target.value)}
          style={{ ...inputStyle, width: '100%' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={aplicar}
          disabled={loading}
          style={{
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 700,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.7 : 1,
            flex: 1,
          }}
        >
          {loading ? 'Buscando...' : 'Aplicar'}
        </button>
        <button
          type="button"
          onClick={onExportar}
          disabled={exporting}
          style={{
            background: 'transparent',
            color: '#cbd5e1',
            border: '1px solid rgba(255,255,255,.15)',
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 700,
            cursor: exporting ? 'wait' : 'pointer',
            opacity: exporting ? 0.7 : 1,
          }}
        >
          {exporting ? '...' : 'CSV'}
        </button>
      </div>
    </div>
  )
}
