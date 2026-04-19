'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { configurarCarteiraAction } from '@/app/actions/cantina'

interface Props {
  alunoId: string
  alunoNome: string
  limiteDiario: number | null
  ativo: boolean
  bloqueioMotivo: string | null
}

export function ConfigurarClient({ alunoId, alunoNome, limiteDiario, ativo, bloqueioMotivo }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [limite, setLimite] = useState<string>(limiteDiario != null ? String(limiteDiario) : '')
  const [semLimite, setSemLimite] = useState(limiteDiario == null)
  const [bloqueada, setBloqueada] = useState(!ativo)
  const [motivo, setMotivo] = useState(bloqueioMotivo ?? '')
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)

    const limiteFinal = semLimite ? null : parseFloat(limite.replace(',', '.'))
    if (!semLimite && (isNaN(limiteFinal!) || limiteFinal! <= 0)) {
      setMsg({ type: 'error', text: 'Digite um limite diário válido (maior que zero).' })
      return
    }
    const bloqueioFinal = bloqueada ? (motivo.trim() || 'Bloqueado pelo responsável') : null

    startTransition(async () => {
      const res = await configurarCarteiraAction(alunoId, limiteFinal ?? null, bloqueioFinal)
      if (res.error) {
        setMsg({ type: 'error', text: res.error })
      } else {
        setMsg({ type: 'success', text: 'Configurações salvas!' })
        setTimeout(() => router.push('/cantina'), 1200)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Limite diário */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)', padding: '20px', boxShadow: 'var(--shadow-xs)',
      }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)', marginBottom: 4 }}>
          💳 Limite diário de gasto
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>
          Define quanto {alunoNome.split(' ')[0]} pode gastar por dia na cantina.
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={semLimite}
            onChange={e => setSemLimite(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
            Sem limite diário
          </span>
        </label>

        {!semLimite && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-2)' }}>R$</span>
            <input
              type="number"
              min="1"
              step="0.01"
              placeholder="Ex: 20,00"
              value={limite}
              onChange={e => setLimite(e.target.value)}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 'var(--r-md)',
                border: '1.5px solid var(--border)', fontSize: 15, fontWeight: 700,
                outline: 'none', maxWidth: 160,
              }}
            />
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>por dia</span>
          </div>
        )}
      </div>

      {/* Bloquear carteira */}
      <div style={{
        background: 'var(--surface)', border: `1.5px solid ${bloqueada ? 'var(--danger)' : 'var(--border)'}`,
        borderRadius: 'var(--r-lg)', padding: '20px', boxShadow: 'var(--shadow-xs)',
        transition: 'border-color .2s',
      }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)', marginBottom: 4 }}>
          🔒 Bloqueio da carteira
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>
          Impede qualquer compra enquanto estiver bloqueada.
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 14 }}>
          <input
            type="checkbox"
            checked={bloqueada}
            onChange={e => setBloqueada(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: bloqueada ? 'var(--danger)' : 'var(--text-2)' }}>
            Carteira bloqueada
          </span>
        </label>

        {bloqueada && (
          <input
            type="text"
            placeholder="Motivo (opcional, ex: férias)"
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            maxLength={100}
            style={{
              width: '100%', padding: '10px 12px',
              borderRadius: 'var(--r-md)', border: '1.5px solid var(--danger)',
              fontSize: 13, outline: 'none',
            }}
          />
        )}
      </div>

      {/* Feedback */}
      {msg && (
        <div style={{
          padding: '12px 16px', borderRadius: 'var(--r-md)',
          background: msg.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
          color: msg.type === 'success' ? '#065f46' : '#991b1b',
          fontSize: 13, fontWeight: 600,
        }}>
          {msg.type === 'success' ? '✅' : '❌'} {msg.text}
        </div>
      )}

      {/* Botões */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" disabled={pending} style={{
          flex: 1, padding: '13px', borderRadius: 'var(--r-md)',
          background: pending ? 'var(--border)' : 'var(--brand)',
          color: '#fff', border: 'none', cursor: pending ? 'not-allowed' : 'pointer',
          fontSize: 14, fontWeight: 800,
          transition: 'all .2s',
        }}>
          {pending ? 'Salvando…' : 'Salvar configurações'}
        </button>
        <button type="button" onClick={() => router.push('/cantina')} style={{
          padding: '13px 20px', borderRadius: 'var(--r-md)',
          background: 'var(--surface)', border: '1px solid var(--border)',
          color: 'var(--text-2)', cursor: 'pointer', fontSize: 14, fontWeight: 600,
        }}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
