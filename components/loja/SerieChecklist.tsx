'use client'

import { segmentoSerie } from '@/lib/crm/series-core'

interface Props {
  series: string[]
  value: string
  onChange: (serie: string) => void
}

// Lista de séries com seleção única (semântica de radio, visual de checkbox).
// Mostra todas as opções agrupadas por segmento em vez de um dropdown — o
// responsável não identificado na base só consegue escolher uma série que a
// escola realmente oferece, na nomenclatura que a loja reconhece.
export function SerieChecklist({ series, value, onChange }: Props) {
  const grupos: { segmento: string; series: string[] }[] = []
  for (const s of series) {
    const segmento = segmentoSerie(s)
    const grupo = grupos.find(g => g.segmento === segmento)
    if (grupo) grupo.series.push(s)
    else grupos.push({ segmento, series: [s] })
  }

  return (
    <div
      role="radiogroup"
      aria-label="Série / Ano"
      style={{
        border: '1.5px solid var(--border)',
        borderRadius: 10,
        background: 'var(--surface-2)',
        maxHeight: 300,
        overflowY: 'auto',
      }}
    >
      {grupos.map(grupo => (
        <div key={grupo.segmento}>
          <div style={{
            position: 'sticky', top: 0, zIndex: 1,
            padding: '8px 14px 6px',
            fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em',
            textTransform: 'uppercase', color: 'var(--text-3)',
            background: 'var(--surface-2)',
            borderBottom: '1px solid var(--border)',
          }}>
            {grupo.segmento}
          </div>
          {grupo.series.map(s => {
            const selecionada = s === value
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={selecionada}
                onClick={() => onChange(s)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '11px 14px',
                  background: selecionada ? 'rgba(26,47,90,.06)' : 'transparent',
                  border: 'none', borderBottom: '1px solid var(--border)',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: selecionada ? 'var(--brand)' : '#fff',
                    border: selecionada ? '1.5px solid var(--brand)' : '1.5px solid var(--border)',
                    transition: 'all .12s ease',
                  }}
                >
                  {selecionada && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                <span style={{
                  fontSize: 14,
                  fontWeight: selecionada ? 700 : 500,
                  color: selecionada ? 'var(--brand)' : 'var(--text-1)',
                }}>
                  {s}
                </span>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
