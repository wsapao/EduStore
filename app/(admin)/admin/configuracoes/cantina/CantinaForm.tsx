'use client'

import { useState, useTransition } from 'react'
import { atualizarCantinaAction } from '@/app/actions/configuracoes/cantina'
import type { EscolaConfiguracoes } from '@/types/database'

export function CantinaForm({ config }: { config: EscolaConfiguracoes }) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [exigePin, setExigePin] = useState(config.cantina_exige_pin)

  async function onSubmit(formData: FormData) {
    setMsg(null)
    startTransition(async () => {
      const r = await atualizarCantinaAction(formData)
      if ('error' in r && r.error) setMsg({ tipo: 'erro', texto: r.error })
      else setMsg({ tipo: 'ok', texto: 'Configurações salvas!' })
    })
  }

  const metodos = new Set(config.cantina_metodos_recarga)

  return (
    <form action={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="Valor mínimo de recarga (R$)">
          <input
            name="cantina_recarga_min"
            type="number"
            step="0.01"
            min={0}
            defaultValue={config.cantina_recarga_min}
            required
            style={inputStyle}
          />
        </Field>

        <Field label="Valor máximo de recarga (R$)">
          <input
            name="cantina_recarga_max"
            type="number"
            step="0.01"
            min={0}
            defaultValue={config.cantina_recarga_max}
            required
            style={inputStyle}
          />
        </Field>
      </div>

      <Field label="Métodos aceitos para recarga">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Checkbox name="cantina_metodos_recarga" value="pix"     defaultChecked={metodos.has('pix')}     label="PIX" />
          <Checkbox name="cantina_metodos_recarga" value="cartao"  defaultChecked={metodos.has('cartao')}  label="Cartão" />
          <Checkbox name="cantina_metodos_recarga" value="boleto"  defaultChecked={metodos.has('boleto')}  label="Boleto" />
        </div>
      </Field>

      <Field label="PIN para resgate">
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              name="cantina_exige_pin"
              checked={exigePin}
              onChange={e => setExigePin(e.target.checked)}
              style={checkboxStyle}
            />
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Exigir PIN para resgate</span>
          </label>

          {exigePin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                name="cantina_pin_tamanho"
                type="number"
                min={4}
                max={6}
                defaultValue={config.cantina_pin_tamanho}
                required
                style={{ ...inputStyle, width: 120 }}
              />
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>dígitos (4–6)</span>
            </div>
          )}
        </div>
      </Field>

      <Field label="Saldo">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            name="cantina_saldo_negativo"
            defaultChecked={config.cantina_saldo_negativo}
            style={checkboxStyle}
          />
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Permitir saldo negativo (compras a crédito)</span>
        </label>
      </Field>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="submit" disabled={pending} style={btnPrimary}>
          {pending ? 'Salvando…' : 'Salvar configurações'}
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

function Checkbox({ name, value, defaultChecked, label }: { name: string; value: string; defaultChecked?: boolean; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} style={checkboxStyle} />
      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{label}</span>
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

const checkboxStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  cursor: 'pointer',
  accentColor: '#f59e0b',
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
