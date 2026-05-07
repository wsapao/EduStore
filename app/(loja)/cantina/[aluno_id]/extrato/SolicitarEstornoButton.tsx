'use client'

import { useState, useTransition } from 'react'
import { solicitarEstornoAction } from '@/app/actions/cantina'

interface Props {
  recargaId: string
  valor: number
  statusEstorno: string | null // null = sem solicitação, 'pendente' | 'aprovado' | 'negado'
  observacaoAdmin?: string | null
}

function fmtMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const STATUS_ESTORNO: Record<string, { label: string; cor: string; bg: string }> = {
  pendente:         { label: '⏳ Estorno em análise',    cor: '#92400e', bg: '#fef3c7' },
  aprovado:         { label: '✅ Estorno aprovado',      cor: '#065f46', bg: '#d1fae5' },
  negado:           { label: '❌ Estorno negado',        cor: '#991b1b', bg: '#fee2e2' },
  estorno_aprovado: { label: '🔄 Processando devolução', cor: '#1e40af', bg: '#dbeafe' },
  estornada:        { label: '✅ Valor devolvido',       cor: '#065f46', bg: '#d1fae5' },
}

export function SolicitarEstornoButton({ recargaId, valor, statusEstorno, observacaoAdmin }: Props) {
  const [pending, startTransition] = useTransition()
  const [aberto, setAberto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)

  // Mostra badge de status se já tem solicitação
  if (statusEstorno && STATUS_ESTORNO[statusEstorno]) {
    const cfg = STATUS_ESTORNO[statusEstorno]
    return (
      <div>
        <span style={{
          display: 'inline-block', padding: '3px 10px',
          borderRadius: 99, fontSize: 11, fontWeight: 700,
          color: cfg.cor, background: cfg.bg,
        }}>
          {cfg.label}
        </span>
        {statusEstorno === 'negado' && observacaoAdmin && (
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
            Motivo: {observacaoAdmin}
          </div>
        )}
      </div>
    )
  }

  if (enviado) {
    return (
      <span style={{
        display: 'inline-block', padding: '3px 10px',
        borderRadius: 99, fontSize: 11, fontWeight: 700,
        color: '#92400e', background: '#fef3c7',
      }}>
        ⏳ Solicitação enviada
      </span>
    )
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        style={{
          padding: '4px 10px', borderRadius: 99,
          background: 'transparent',
          border: '1px solid var(--border)',
          fontSize: 11, fontWeight: 600,
          color: 'var(--text-3)', cursor: 'pointer',
        }}
      >
        Solicitar estorno
      </button>
    )
  }

  function handleEnviar() {
    setErro(null)
    if (!motivo.trim() || motivo.trim().length < 10) {
      setErro('Descreva o motivo com pelo menos 10 caracteres.')
      return
    }
    startTransition(async () => {
      const res = await solicitarEstornoAction(recargaId, motivo)
      if ('error' in res) {
        setErro(res.error)
      } else {
        setEnviado(true)
        setAberto(false)
      }
    })
  }

  return (
    <div style={{
      marginTop: 8, padding: '12px 14px',
      background: '#fff7ed', border: '1px solid #fed7aa',
      borderRadius: 'var(--r-md)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>
        Solicitar estorno de {fmtMoeda(valor)}
      </div>
      <textarea
        placeholder="Descreva o motivo do estorno (ex: recarga duplicada, valor errado...)"
        value={motivo}
        onChange={e => setMotivo(e.target.value)}
        rows={3}
        style={{
          width: '100%', padding: '8px 10px',
          borderRadius: 'var(--r-sm)',
          border: '1.5px solid #fed7aa',
          fontSize: 12, resize: 'vertical',
          fontFamily: 'inherit', outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      {erro && (
        <div style={{ fontSize: 11, color: '#991b1b', fontWeight: 600, marginTop: 4 }}>
          ❌ {erro}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          onClick={handleEnviar}
          disabled={pending}
          style={{
            flex: 1, padding: '8px',
            background: '#f59e0b', color: '#fff',
            border: 'none', borderRadius: 'var(--r-sm)',
            fontSize: 12, fontWeight: 700,
            cursor: pending ? 'not-allowed' : 'pointer',
            opacity: pending ? 0.7 : 1,
          }}
        >
          {pending ? 'Enviando…' : 'Enviar solicitação'}
        </button>
        <button
          onClick={() => { setAberto(false); setErro(null) }}
          disabled={pending}
          style={{
            padding: '8px 14px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)',
            fontSize: 12, fontWeight: 600,
            color: 'var(--text-3)', cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
