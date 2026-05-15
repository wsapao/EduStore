'use client'

import { useState } from 'react'
import { EMAIL_TEMPLATE_META, type EmailTemplateTipo } from '@/lib/email/templates-config'
import { TemplateEditor } from './TemplateEditor'

export interface TemplateEntry {
  tipo: EmailTemplateTipo
  customizado: boolean
  assunto: string
  corpo: string
  updated_at: string | null
  updated_by_email: string | null
}

export function EmailsView({ templates }: { templates: TemplateEntry[] }) {
  const [selecionado, setSelecionado] = useState<EmailTemplateTipo>(templates[0]?.tipo ?? 'pedido_pago')
  const ativo = templates.find((t) => t.tipo === selecionado) ?? templates[0]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>
      <aside
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          padding: 8,
          position: 'sticky',
          top: 16,
        }}
      >
        {templates.map((t) => {
          const meta = EMAIL_TEMPLATE_META[t.tipo]
          const isActive = t.tipo === selecionado
          return (
            <button
              key={t.tipo}
              type="button"
              onClick={() => setSelecionado(t.tipo)}
              style={{
                display: 'flex',
                width: '100%',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                background: isActive ? 'rgba(99,102,241,0.18)' : 'transparent',
                border: '1px solid ' + (isActive ? 'rgba(99,102,241,0.45)' : 'transparent'),
                borderRadius: 10,
                color: isActive ? '#fff' : '#cbd5e1',
                fontSize: 13,
                fontWeight: isActive ? 800 : 600,
                cursor: 'pointer',
                marginBottom: 4,
                textAlign: 'left',
                gap: 8,
              }}
            >
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {meta.label}
              </span>
              {t.customizado && (
                <span
                  style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 6,
                    background: 'rgba(34,197,94,0.18)',
                    color: '#86efac',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                  title="Customizado"
                >
                  CUSTOM
                </span>
              )}
            </button>
          )
        })}
      </aside>

      <div style={{ minWidth: 0 }}>
        {ativo && <TemplateEditor key={ativo.tipo} entry={ativo} />}
      </div>
    </div>
  )
}
