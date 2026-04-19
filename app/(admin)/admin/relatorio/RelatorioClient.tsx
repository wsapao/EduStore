'use client'

import { useRouter } from 'next/navigation'
import type { Produto } from '@/types/database'
import type { RelatorioRow } from './page'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  emitido:   { label: 'Ausente',   color: '#1d4ed8', bg: '#eff6ff', dot: '#60a5fa' },
  usado:     { label: 'Presente',  color: '#065f46', bg: '#f0fdf4', dot: '#22c55e' },
  cancelado: { label: 'Cancelado', color: '#6b7280', bg: '#f3f4f6', dot: '#9ca3af' },
  expirado:  { label: 'Expirado',  color: '#92400e', bg: '#fef3c7', dot: '#f59e0b' },
}

function fmtDataHora(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

interface Props {
  produtos: Produto[]
  produtoSelecionado: Produto | null
  relatorio: RelatorioRow[]
}

export function RelatorioClient({ produtos, produtoSelecionado, relatorio }: Props) {
  const router = useRouter()

  const presentes = relatorio.filter(r => r.status === 'usado').length
  const ausentes  = relatorio.filter(r => r.status === 'emitido').length
  const total     = relatorio.length

  function exportarCSV() {
    const nome = produtoSelecionado?.nome ?? 'relatorio'
    const header = 'Aluno,Série,Turma,Responsável,Email,Status,Validado em,Validado por,Token\n'
    const rows = relatorio.map(r => [
      `"${r.aluno_nome}"`,
      `"${r.aluno_serie}"`,
      `"${r.aluno_turma ?? ''}"`,
      `"${r.responsavel_nome}"`,
      `"${r.responsavel_email}"`,
      `"${STATUS_CONFIG[r.status]?.label ?? r.status}"`,
      `"${fmtDataHora(r.usado_em)}"`,
      `"${r.validado_por ?? ''}"`,
      `"${r.token}"`,
    ].join(','))

    const csv = header + rows.join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `presenca_${nome.toLowerCase().replace(/\s+/g, '_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', margin: '0 0 4px', letterSpacing: '-.03em' }}>
            📋 Relatório de Presença
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            Histórico de check-in por evento.
          </p>
        </div>
        {relatorio.length > 0 && (
          <button
            onClick={exportarCSV}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', borderRadius: 10,
              background: '#0f172a', color: '#fff',
              border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            ⬇️ Exportar CSV
          </button>
        )}
      </div>

      {/* Seletor de evento */}
      {produtos.length === 0 ? (
        <div style={{
          background: '#fef3c7', border: '1px solid #fcd34d',
          borderRadius: 12, padding: '16px 20px',
          fontSize: 14, color: '#92400e',
        }}>
          ⚠️ Nenhum produto com ingresso encontrado.
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6, letterSpacing: '.04em' }}>
              EVENTO
            </label>
            <select
              value={produtoSelecionado?.id ?? ''}
              onChange={e => router.push(`/admin/relatorio?produto=${e.target.value}`)}
              style={{
                width: '100%', maxWidth: 480, padding: '10px 14px',
                borderRadius: 10, border: '1.5px solid #e2e8f0',
                fontSize: 14, fontWeight: 600, color: '#0f172a',
                background: '#fff', appearance: 'none', cursor: 'pointer',
              }}
            >
              {produtos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.icon ?? '🎟️'} {p.nome}
                  {p.data_evento ? ` — ${new Date(p.data_evento).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Cards de resumo */}
          {relatorio.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
              <ResumoCard valor={presentes} label="Presentes" color="#16a34a" bg="#f0fdf4" border="#86efac" emoji="✅" />
              <ResumoCard valor={ausentes}  label="Ausentes"  color="#2563eb" bg="#eff6ff" border="#93c5fd" emoji="⏳" />
              <ResumoCard valor={total}     label="Total"     color="#0f172a" bg="#f8fafc" border="#e2e8f0" emoji="🎟️" />
            </div>
          )}

          {/* Tabela */}
          {relatorio.length === 0 ? (
            <div style={{
              background: '#f8fafc', border: '1.5px solid #e2e8f0',
              borderRadius: 12, padding: '60px 20px', textAlign: 'center',
              fontSize: 14, color: '#94a3b8',
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              Nenhum ingresso emitido para este evento ainda.
            </div>
          ) : (
            <div style={{
              background: '#fff', border: '1.5px solid #e2e8f0',
              borderRadius: 16, overflow: 'hidden',
            }}>
              {/* Header da tabela */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1.5fr 1fr 1.5fr',
                padding: '10px 16px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                fontSize: 10, fontWeight: 700, color: '#94a3b8',
                letterSpacing: '.06em', textTransform: 'uppercase',
                gap: 8,
              }}>
                <span>Aluno</span>
                <span>Status</span>
                <span>Responsável</span>
                <span>Validado em</span>
                <span style={{ fontFamily: 'monospace' }}>Token</span>
              </div>

              {/* Linhas */}
              {relatorio.map((row, idx) => {
                const cfg = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.emitido
                return (
                  <div
                    key={row.ingresso_id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1.5fr 1fr 1.5fr',
                      padding: '12px 16px',
                      borderBottom: idx < relatorio.length - 1 ? '1px solid #f1f5f9' : 'none',
                      alignItems: 'center',
                      gap: 8,
                      background: row.status === 'usado' ? 'rgba(240,253,244,.4)' : '#fff',
                    }}
                  >
                    {/* Aluno */}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{row.aluno_nome}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        {row.aluno_serie}{row.aluno_turma ? ` · T.${row.aluno_turma}` : ''}
                      </div>
                    </div>

                    {/* Status */}
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 9px', borderRadius: 999,
                      background: cfg.bg, color: cfg.color,
                      fontSize: 11, fontWeight: 700, width: 'fit-content',
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                      {cfg.label}
                    </span>

                    {/* Responsável */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{row.responsavel_nome}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{row.responsavel_email}</div>
                    </div>

                    {/* Validado em */}
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      {row.usado_em ? fmtDataHora(row.usado_em) : '—'}
                      {row.validado_por && (
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{row.validado_por}</div>
                      )}
                    </div>

                    {/* Token */}
                    <span style={{
                      fontFamily: 'monospace', fontSize: 10, color: '#94a3b8',
                      letterSpacing: '.04em',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {row.token.replace(/-/g, '').slice(-12).toUpperCase()}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ResumoCard({ valor, label, color, bg, border, emoji }: {
  valor: number; label: string; color: string; bg: string; border: string; emoji: string
}) {
  return (
    <div style={{
      background: bg, border: `1px solid ${border}`,
      borderRadius: 14, padding: '16px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    }}>
      <div style={{ fontSize: 24 }}>{emoji}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color }}>{valor}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color, opacity: .8 }}>{label.toUpperCase()}</div>
    </div>
  )
}
