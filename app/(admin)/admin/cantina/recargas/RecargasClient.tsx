'use client'

import { useState, useTransition } from 'react'
import { estornarRecargaAdminAction, cancelarRecargaAdminAction } from '@/app/actions/admin'

interface Recarga {
  id: string
  status: string
  metodo: string
  valor: number
  created_at: string
  confirmada_em: string | null
  cancelada_em: string | null
  estornada_em: string | null
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

const STATUS_CONFIG: Record<string, { label: string; cor: string; bg: string }> = {
  aguardando: { label: 'Aguardando',  cor: '#92400e', bg: '#fef3c7' },
  confirmada: { label: 'Confirmada',  cor: '#065f46', bg: '#d1fae5' },
  expirada:   { label: 'Expirada',    cor: '#6b7280', bg: '#f3f4f6' },
  cancelada:  { label: 'Cancelada',   cor: '#6b7280', bg: '#f3f4f6' },
  estornada:  { label: 'Estornada',   cor: '#7c3aed', bg: '#ede9fe' },
  falhou:     { label: 'Falhou',      cor: '#991b1b', bg: '#fee2e2' },
}

function BadgeStatus({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.falhou
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px',
      borderRadius: 99, fontSize: 11, fontWeight: 700,
      color: cfg.cor, background: cfg.bg,
    }}>
      {cfg.label}
    </span>
  )
}

function RecargaRow({ recarga, onAtualizar }: { recarga: Recarga; onAtualizar: () => void }) {
  const [pending, startTransition] = useTransition()
  const [acao, setAcao] = useState<'estornar' | 'cancelar' | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  function confirmar(tipo: 'estornar' | 'cancelar') {
    setErro(null)
    setAcao(tipo)
  }

  function executar() {
    startTransition(async () => {
      const res = acao === 'estornar'
        ? await estornarRecargaAdminAction(recarga.id)
        : await cancelarRecargaAdminAction(recarga.id)

      if ('error' in res) {
        setErro(res.error)
        setAcao(null)
      } else {
        setAcao(null)
        onAtualizar()
      }
    })
  }

  const podeEstornar = recarga.status === 'confirmada'
  const podeCancelar = recarga.status === 'aguardando'

  return (
    <div style={{
      padding: '14px 16px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Info */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>
            {recarga.aluno_nome}
            <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 6 }}>
              {recarga.aluno_serie}
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            {fmtData(recarga.created_at)} · {recarga.metodo === 'cartao' ? '💳 Cartão' : '⚡ PIX'}
          </div>
        </div>

        {/* Valor + status */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#34d399' }}>
            {fmtMoeda(recarga.valor)}
          </div>
          <div style={{ marginTop: 4 }}>
            <BadgeStatus status={recarga.status} />
          </div>
        </div>

        {/* Ações */}
        {(podeEstornar || podeCancelar) && !acao && (
          <div style={{ display: 'flex', gap: 6 }}>
            {podeEstornar && (
              <button
                onClick={() => confirmar('estornar')}
                style={{
                  padding: '6px 12px', borderRadius: 8,
                  background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)',
                  color: '#a78bfa', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Estornar
              </button>
            )}
            {podeCancelar && (
              <button
                onClick={() => confirmar('cancelar')}
                style={{
                  padding: '6px 12px', borderRadius: 8,
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                  color: '#f87171', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Confirmação inline */}
      {acao && (
        <div style={{
          marginTop: 10, padding: '12px 14px',
          background: acao === 'estornar' ? 'rgba(124,58,237,0.1)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${acao === 'estornar' ? 'rgba(124,58,237,0.25)' : 'rgba(239,68,68,0.2)'}`,
          borderRadius: 8,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', marginBottom: 8 }}>
            {acao === 'estornar'
              ? `Estornar ${fmtMoeda(recarga.valor)} de ${recarga.aluno_nome.split(' ')[0]}? O saldo será debitado (pode ficar negativo).`
              : `Cancelar recarga de ${fmtMoeda(recarga.valor)}? O pagamento será cancelado no Asaas.`
            }
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={executar}
              disabled={pending}
              style={{
                padding: '7px 16px', borderRadius: 7,
                background: acao === 'estornar' ? '#7c3aed' : '#dc2626',
                color: '#fff', border: 'none',
                fontSize: 12, fontWeight: 700,
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
                padding: '7px 14px', borderRadius: 7,
                background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Voltar
            </button>
          </div>
          {erro && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#f87171', fontWeight: 600 }}>
              ❌ {erro}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function RecargasClient({ recargas: inicial }: { recargas: Recarga[] }) {
  const [recargas, setRecargas] = useState(inicial)
  const [filtro, setFiltro] = useState<string>('todas')

  const filtradas = filtro === 'todas'
    ? recargas
    : recargas.filter(r => r.status === filtro)

  function atualizarRecarga(id: string, novoStatus: string) {
    setRecargas(prev => prev.map(r =>
      r.id === id ? { ...r, status: novoStatus } : r
    ))
  }

  const FILTROS = [
    { value: 'todas',     label: 'Todas' },
    { value: 'aguardando', label: 'Aguardando' },
    { value: 'confirmada', label: 'Confirmadas' },
    { value: 'estornada',  label: 'Estornadas' },
    { value: 'cancelada',  label: 'Canceladas' },
  ]

  return (
    <div>
      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTROS.map(f => (
          <button
            key={f.value}
            onClick={() => setFiltro(f.value)}
            style={{
              padding: '6px 14px', borderRadius: 99,
              background: filtro === f.value ? 'var(--brand)' : 'rgba(255,255,255,0.05)',
              border: filtro === f.value ? 'none' : '1px solid rgba(255,255,255,0.1)',
              color: filtro === f.value ? '#fff' : '#94a3b8',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div style={{
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 'var(--r-xl)', overflow: 'hidden',
      }}>
        {filtradas.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
            Nenhuma recarga encontrada.
          </div>
        ) : (
          filtradas.map(r => (
            <RecargaRow
              key={r.id}
              recarga={r}
              onAtualizar={() => atualizarRecarga(r.id, r.status === 'confirmada' ? 'estornada' : 'cancelada')}
            />
          ))
        )}
      </div>
    </div>
  )
}
