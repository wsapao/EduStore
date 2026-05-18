'use client'

import { useState, useTransition } from 'react'
import { estornarRecargaAdminAction, cancelarRecargaAdminAction } from '@/app/actions/admin'
import {
  getAdminButtonStyle,
  getAdminPillStyle,
  getAdminTone,
} from '@/lib/admin-ui-tones'
import {
  formatGatewayId,
  getRecargaMetodoMeta,
  getRecargaPrimaryEvent,
  getRecargaStatusMeta,
} from '@/lib/cantina/recargas'

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

function BadgeStatus({ status }: { status: string }) {
  const meta = getRecargaStatusMeta(status)
  return (
    <span style={getAdminPillStyle(meta.tone, { fontSize: 11, fontWeight: 800, padding: '5px 11px' })}>{meta.label}</span>
  )
}

function getInitials(nome: string) {
  const parts = nome.trim().split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'AL'
}

function DetailCard({
  label,
  value,
  tone = 'muted',
}: {
  label: string
  value: string
  tone?: 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'neutral' | 'violet'
}) {
  const cfg = getAdminTone(tone)

  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: 14,
      background: tone === 'muted' ? 'var(--surface-2)' : cfg.bg,
      border: `1px solid ${tone === 'muted' ? 'var(--border)' : cfg.border}`,
      minWidth: 0,
    }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: tone === 'muted' ? 'var(--text-3)' : cfg.text, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value}
      </div>
    </div>
  )
}

