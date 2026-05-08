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
  motivo_falha: string | null
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

// Badges adaptados para UI escura: fundo semitransparente + borda colorida
const STATUS_CONFIG: Record<string, { label: string; cor: string; bg: string; border: string }> = {
  aguardando:       { label: 'Aguardando',          cor: '#fbbf24', bg: 'rgba(245,158,11,0.12)',   border: 'rgba(245,158,11,0.3)' },
  confirmada:       { label: 'Confirmada',           cor: '#34d399', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.28)' },
  expirada:         { label: 'Expirada',             cor: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.18)' },
  cancelada:        { label: 'Cancelada',            cor: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.18)' },
  estornada:        { label: 'Estornada',            cor: '#a78bfa', bg: 'rgba(124,58,237,0.15)',  border: 'rgba(124,58,237,0.32)' },
  estorno_aprovado: { label: 'Estorno em andamento', cor: '#fbbf24', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)' },
  falhou:           { label: 'Falhou',               cor: '#f87171', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.28)' },
}

function BadgeStatus({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.falhou
  return (
    <span style={{
      display: 'inline-block', padding: '3px 9px',
      borderRadius: 99, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
      color: cfg.cor, background: cfg.bg, border: `1px solid ${cfg.border}`,
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
      padding: '13px 16px',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      {/* Linha principal: info à esq · preço + badge + ação à dir (todos alinhados) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>

        {/* Info: nome + data */}
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.3 }}>
            {recarga.aluno_nome}
            <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 6, fontSize: 12 }}>
              {recarga.aluno_serie}
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
            {fmtData(recarga.created_at)}
            <span style={{ margin: '0 5px', opacity: 0.4 }}>·</span>
            {recarga.metodo === 'cartao' ? '💳 Cartão' : '⚡ PIX'}
          </div>
        </div>

        {/* Direita: preço + badge + botão — todos na mesma linha horizontal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#34d399', letterSpacing: '-0.01em' }}>
            {fmtMoeda(recarga.valor)}
          </span>

          <BadgeStatus status={recarga.status} />

          {(podeEstornar || podeCancelar) && !acao && (
            <div style={{ display: 'flex', gap: 6 }}>
              {podeEstornar && (
                <button
                  onClick={() => confirmar('estornar')}
                  style={{
                    padding: '5px 12px', borderRadius: 7,
                    background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.32)',
                    color: '#a78bfa', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  Estornar
                </button>
              )}
              {podeCancelar && (
                <button
                  onClick={() => confirmar('cancelar')}
                  style={{
                    padding: '5px 12px', borderRadius: 7,
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.28)',
                    color: '#f87171', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Motivo da falha */}
      {recarga.status === 'falhou' && recarga.motivo_falha && (
        <div style={{
          marginTop: 8, padding: '8px 10px',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)',
          borderRadius: 6, fontSize: 11, color: '#fca5a5',
        }}>
          <span style={{ fontWeight: 700, marginRight: 4 }}>Motivo:</span>
          {recarga.motivo_falha}
        </div>
      )}

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
    { value: 'todas',      label: 'Todas' },
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
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
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
