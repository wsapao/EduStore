'use client'

import { useState, useTransition } from 'react'
import { aprovarEstornoAction, negarEstornoAction } from '@/app/actions/admin'

interface Solicitacao {
  id: string
  motivo: string
  created_at: string
  recarga_id: string
  valor: number
  metodo: string
  gateway_id: string | null
  aluno_nome: string
  aluno_serie: string
}

function fmtMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function SolicitacaoCard({ sol, onDecidido }: { sol: Solicitacao; onDecidido: (id: string) => void }) {
  const [pending, startTransition] = useTransition()
  const [acao, setAcao] = useState<'aprovar' | 'negar' | null>(null)
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  function executar() {
    setErro(null)
    if (acao === 'negar' && !observacao.trim()) {
      setErro('Informe o motivo da negação para o responsável.')
      return
    }
    startTransition(async () => {
      const res = acao === 'aprovar'
        ? await aprovarEstornoAction(sol.id)
        : await negarEstornoAction(sol.id, observacao.trim())

      if ('error' in res) {
        setErro(res.error)
      } else {
        onDecidido(sol.id)
      }
    })
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: '16px',
    }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>
            {sol.aluno_nome}
            <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 6 }}>{sol.aluno_serie}</span>
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
            Solicitado em {fmtData(sol.created_at)} · {sol.metodo === 'cartao' ? '💳 Cartão' : '⚡ PIX'}
          </div>
        </div>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#f59e0b' }}>
          {fmtMoeda(sol.valor)}
        </div>
      </div>

      {/* Motivo */}
      <div style={{
        marginTop: 10, padding: '10px 12px',
        background: 'rgba(255,255,255,0.04)', borderRadius: 8,
        fontSize: 13, color: '#cbd5e1', fontStyle: 'italic',
        borderLeft: '3px solid #f59e0b',
      }}>
        "{sol.motivo}"
      </div>

      {/* Ações */}
      {!acao ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={() => setAcao('aprovar')}
            style={{
              flex: 1, padding: '9px',
              background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
              color: '#34d399', borderRadius: 8,
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            ✅ Aprovar estorno
          </button>
          <button
            onClick={() => setAcao('negar')}
            style={{
              flex: 1, padding: '9px',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              color: '#f87171', borderRadius: 8,
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            ❌ Negar
          </button>
        </div>
      ) : (
        <div style={{
          marginTop: 12, padding: '12px',
          background: acao === 'aprovar' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${acao === 'aprovar' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
          borderRadius: 8,
        }}>
          {acao === 'aprovar' ? (
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 10 }}>
              Ao aprovar, o estorno de <strong style={{ color: '#34d399' }}>{fmtMoeda(sol.valor)}</strong> será
              solicitado ao Asaas. O saldo será debitado quando o Asaas confirmar.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>
                Informe ao responsável o motivo da negação:
              </div>
              <textarea
                placeholder="Ex: Prazo de estorno expirado, recarga já utilizada..."
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
                rows={2}
                style={{
                  width: '100%', padding: '8px 10px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6, color: '#f1f5f9',
                  fontSize: 12, resize: 'vertical',
                  fontFamily: 'inherit', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </>
          )}
          {erro && (
            <div style={{ fontSize: 12, color: '#f87171', fontWeight: 600, marginTop: 6 }}>
              ❌ {erro}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              onClick={executar}
              disabled={pending}
              style={{
                flex: 1, padding: '8px',
                background: acao === 'aprovar' ? '#10b981' : '#dc2626',
                color: '#fff', border: 'none', borderRadius: 7,
                fontSize: 13, fontWeight: 700,
                cursor: pending ? 'not-allowed' : 'pointer',
                opacity: pending ? 0.7 : 1,
              }}
            >
              {pending ? 'Processando…' : 'Confirmar'}
            </button>
            <button
              onClick={() => { setAcao(null); setErro(null) }}
              disabled={pending}
              style={{
                padding: '8px 14px', background: 'transparent',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8', borderRadius: 7,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Voltar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function SolicitacoesClient({ solicitacoes: inicial }: { solicitacoes: Solicitacao[] }) {
  const [solicitacoes, setSolicitacoes] = useState(inicial)

  function remover(id: string) {
    setSolicitacoes(prev => prev.filter(s => s.id !== id))
  }

  if (solicitacoes.length === 0) {
    return (
      <div style={{
        padding: '32px', textAlign: 'center',
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12, color: '#94a3b8', fontSize: 13,
      }}>
        Nenhuma solicitação pendente.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {solicitacoes.map(s => (
        <SolicitacaoCard key={s.id} sol={s} onDecidido={remover} />
      ))}
    </div>
  )
}
