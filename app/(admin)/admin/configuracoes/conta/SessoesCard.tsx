'use client'

import { useState, useTransition } from 'react'
import { encerrarOutrasSessoesAction } from '@/app/actions/configuracoes/conta'

export function SessoesCard() {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  function encerrar() {
    if (!confirm('Encerrar todas as outras sessões deste usuário?')) return
    setMsg(null)
    startTransition(async () => {
      const r = await encerrarOutrasSessoesAction()
      if ('error' in r && r.error) {
        setMsg({ tipo: 'erro', texto: r.error })
      } else {
        setMsg({ tipo: 'ok', texto: 'Outras sessões encerradas.' })
      }
    })
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>
        Encerra todas as outras sessões deste usuário em outros navegadores ou dispositivos.
        Esta sessão atual continua ativa.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={encerrar} disabled={pending} style={btnDanger}>
          {pending ? 'Encerrando…' : 'Encerrar outras sessões'}
        </button>
        {msg && (
          <span style={{ fontSize: 13, color: msg.tipo === 'ok' ? '#22c55e' : '#ef4444' }}>
            {msg.texto}
          </span>
        )}
      </div>
    </div>
  )
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
