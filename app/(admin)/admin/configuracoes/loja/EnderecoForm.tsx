'use client'

import { useState, useTransition } from 'react'
import { atualizarEnderecoAction } from '@/app/actions/configuracoes/identidade'
import type { Escola } from '@/types/database'

const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]

export function EnderecoForm({ escola }: { escola: Escola }) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  async function onSubmit(formData: FormData) {
    setMsg(null)
    startTransition(async () => {
      const r = await atualizarEnderecoAction(formData)
      if ('error' in r && r.error) setMsg({ tipo: 'erro', texto: r.error })
      else setMsg({ tipo: 'ok', texto: 'Endereço atualizado!' })
    })
  }

  return (
    <form action={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
        <Field label="Logradouro">
          <input name="endereco_logradouro" defaultValue={escola.endereco_logradouro ?? ''} style={inputStyle} />
        </Field>
        <Field label="Número">
          <input name="endereco_numero" defaultValue={escola.endereco_numero ?? ''} style={inputStyle} />
        </Field>
      </div>

      <Field label="Bairro">
        <input name="endereco_bairro" defaultValue={escola.endereco_bairro ?? ''} style={inputStyle} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 14 }}>
        <Field label="Cidade">
          <input name="endereco_cidade" defaultValue={escola.endereco_cidade ?? ''} style={inputStyle} />
        </Field>
        <Field label="UF">
          <select name="endereco_uf" defaultValue={escola.endereco_uf ?? ''} style={inputStyle as any}>
            <option value="">—</option>
            {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </Field>
        <Field label="CEP">
          <input
            name="endereco_cep"
            defaultValue={escola.endereco_cep ?? ''}
            maxLength={9}
            placeholder="00000-000"
            style={inputStyle}
          />
        </Field>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="submit" disabled={pending} style={btnPrimary}>
          {pending ? 'Salvando…' : 'Salvar endereço'}
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
