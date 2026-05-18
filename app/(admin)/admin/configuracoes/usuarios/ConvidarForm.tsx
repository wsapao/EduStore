'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { convidarUsuarioAction } from '@/app/actions/configuracoes/usuarios'

type PapelOpt = { id: string; nome: string; chave_preset: string | null; preset: boolean }

export function ConvidarForm({ papeis }: { papeis: PapelOpt[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  async function onSubmit(formData: FormData) {
    setMsg(null)
    startTransition(async () => {
      const r = await convidarUsuarioAction(formData)
      if ('error' in r && r.error) {
        setMsg({ tipo: 'erro', texto: r.error })
        return
      }
      setMsg({ tipo: 'ok', texto: 'Convite enviado!' })
      // limpa o form via reload da listagem
      router.refresh()
    })
  }

  return (
    <form action={onSubmit} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <Field label="E-mail">
        <input
          name="email"
          type="email"
          required
          placeholder="pessoa@escola.com"
          style={{ ...inputStyle, minWidth: 240 }}
        />
      </Field>

      <Field label="Papel">
        <select name="papel_id" required defaultValue="" style={inputStyle as any}>
          <option value="" disabled>Selecione…</option>
          {papeis.map(p => (
            <option key={p.id} value={p.id}>
              {p.nome}{p.preset ? ' (preset)' : ''}
            </option>
          ))}
        </select>
      </Field>

      <button type="submit" disabled={pending} style={btnPrimary}>
        {pending ? 'Enviando…' : 'Enviar convite'}
      </button>

      {msg && (
        <span style={{ fontSize: 13, color: msg.tipo === 'ok' ? '#22c55e' : '#ef4444' }}>
          {msg.texto}
        </span>
      )}
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)' }}>{label}</span>
      {children}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '8px 12px',
  color: 'var(--text-1)',
  fontSize: 13,
  outline: 'none',
}

const btnPrimary: React.CSSProperties = {
  background: '#f59e0b',
  border: 'none',
  borderRadius: 10,
  padding: '8px 16px',
  color: '#0a1628',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
  height: 36,
}
