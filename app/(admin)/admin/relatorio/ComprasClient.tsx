'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Produto } from '@/types/database'
import {
  COLUNAS_COMPRAS, filtrarCompras, resumoCompras, montarCsvCompras,
  formatarDataHora, formatarValor,
  type ColunaKey, type CompraRow, type FiltrosCompras, type StatusFiltro,
} from '@/lib/relatorio/compras'

const COLUNAS_PADRAO: ColunaKey[] = [
  'aluno_nome', 'aluno_serie', 'aluno_turma', 'responsavel_nome', 'responsavel_email',
]

const STATUS_OPCOES: Array<{ value: StatusFiltro; label: string }> = [
  { value: 'pago', label: 'Pagos' },
  { value: 'pendente', label: 'Pendentes' },
  { value: 'cancelado', label: 'Cancelados' },
  { value: 'todos', label: 'Todos' },
]

interface Props {
  produtos: Produto[]
  produtoSelecionado: Produto | null
  compras: CompraRow[]
}

export function ComprasClient({ produtos, produtoSelecionado, compras }: Props) {
  const router = useRouter()
  const [filtros, setFiltros] = useState<FiltrosCompras>({
    serie: null, turma: null, status: 'pago', incluirEstornados: false,
  })
  const [colunas, setColunas] = useState<ColunaKey[]>(COLUNAS_PADRAO)

  const series = useMemo(
    () => [...new Set(compras.map(c => c.aluno_serie).filter((s): s is string => !!s))].sort(),
    [compras],
  )
  const turmas = useMemo(
    () => [...new Set(compras.map(c => c.aluno_turma).filter((t): t is string => !!t))].sort(),
    [compras],
  )

  const visiveis = useMemo(() => filtrarCompras(compras, filtros), [compras, filtros])
  const { qtd, total } = resumoCompras(visiveis)
  const colunasAtivas = COLUNAS_COMPRAS.filter(c => colunas.includes(c.key))

  function toggleColuna(key: ColunaKey) {
    setColunas(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  function exportarCSV() {
    const nome = produtoSelecionado?.nome ?? 'relatorio'
    const csv = montarCsvCompras(visiveis, colunas)
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `compras_${nome.toLowerCase().replace(/\s+/g, '_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function celulaTabela(row: CompraRow, key: ColunaKey): string {
    if (key === 'data_pagamento') return formatarDataHora(row.data_pagamento)
    if (key === 'preco_unitario') return `R$ ${formatarValor(row.preco_unitario)}`
    return String(row[key] ?? '—')
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--text-1)', margin: '0 0 6px', letterSpacing: '-.03em' }}>
            🛒 Relatório de Compras
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0, fontWeight: 500 }}>
            Quem comprou cada produto, com filtros e colunas configuráveis.
          </p>
        </div>
        {visiveis.length > 0 && (
          <button
            onClick={exportarCSV}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', borderRadius: 10,
              background: 'var(--surface-2)', color: 'var(--text-1)',
              border: '1px solid var(--border)', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
            }}
          >
            ⬇️ Exportar CSV
          </button>
        )}
      </div>

      {produtos.length === 0 ? (
        <div style={{
          background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.25)',
          borderRadius: 12, padding: '16px 20px', fontSize: 14, color: '#b45309', fontWeight: 600,
        }}>
          ⚠️ Nenhum produto encontrado.
        </div>
      ) : (
        <>
          {/* Seletor de produto */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-3)', marginBottom: 8, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              Produto
            </label>
            <select
              value={produtoSelecionado?.id ?? ''}
              onChange={e => router.push(`/admin/relatorio?tab=compras&produto=${e.target.value}`)}
              style={{
                width: '100%', maxWidth: 480, padding: '10px 14px',
                borderRadius: 10, border: '1px solid var(--border)',
                fontSize: 14, fontWeight: 600, color: 'var(--text-1)',
                background: 'var(--surface-2)', appearance: 'none', cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {produtos.map(p => (
                <option key={p.id} value={p.id} style={{ color: '#000' }}>
                  {p.icon ?? '📦'} {p.nome}
                  {p.data_evento ? ` — ${new Date(p.data_evento).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
            <Filtro label="Série">
              <select value={filtros.serie ?? ''} onChange={e => setFiltros(f => ({ ...f, serie: e.target.value || null }))} style={selectStyle}>
                <option value="">Todas</option>
                {series.map(s => <option key={s} value={s} style={{ color: '#000' }}>{s}</option>)}
              </select>
            </Filtro>
            <Filtro label="Turma">
              <select value={filtros.turma ?? ''} onChange={e => setFiltros(f => ({ ...f, turma: e.target.value || null }))} style={selectStyle}>
                <option value="">Todas</option>
                {turmas.map(t => <option key={t} value={t} style={{ color: '#000' }}>{t}</option>)}
              </select>
            </Filtro>
            <Filtro label="Status">
              <select value={filtros.status} onChange={e => setFiltros(f => ({ ...f, status: e.target.value as StatusFiltro }))} style={selectStyle}>
                {STATUS_OPCOES.map(o => <option key={o.value} value={o.value} style={{ color: '#000' }}>{o.label}</option>)}
              </select>
            </Filtro>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-2)', paddingBottom: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filtros.incluirEstornados}
                onChange={e => setFiltros(f => ({ ...f, incluirEstornados: e.target.checked }))}
              />
              Incluir estornados
            </label>
          </div>

          {/* Seletor de colunas */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-3)', marginBottom: 8, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              Colunas do relatório
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COLUNAS_COMPRAS.map(c => {
                const ativa = colunas.includes(c.key)
                return (
                  <button
                    key={c.key}
                    onClick={() => toggleColuna(c.key)}
                    style={{
                      padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                      cursor: 'pointer',
                      background: ativa ? 'rgba(16,185,129,.12)' : 'var(--surface-2)',
                      color: ativa ? '#059669' : 'var(--text-3)',
                      border: ativa ? '1px solid rgba(16,185,129,.35)' : '1px solid var(--border)',
                    }}
                  >
                    {ativa ? '✓ ' : ''}{c.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Resumo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
            <ResumoCard valor={String(qtd)} label="Compras" emoji="🛒" />
            <ResumoCard valor={`R$ ${formatarValor(total)}`} label="Valor total" emoji="💰" />
          </div>

          {/* Tabela / vazio */}
          {visiveis.length === 0 ? (
            <div style={{
              background: 'var(--surface)', border: '1.5px dashed var(--border)',
              borderRadius: 16, padding: '60px 20px', textAlign: 'center',
              fontSize: 14, color: 'var(--text-3)',
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              Nenhuma compra encontrada com os filtros atuais.
            </div>
          ) : (
            <div style={{
              background: 'var(--surface)', border: '1.5px solid var(--border)',
              borderRadius: 16, overflowX: 'auto', backdropFilter: 'blur(16px)',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)' }}>
                    {colunasAtivas.map(c => (
                      <th key={c.key} style={{
                        padding: '10px 12px', textAlign: 'left',
                        fontSize: 10, fontWeight: 800, color: 'var(--text-3)',
                        letterSpacing: '.08em', textTransform: 'uppercase',
                        borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                      }}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map(row => (
                    <tr key={row.item_id} style={{ borderBottom: '1px solid var(--border)' }}>
                      {colunasAtivas.map(c => (
                        <td key={c.key} style={{
                          padding: '10px 12px', color: 'var(--text-2)', fontWeight: 500,
                          whiteSpace: 'nowrap',
                          textDecoration: row.estornado ? 'line-through' : 'none',
                        }}>
                          {celulaTabela(row, c.key)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)',
  fontSize: 13, fontWeight: 600, color: 'var(--text-1)',
  background: 'var(--surface-2)', appearance: 'none', cursor: 'pointer',
  fontFamily: 'inherit', minWidth: 120,
}

function Filtro({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-3)', marginBottom: 6, letterSpacing: '.08em', textTransform: 'uppercase' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function ResumoCard({ valor, label, emoji }: { valor: string; label: string; emoji: string }) {
  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '16px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    }}>
      <div style={{ fontSize: 24 }}>{emoji}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-1)' }}>{valor}</div>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-3)' }}>{label.toUpperCase()}</div>
    </div>
  )
}
