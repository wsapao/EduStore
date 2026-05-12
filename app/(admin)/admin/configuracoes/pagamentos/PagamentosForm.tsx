'use client'

import { useState, useTransition } from 'react'
import { atualizarPagamentosAction } from '@/app/actions/configuracoes/pagamentos'
import type { EscolaConfiguracoes } from '@/types/database'

const EXPIRACOES = [
  { valor: 900,    rotulo: '15 minutos' },
  { valor: 1800,   rotulo: '30 minutos' },
  { valor: 3600,   rotulo: '1 hora' },
  { valor: 86400,  rotulo: '24 horas' },
]

export function PagamentosForm({ config }: { config: EscolaConfiguracoes }) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [taxaRepassada, setTaxaRepassada] = useState(config.taxa_cartao_repassada)

  async function onSubmit(formData: FormData) {
    setMsg(null)
    startTransition(async () => {
      const r = await atualizarPagamentosAction(formData)
      if ('error' in r && r.error) setMsg({ tipo: 'erro', texto: r.error })
      else setMsg({ tipo: 'ok', texto: 'Configurações salvas!' })
    })
  }

  const metodos = new Set(config.metodos_aceitos_padrao)

  return (
    <form action={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Field label="Métodos aceitos por padrão">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Checkbox name="metodos_aceitos_padrao" value="pix"     defaultChecked={metodos.has('pix')}     label="PIX" />
          <Checkbox name="metodos_aceitos_padrao" value="cartao"  defaultChecked={metodos.has('cartao')}  label="Cartão" />
          <Checkbox name="metodos_aceitos_padrao" value="boleto"  defaultChecked={metodos.has('boleto')}  label="Boleto" />
        </div>
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="Máximo de parcelas (1-12)">
          <input
            name="max_parcelas_padrao"
            type="number"
            min={1}
            max={12}
            defaultValue={config.max_parcelas_padrao}
            required
            style={inputStyle}
          />
        </Field>

        <Field label="Expiração do PIX">
          <select name="pix_expiracao_segundos" defaultValue={String(config.pix_expiracao_segundos)} style={inputStyle as any}>
            {EXPIRACOES.map(e => (
              <option key={e.valor} value={e.valor}>{e.rotulo}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Taxa de cartão repassada ao cliente">
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              name="taxa_cartao_repassada"
              checked={taxaRepassada}
              onChange={e => setTaxaRepassada(e.target.checked)}
              style={checkboxStyle}
            />
            <span style={{ fontSize: 13, color: '#cbd5e1' }}>Repassar a taxa para o cliente</span>
          </label>

          {taxaRepassada && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                name="taxa_cartao_percentual"
                type="number"
                step="0.01"
                min={0}
                max={100}
                defaultValue={config.taxa_cartao_percentual ?? ''}
                placeholder="0.00"
                required
                style={{ ...inputStyle, width: 100 }}
              />
              <span style={{ fontSize: 13, color: '#94a3b8' }}>%</span>
            </div>
          )}
        </div>
      </Field>

      <Field label="Webhook secret do Asaas">
        <input
          name="asaas_webhook_secret"
          defaultValue={config.asaas_webhook_secret ?? ''}
          placeholder="Use o mesmo valor configurado no painel do Asaas"
          style={inputStyle}
        />
      </Field>

      <Field label="Chave PIX recebedora (exibida em comprovantes)">
        <input
          name="pix_chave_recebedora"
          defaultValue={config.pix_chave_recebedora ?? ''}
          placeholder="CPF, e-mail, telefone ou chave aleatória"
          style={inputStyle}
        />
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
      <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>{label}</span>
      {children}
    </label>
  )
}

function Checkbox({ name, value, defaultChecked, label }: { name: string; value: string; defaultChecked?: boolean; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} style={checkboxStyle} />
      <span style={{ fontSize: 13, color: '#cbd5e1' }}>{label}</span>
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
