'use client'

import { useState, useTransition } from 'react'
import { atualizarIdentidadeAction } from '@/app/actions/configuracoes/identidade'
import type { Escola } from '@/types/database'

export function IdentidadeForm({ escola }: { escola: Escola }) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [cor, setCor] = useState(escola.cor_primaria || '#1a2f5a')

  async function onSubmit(formData: FormData) {
    setMsg(null)
    startTransition(async () => {
      const r = await atualizarIdentidadeAction(formData)
      if ('error' in r && r.error) setMsg({ tipo: 'erro', texto: r.error })
      else setMsg({ tipo: 'ok', texto: 'Identidade atualizada!' })
    })
  }

  return (
    <form action={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Field label="Nome fantasia *">
        <input name="nome" defaultValue={escola.nome ?? ''} required minLength={2} style={inputStyle} />
      </Field>

      <Field label="Razão social">
        <input name="razao_social" defaultValue={escola.razao_social ?? ''} style={inputStyle} />
      </Field>

      <Field label="CNPJ (somente números ou com máscara)">
        <input name="cnpj" defaultValue={escola.cnpj ?? ''} maxLength={18} style={inputStyle} />
      </Field>

      <Field label="Slogan (máx. 120 caracteres)">
        <input name="slogan" defaultValue={escola.slogan ?? ''} maxLength={120} style={inputStyle} />
      </Field>

      <Field label="Texto de boas-vindas (máx. 500 caracteres)">
        <textarea
          name="texto_boas_vindas"
          defaultValue={escola.texto_boas_vindas ?? ''}
          maxLength={500}
          rows={3}
          style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
        />
      </Field>

      <Field label="Cor primária">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="color"
            name="cor_primaria"
            value={cor}
            onChange={e => setCor(e.target.value)}
            style={{ width: 56, height: 40, border: 'none', borderRadius: 8, background: 'none', cursor: 'pointer' }}
          />
          <code style={{ fontSize: 13, color: 'var(--text-3)' }}>{cor}</code>
        </div>
      </Field>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="submit" disabled={pending} style={btnPrimary}>
          {pending ? 'Salvando…' : 'Salvar identidade'}
        </button>
        {msg && (
          <span style={{ fontSize: 13, color: msg.tipo === 'ok' ? '#22c55e' : '#ef4444' }}>
            {msg.texto}
          </span>
        )}
      </div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>{label}</span>
      {children}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '10px 12px',
  color: 'var(--text-1)',
  fontSize: 14,
  outline: 'none',
}

const btnPrimary: React.CSSProperties = {
  background: '#f59e0b',
  border: 'none',
  borderRadius: 10,
  padding: '10px 18px',
  color: '#0a1628',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
}
