'use client'

import { useState, useTransition } from 'react'
import { alterarSenhaAction } from '@/app/actions/perfil'

export function SenhaForm() {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  async function onSubmit(formData: FormData) {
    setMsg(null)

    const nova = formData.get('nova_senha') as string
    const conf = formData.get('confirma_senha') as string
    if (nova !== conf) {
      setMsg({ tipo: 'erro', texto: 'As senhas não coincidem.' })
      return
    }
    if (nova.length < 8) {
      setMsg({ tipo: 'erro', texto: 'A nova senha deve ter pelo menos 8 caracteres.' })
      return
    }

    startTransition(async () => {
      const r = await alterarSenhaAction(formData)
      if ('error' in r && r.error) {
        setMsg({ tipo: 'erro', texto: r.error })
      } else {
        setMsg({ tipo: 'ok', texto: 'Senha alterada com sucesso!' })
      }
    })
  }

  return (
    <form action={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Field label="Senha atual">
        <input name="senha_atual" type="password" required style={inputStyle} />
      </Field>
      <Field label="Nova senha (mín. 8 caracteres)">
        <input name="nova_senha" type="password" required minLength={8} style={inputStyle} />
      </Field>
      <Field label="Confirmar nova senha">
        <input name="confirma_senha" type="password" required minLength={8} style={inputStyle} />
      </Field>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="submit" disabled={pending} style={btnPrimary}>
          {pending ? 'Alterando…' : 'Alterar senha'}
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
