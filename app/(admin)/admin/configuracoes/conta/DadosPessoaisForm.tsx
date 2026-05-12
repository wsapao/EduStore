'use client'

import { useState, useTransition } from 'react'
import { atualizarPerfilContaAction } from '@/app/actions/configuracoes/conta'

export function DadosPessoaisForm({
  nomeAtual,
  emailAtual,
}: {
  nomeAtual: string
  emailAtual: string
}) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  async function onSubmit(formData: FormData) {
    setMsg(null)
    startTransition(async () => {
      const r = await atualizarPerfilContaAction(formData)
      if ('error' in r && r.error) {
        setMsg({ tipo: 'erro', texto: r.error })
      } else {
        setMsg({ tipo: 'ok', texto: 'Salvo!' })
      }
    })
  }

  return (
    <form action={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Field label="Nome">
        <input
          name="nome"
          defaultValue={nomeAtual}
          minLength={3}
          required
          style={inputStyle}
        />
      </Field>

      <Field label="E-mail (somente leitura)">
        <input value={emailAtual} disabled style={{ ...inputStyle, opacity: 0.6 }} />
      </Field>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="submit" disabled={pending} style={btnPrimary}>
          {pending ? 'Salvando…' : 'Salvar'}
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
      <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>{label}</span>
      {children}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.25)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: '10px 12px',
  color: '#f8fafc',
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
