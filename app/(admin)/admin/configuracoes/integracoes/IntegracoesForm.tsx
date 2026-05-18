'use client'

import { useState, useTransition } from 'react'
import {
  atualizarIntegracoesAction,
  testarActivesoftAction,
  testarCrmAction,
  reativarAsaasWebhookAction,
  type AsaasWebhook,
} from '@/app/actions/configuracoes/integracoes'
import type { EscolaConfiguracoes } from '@/types/database'

type AsaasStatus =
  | { ok: true; webhooks: AsaasWebhook[] }
  | { ok: false; message: string }

type TestResult = { tipo: 'ok' | 'erro'; texto: string } | null

export function IntegracoesForm({
  config,
  asaasStatus,
}: {
  config: EscolaConfiguracoes
  asaasStatus: AsaasStatus
}) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<TestResult>(null)
  const [activesoftMsg, setActivesoftMsg] = useState<TestResult>(null)
  const [crmMsg, setCrmMsg] = useState<TestResult>(null)
  const [webhooks, setWebhooks] = useState<AsaasWebhook[]>(
    asaasStatus.ok ? asaasStatus.webhooks : [],
  )
  const [reactivatingId, setReactivatingId] = useState<string | null>(null)
  const [testingActivesoft, startTestActivesoft] = useTransition()
  const [testingCrm, startTestCrm] = useTransition()

  async function onSubmit(formData: FormData) {
    setMsg(null)
    startTransition(async () => {
      const r = await atualizarIntegracoesAction(formData)
      if ('error' in r && r.error) setMsg({ tipo: 'erro', texto: r.error })
      else setMsg({ tipo: 'ok', texto: 'Configurações salvas!' })
    })
  }

  function handleTestActivesoft() {
    setActivesoftMsg(null)
    startTestActivesoft(async () => {
      const r = await testarActivesoftAction()
      setActivesoftMsg({ tipo: r.ok ? 'ok' : 'erro', texto: r.message })
    })
  }

  function handleTestCrm() {
    setCrmMsg(null)
    startTestCrm(async () => {
      const r = await testarCrmAction()
      setCrmMsg({ tipo: r.ok ? 'ok' : 'erro', texto: r.message })
    })
  }

  async function handleReativar(webhookId: string) {
    setReactivatingId(webhookId)
    const r = await reativarAsaasWebhookAction({ webhookId })
    setReactivatingId(null)
    if ('success' in r && r.success) {
      setWebhooks(prev => prev.map(w => (w.id === webhookId ? { ...w, interrupted: false } : w)))
    } else if ('error' in r) {
      alert(r.error)
    }
  }

  return (
    <form action={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Activesoft */}
      <Card title="Activesoft (SIGA)">
        <Toggle
          name="activesoft_ativo"
          defaultChecked={config.activesoft_ativo}
          label="Ativar integração com Activesoft"
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <button type="button" onClick={handleTestActivesoft} disabled={testingActivesoft} style={btnSecondary}>
            {testingActivesoft ? 'Testando…' : 'Testar conexão'}
          </button>
          {activesoftMsg && (
            <span style={{ fontSize: 13, color: activesoftMsg.tipo === 'ok' ? '#22c55e' : '#ef4444' }}>
              {activesoftMsg.texto}
            </span>
          )}
        </div>
      </Card>

      {/* CRM */}
      <Card title="CRM (EduCRM)">
        <Toggle
          name="crm_ativo"
          defaultChecked={config.crm_ativo}
          label="Ativar integração com EduCRM"
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <button type="button" onClick={handleTestCrm} disabled={testingCrm} style={btnSecondary}>
            {testingCrm ? 'Testando…' : 'Testar conexão'}
          </button>
          {crmMsg && (
            <span style={{ fontSize: 13, color: crmMsg.tipo === 'ok' ? '#22c55e' : '#ef4444' }}>
              {crmMsg.texto}
            </span>
          )}
        </div>
      </Card>

      {/* Asaas Webhook */}
      <Card title="Asaas Webhook">
        {!asaasStatus.ok && (
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
            {asaasStatus.message}
          </p>
        )}
        {asaasStatus.ok && webhooks.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
            Sem webhooks cadastrados na conta Asaas.
          </p>
        )}
        {asaasStatus.ok && webhooks.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {webhooks.map(w => (
              <div
                key={w.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '10px 12px',
                  background: 'var(--surface-2)',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{w.name || '(sem nome)'}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {w.url}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: w.interrupted ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                      color: w.interrupted ? '#ef4444' : '#22c55e',
                    }}
                  >
                    {w.interrupted ? 'Interrompido' : 'Ativo'}
                  </span>
                  {w.interrupted && (
                    <button
                      type="button"
                      onClick={() => handleReativar(w.id)}
                      disabled={reactivatingId === w.id}
                      style={btnSecondary}
                    >
                      {reactivatingId === w.id ? 'Reativando…' : 'Reativar'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Google Analytics */}
      <Card title="Google Analytics (GA4)">
        <Field label="ID de medição GA4">
          <input
            name="ga4_id"
            type="text"
            maxLength={50}
            defaultValue={config.ga4_id ?? ''}
            placeholder="G-XXXXXXXXXX"
            style={{ ...inputStyle, width: 260 }}
          />
        </Field>
      </Card>

      {/* Meta Pixel */}
      <Card title="Meta Pixel">
        <Field label="ID do Pixel (apenas dígitos)">
          <input
            name="meta_pixel_id"
            type="text"
            maxLength={30}
            defaultValue={config.meta_pixel_id ?? ''}
            placeholder="123456789"
            style={{ ...inputStyle, width: 260 }}
          />
        </Field>
      </Card>

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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 24,
      }}
    >
      <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)', marginTop: 0, marginBottom: 14 }}>
        {title}
      </h2>
      {children}
    </section>
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

const btnSecondary: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10,
  padding: '8px 14px',
  color: 'var(--text-1)',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
}