function RecargaRow({ recarga, onAtualizar }: { recarga: Recarga; onAtualizar: (novoStatus: string) => void }) {
  const [pending, startTransition] = useTransition()
  const [acao, setAcao] = useState<'estornar' | 'cancelar' | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const metodoMeta = getRecargaMetodoMeta(recarga.metodo)
  const primaryEvent = getRecargaPrimaryEvent(recarga)
  const statusMeta = getRecargaStatusMeta(recarga.status)
  const amountTone = recarga.status === 'confirmada'
    ? getAdminTone('success')
    : recarga.status === 'estornada'
      ? getAdminTone('violet')
      : recarga.status === 'falhou'
        ? getAdminTone('danger')
        : recarga.status === 'cancelada' || recarga.status === 'expirada'
          ? getAdminTone('neutral')
          : getAdminTone('accent')
  const secondaryCard = primaryEvent.label === 'Solicitada em'
    ? {
      label: 'Status atual',
      value: statusMeta.label,
      tone: statusMeta.tone,
    }
    : {
      label: primaryEvent.label,
      value: fmtData(primaryEvent.value),
      tone: 'neutral' as const,
    }

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
        onAtualizar(acao === 'estornar' ? 'estornada' : 'cancelada')
      }
    })
  }

  const podeEstornar = recarga.status === 'confirmada'
  const podeCancelar = recarga.status === 'aguardando'

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid rgba(249,115,22,.14)',
      borderRadius: 24,
      padding: '18px',
      boxShadow: '0 16px 28px rgba(249,115,22,.08)',
    }}>
      <div className="recarga-row-shell" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 14, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #f97316, #fb923c)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 900,
              boxShadow: '0 12px 22px rgba(249,115,22,.2)',
              flexShrink: 0,
            }}>
              {getInitials(recarga.aluno_nome)}
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {recarga.aluno_nome}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                <span style={getAdminPillStyle('neutral', { fontSize: 11, fontWeight: 700, padding: '4px 10px' })}>
                  {recarga.aluno_serie || 'Série não informada'}
                </span>
              </div>
            </div>
          </div>

          <div className="recarga-meta-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
            <DetailCard label="Solicitada em" value={fmtData(recarga.created_at)} />
            <DetailCard label="Método" value={`${metodoMeta.icon} ${metodoMeta.label}`} tone={metodoMeta.tone as 'warning' | 'info'} />
            <DetailCard label={secondaryCard.label} value={secondaryCard.value} tone={secondaryCard.tone} />
            <DetailCard label="Gateway" value={formatGatewayId(recarga.gateway_id)} />
          </div>
        </div>

        <div className="recarga-row-side" style={{ display: 'grid', gap: 10, justifyItems: 'end', minWidth: 190 }}>
          <div style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
              Valor da recarga
            </span>
            <span style={{ fontSize: 28, fontWeight: 900, color: amountTone.text, letterSpacing: '-.04em', lineHeight: 1 }}>
              {fmtMoeda(recarga.valor)}
            </span>
          </div>
          <BadgeStatus status={recarga.status} />

          {(podeEstornar || podeCancelar) && !acao && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {podeEstornar && (
                <button
                  onClick={() => confirmar('estornar')}
                  style={getAdminButtonStyle('violet', 'soft', { height: 38, padding: '0 14px', fontSize: 12, fontWeight: 800 })}
                >
                  Estornar
                </button>
              )}
              {podeCancelar && (
                <button
                  onClick={() => confirmar('cancelar')}
                  style={getAdminButtonStyle('danger', 'soft', { height: 38, padding: '0 14px', fontSize: 12, fontWeight: 800 })}
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
          marginTop: 12,
          padding: '12px 14px',
          background: '#fff5f5',
          border: `1px solid ${getAdminTone('danger').border}`,
          borderRadius: 14,
          fontSize: 12,
          color: '#b91c1c',
        }}>
          <span style={{ fontWeight: 700, marginRight: 4 }}>Motivo:</span>
          {recarga.motivo_falha}
        </div>
      )}

      {/* Confirmação inline */}
      {acao && (
        <div style={{
          marginTop: 14,
          padding: '14px 16px',
          background: acao === 'estornar' ? getAdminTone('violet').bg : '#fff5f5',
          border: `1px solid ${acao === 'estornar' ? getAdminTone('violet').border : getAdminTone('danger').border}`,
          borderRadius: 16,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 10, lineHeight: 1.5 }}>
            {acao === 'estornar'
              ? `Estornar ${fmtMoeda(recarga.valor)} de ${recarga.aluno_nome.split(' ')[0]}? O saldo será debitado (pode ficar negativo).`
              : `Cancelar recarga de ${fmtMoeda(recarga.valor)}? O pagamento será cancelado no Asaas.`
            }
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={executar}
              disabled={pending}
              style={{
                ...getAdminButtonStyle(acao === 'estornar' ? 'violet' : 'danger', 'solid', {
                  height: 38,
                  padding: '0 16px',
                  fontSize: 12,
                  fontWeight: 800,
                }),
                opacity: pending ? 0.7 : 1,
                cursor: pending ? 'not-allowed' : 'pointer',
              }}
            >
              {pending ? 'Processando…' : 'Confirmar'}
            </button>
            <button
              onClick={() => { setAcao(null); setErro(null) }}
              disabled={pending}
              style={getAdminButtonStyle('neutral', 'soft', { height: 38, padding: '0 14px', fontSize: 12, fontWeight: 700 })}
            >
              Voltar
            </button>
          </div>
          {erro && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#b91c1c', fontWeight: 700 }}>
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
            style={filtro === f.value
              ? getAdminButtonStyle('accent', 'solid', { height: 44, padding: '0 16px', borderRadius: 999, fontSize: 12, fontWeight: 800 })
              : getAdminButtonStyle('neutral', 'soft', { height: 44, padding: '0 16px', borderRadius: 999, fontSize: 12, fontWeight: 800 })}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div style={{
        display: 'grid',
        gap: 12,
      }}>
        {filtradas.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: 'var(--text-3)',
            fontSize: 13,
            background: '#ffffff',
            border: '1px solid rgba(249,115,22,.14)',
            borderRadius: 24,
            boxShadow: '0 16px 28px rgba(249,115,22,.08)',
          }}>
            Nenhuma recarga encontrada.
          </div>
        ) : (
          filtradas.map(r => (
            <RecargaRow
              key={r.id}
              recarga={r}
              onAtualizar={(novoStatus) => atualizarRecarga(r.id, novoStatus)}
            />
          ))
        )}
      </div>

      <style>{`
        @media (max-width: 980px) {
          .recarga-row-shell {
            grid-template-columns: 1fr !important;
          }

          .recarga-row-side {
            justify-items: start !important;
            min-width: 0 !important;
          }

          .recarga-meta-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 640px) {
          .recarga-meta-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
