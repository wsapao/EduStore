'use client'

import { useState, useTransition } from 'react'
import { atualizarCheckoutAction } from '@/app/actions/configuracoes/checkout'
import type { EscolaConfiguracoes } from '@/types/database'

export function CheckoutForm({ config }: { config: EscolaConfiguracoes }) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  async function onSubmit(formData: FormData) {
    setMsg(null)
    startTransition(async () => {
      const r = await atualizarCheckoutAction(formData)
      if ('error' in r && r.error) setMsg({ tipo: 'erro', texto: r.error })
      else setMsg({ tipo: 'ok', texto: 'Configurações salvas!' })
    })
  }

  return (
    <form action={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Field label="Termo padrão de compra (aplicado a produtos sem termo próprio, máx. 5000 caracteres)">
        <textarea
          name="termo_padrao_compra"
          rows={6}
          maxLength={5000}
          defaultValue={config.termo_padrao_compra ?? ''}
          placeholder="Ex.: Ao concluir esta compra, você concorda com os termos da escola..."
          style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
        />
      </Field>

      <Field label="Mensagem pós-compra (mostrada ao responsável após finalizar pedido, máx. 1000 caracteres)">
        <textarea
          name="mensagem_pos_compra"
          rows={3}
          maxLength={1000}
          defaultValue={config.mensagem_pos_compra ?? ''}
          placeholder="Ex.: Obrigado! Seu pedido será processado em breve."
          style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
        />
      </Field>

      <Field label="Tempo de expiração do carrinho (minutos sem checkout)">
        <input
          name="carrinho_expiracao_minutos"
          type="number"
          min={1}
          defaultValue={config.carrinho_expiracao_minutos}
          required
          style={{ ...inputStyle, width: 160 }}
        />
      </Field>

      <Field label="Pedidos com múltiplos alunos">
        <Toggle
          name="permite_multiplos_alunos"
          defaultChecked={config.permite_multiplos_alunos}
          label="Permitir incluir mais de um aluno no mesmo pedido"
        />
      </Field>

      <Field label="Cadastro de responsáveis">
        <Toggle
          name="exige_cpf_responsavel"
          defaultChecked={config.exige_cpf_responsavel}
          label="Exigir CPF do responsável no cadastro"
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
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>{label}</span>
      {children}
    </label>
  )
}

function Toggle({ name, defaultChecked, label }: { name: string; defaultChecked?: boolean; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} style={checkboxStyle} />
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
