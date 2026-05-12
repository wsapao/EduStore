'use client'

import { useState, useTransition } from 'react'
import {
  iniciarMfaAction,
  verificarMfaAction,
  desativarMfaAction,
} from '@/app/actions/configuracoes/conta'

type Estado =
  | { kind: 'idle' }
  | { kind: 'iniciando' }
  | { kind: 'enrolling'; factorId: string; qrCode: string; secret: string }
  | { kind: 'verificando' }
  | { kind: 'erro'; mensagem: string }

export function MfaCard({
  mfaAtivo,
  factorId,
}: {
  mfaAtivo: boolean
  factorId: string | null
}) {
  const [pending, startTransition] = useTransition()
  const [estado, setEstado] = useState<Estado>({ kind: 'idle' })
  const [codigo, setCodigo] = useState('')

  function iniciar() {
    setEstado({ kind: 'iniciando' })
    startTransition(async () => {
      const r = await iniciarMfaAction()
      if ('error' in r && r.error) {
        setEstado({ kind: 'erro', mensagem: r.error })
        return
      }
      setEstado({
        kind: 'enrolling',
        factorId: r.factorId!,
        qrCode: r.qrCode!,
        secret: r.secret!,
      })
    })
  }

  function verificar() {
    if (estado.kind !== 'enrolling') return
    if (codigo.length !== 6) return
    const fId = estado.factorId
    setEstado({ kind: 'verificando' })
    startTransition(async () => {
      const r = await verificarMfaAction({ factorId: fId, codigo })
      if ('error' in r && r.error) {
        setEstado({ kind: 'erro', mensagem: r.error })
        return
      }
      window.location.reload()
    })
  }

  function desativar() {
    if (!factorId) return
    if (!confirm('Desativar MFA? Você perderá a proteção da segunda etapa.')) return
    startTransition(async () => {
      const r = await desativarMfaAction({ factorId })
      if ('error' in r && r.error) {
        setEstado({ kind: 'erro', mensagem: r.error })
        return
      }
      window.location.reload()
    })
  }

  if (mfaAtivo && factorId) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: '#22c55e' }} />
          <span style={{ fontSize: 14, color: '#cbd5e1' }}>MFA ativo</span>
        </div>
        <button onClick={desativar} disabled={pending} style={btnDanger}>
          {pending ? 'Desativando…' : 'Desativar MFA'}
        </button>
      </div>
    )
  }

  if (estado.kind === 'enrolling') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: 13, color: '#94a3b8' }}>
          Escaneie o QR no seu app autenticador (Authy, 1Password, Google Authenticator…)
          e cole o código de 6 dígitos abaixo.
        </p>

        <div
          dangerouslySetInnerHTML={{ __html: estado.qrCode }}
          style={{ background: '#fff', padding: 12, borderRadius: 10, width: 'fit-content' }}
        />

        <code style={{ fontSize: 12, color: '#94a3b8', wordBreak: 'break-all' }}>
          Secret manual: {estado.secret}
        </code>

        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          value={codigo}
          onChange={e => setCodigo(e.target.value.replace(/\D/g, ''))}
          style={{ ...inputStyle, letterSpacing: '0.3em', fontFamily: 'monospace' }}
        />

        <button onClick={verificar} disabled={pending || codigo.length !== 6} style={btnPrimary}>
          {pending ? 'Verificando…' : 'Confirmar e ativar'}
        </button>
      </div>
    )
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>
        Adicione uma camada extra de segurança usando um app autenticador.
      </p>
      <button onClick={iniciar} disabled={pending} style={btnPrimary}>
        {estado.kind === 'iniciando' ? 'Carregando…' : 'Ativar MFA'}
      </button>
      {estado.kind === 'erro' && (
        <p style={{ fontSize: 13, color: '#ef4444', marginTop: 8 }}>{estado.mensagem}</p>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.25)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: '10px 12px',
  color: '#f8fafc',
  fontSize: 18,
  outline: 'none',
  textAlign: 'center',
  width: 160,
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

const btnDanger: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(239,68,68,0.4)',
  borderRadius: 10,
  padding: '8px 16px',
  color: '#ef4444',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
}
