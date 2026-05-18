'use client'

import { useState, useTransition } from 'react'
import { aprovarEstornoParcialAction, negarEstornoParcialAction } from '@/app/actions/admin'
import { getAdminButtonStyle } from '@/lib/admin-ui-tones'

interface ItemEstornoAdmin {
  item_pedido_id: string
  valor_item: number
  produto_nome: string
  aluno_nome: string
  variante: string | null
}

interface Props {
  estorno: {
    id: string
    pedido_id: string
    motivo: string
    valor_total: number
    created_at: string
    itens: ItemEstornoAdmin[]
  }
  metodoPagamento: string | null
}

function fmtBRL(v: number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function EstornoAdminCard({ estorno, metodoPagamento }: Props) {
  const [modo, setModo] = useState<'idle' | 'confirmar' | 'negar'>('idle')
  const [obsNegacao, setObsNegacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function executarAprovacao() {
    startTransition(async () => {
      const res = await aprovarEstornoParcialAction(estorno.id)
      if ('error' in res) { setErro(res.error); setModo('idle') }
    })
  }

  function executarNegacao() {
    if (!obsNegacao.trim()) { setErro('Informe o motivo da negação.'); return }
    setErro(null)
    startTransition(async () => {
      const res = await negarEstornoParcialAction(estorno.id, obsNegacao)
      if ('error' in res) setErro(res.error)
    })
  }

  const metodoLabel = metodoPagamento === 'pix' ? 'PIX' : metodoPagamento === 'cartao' ? 'Cartão' : 'Boleto'

  return (
    <div style={{
      marginTop: 10, padding: '12px 14px',
      background: '#fff7ed', border: '1px solid #fdba74',
      borderRadius: 8,
    }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#9a3412', marginBottom: 6 }}>
        ⚠️ Solicitação de estorno — {fmtData(estorno.created_at)}
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>
        <strong style={{ color: 'var(--text-1)' }}>Motivo:</strong> {estorno.motivo}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
        {estorno.itens.map(item => (
          <div
            key={item.item_pedido_id}
            style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-2)' }}
          >
            <span>
              {item.produto_nome} — {item.aluno_nome}
              {item.variante ? ` (${item.variante})` : ''}
            </span>
            <span style={{ fontWeight: 700 }}>{fmtBRL(item.valor_item)}</span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-1)', marginBottom: 10 }}>
        Total: {fmtBRL(estorno.valor_total)}
      </div>

      {metodoPagamento === 'boleto' && (
        <div style={{
          fontSize: 11, color: '#9a3412', padding: '6px 8px',
          background: '#ffedd5', border: '1px solid #fdba74', borderRadius: 6, marginBottom: 10,
        }}>
          📄 Pedido pago com boleto. Processe o reembolso manualmente no Asaas antes de aprovar.
        </div>
      )}

      {erro && (
        <div style={{ fontSize: 12, color: '#b91c1c', marginBottom: 8 }}>{erro}</div>
      )}

      {modo === 'idle' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setModo('confirmar')}
            style={getAdminButtonStyle('success', 'soft', { height: 34, padding: '0 14px', fontSize: 12, fontWeight: 700, borderRadius: 7 })}
          >
            ✓ Aprovar estorno
          </button>
          <button
            onClick={() => setModo('negar')}
            style={getAdminButtonStyle('danger', 'soft', { height: 34, padding: '0 14px', fontSize: 12, fontWeight: 700, borderRadius: 7 })}
          >
            ✕ Negar
          </button>
        </div>
      )}

      {modo === 'confirmar' && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 8 }}>
            Reembolsar {fmtBRL(estorno.valor_total)} via {metodoLabel}?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={executarAprovacao}
              disabled={pending}
              style={{ ...getAdminButtonStyle('success', 'solid', { height: 34, padding: '0 14px', fontSize: 12, fontWeight: 700, borderRadius: 7 }), opacity: pending ? 0.7 : 1, cursor: pending ? 'not-allowed' : 'pointer' }}
            >
              {pending ? 'Processando…' : 'Confirmar'}
            </button>
            <button
              onClick={() => setModo('idle')}
              disabled={pending}
              style={{ ...getAdminButtonStyle('neutral', 'soft', { height: 34, padding: '0 14px', fontSize: 12, fontWeight: 600, borderRadius: 7 }), opacity: pending ? 0.7 : 1 }}
            >
              Voltar
            </button>
          </div>
        </div>
      )}

      {modo === 'negar' && (
        <div>
          <textarea
            placeholder="Motivo da negação (obrigatório)"
            value={obsNegacao}
            onChange={e => setObsNegacao(e.target.value)}
            rows={2}
            style={{
              width: '100%', borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--surface)', padding: '8px',
              fontSize: 12, color: 'var(--text-1)', fontFamily: 'inherit',
              boxSizing: 'border-box', resize: 'vertical', marginBottom: 8,
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={executarNegacao}
              disabled={pending}
              style={{ ...getAdminButtonStyle('danger', 'solid', { height: 34, padding: '0 14px', fontSize: 12, fontWeight: 700, borderRadius: 7 }), opacity: pending ? 0.7 : 1, cursor: pending ? 'not-allowed' : 'pointer' }}
            >
              {pending ? 'Negando…' : 'Confirmar negação'}
            </button>
            <button
              onClick={() => { setModo('idle'); setObsNegacao(''); setErro(null) }}
              disabled={pending}
              style={{ ...getAdminButtonStyle('neutral', 'soft', { height: 34, padding: '0 14px', fontSize: 12, fontWeight: 600, borderRadius: 7 }), opacity: pending ? 0.7 : 1 }}
            >
              Voltar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
