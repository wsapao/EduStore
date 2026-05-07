'use client'

import { useState, useTransition } from 'react'
import { solicitarEstornoParcialAction } from '@/app/actions/orders'

interface ItemEstorno {
  id: string
  produto_nome: string
  aluno_nome: string
  variante: string | null
  preco_unitario: number
  estornado_em: string | null
}

interface EstornoInfo {
  id: string
  status: 'pendente' | 'aprovado' | 'negado'
  motivo: string
  obs_admin: string | null
  valor_total: number
}

interface Props {
  pedidoId: string
  itens: ItemEstorno[]
  estorno: EstornoInfo | null
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function EstornoParcialForm({ pedidoId, itens, estorno }: Props) {
  const [aberto, setAberto] = useState(false)
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const valorTotal = itens
    .filter(i => selecionados.includes(i.id))
    .reduce((s, i) => s + i.preco_unitario, 0)

  function toggleItem(id: string) {
    setSelecionados(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function submeter() {
    if (!selecionados.length) { setErro('Selecione ao menos um item.'); return }
    if (!motivo.trim()) { setErro('Informe o motivo.'); return }
    setErro(null)
    startTransition(async () => {
      const res = await solicitarEstornoParcialAction(pedidoId, selecionados, motivo)
      if ('error' in res) {
        setErro(res.error)
      } else {
        setAberto(false)
        setSelecionados([])
        setMotivo('')
      }
    })
  }

  // Estorno existente
  if (estorno) {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      pendente: { bg: '#fef3c7', text: '#92400e', label: `⏳ Estorno aguardando análise — ${fmtBRL(estorno.valor_total)}` },
      aprovado: { bg: '#d1fae5', text: '#065f46', label: `✅ Estorno aprovado — ${fmtBRL(estorno.valor_total)}` },
      negado:   { bg: '#fee2e2', text: '#991b1b', label: `❌ Estorno negado${estorno.obs_admin ? ` — ${estorno.obs_admin}` : ''}` },
    }
    const cfg = badges[estorno.status]
    if (cfg) {
      return (
        <div style={{ marginTop: 8, padding: '8px 12px', background: cfg.bg, borderRadius: 8, fontSize: 12, color: cfg.text, fontWeight: 600 }}>
          {cfg.label}
        </div>
      )
    }
  }

  const itensDisponiveis = itens.filter(i => !i.estornado_em)
  if (!itensDisponiveis.length) return null

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        style={{
          marginTop: 8, padding: '8px 14px', borderRadius: 8, width: '100%',
          background: 'rgba(239,68,68,0.06)', border: '1.5px solid rgba(239,68,68,0.15)',
          color: '#dc2626', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}
      >
        Solicitar estorno
      </button>
    )
  }

  return (
    <div style={{
      marginTop: 8, padding: '14px', background: '#fafafa',
      border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: 12,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0a1628', marginBottom: 10 }}>
        Selecione os itens para estorno
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {itens.map(item => (
          <label
            key={item.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              cursor: item.estornado_em ? 'default' : 'pointer',
              opacity: item.estornado_em ? 0.45 : 1,
              fontSize: 12, color: '#374151',
            }}
          >
            <input
              type="checkbox"
              checked={selecionados.includes(item.id)}
              disabled={!!item.estornado_em}
              onChange={() => toggleItem(item.id)}
            />
            <span style={{ flex: 1 }}>
              {item.produto_nome} — {item.aluno_nome}
              {item.variante ? ` (${item.variante})` : ''}
              {item.estornado_em ? ' · Já estornado' : ''}
            </span>
            <span style={{ fontWeight: 700 }}>{fmtBRL(item.preco_unitario)}</span>
          </label>
        ))}
      </div>

      {selecionados.length > 0 && (
        <div style={{ fontSize: 12, fontWeight: 800, color: '#0a1628', marginBottom: 8 }}>
          Total a reembolsar: {fmtBRL(valorTotal)}
        </div>
      )}

      <textarea
        placeholder="Motivo do estorno (obrigatório)"
        value={motivo}
        onChange={e => setMotivo(e.target.value)}
        rows={2}
        style={{
          width: '100%', borderRadius: 8, border: '1.5px solid rgba(0,0,0,0.1)',
          padding: '8px', fontSize: 12, fontFamily: 'inherit',
          boxSizing: 'border-box', resize: 'vertical', marginBottom: 8,
        }}
      />

      {erro && (
        <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 8 }}>{erro}</div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={submeter}
          disabled={pending}
          style={{
            flex: 1, padding: '9px', borderRadius: 8,
            background: '#ef4444', color: '#fff', border: 'none',
            fontSize: 12, fontWeight: 700,
            cursor: pending ? 'not-allowed' : 'pointer',
            opacity: pending ? 0.7 : 1,
          }}
        >
          {pending ? 'Enviando…' : 'Enviar solicitação'}
        </button>
        <button
          onClick={() => { setAberto(false); setSelecionados([]); setMotivo(''); setErro(null) }}
          disabled={pending}
          style={{
            padding: '9px 14px', borderRadius: 8,
            background: 'transparent', border: '1.5px solid rgba(0,0,0,0.1)',
            color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
