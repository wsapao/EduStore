'use client'

import { useState, useTransition } from 'react'
import { criarVoucherAction, toggleVoucherAction, excluirVoucherAction } from '@/app/actions/admin'
import type { Voucher } from '@/types/database'

export function VoucherManager({ vouchers }: { vouchers: Voucher[] }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    
    startTransition(async () => {
      const res = await criarVoucherAction(fd)
      if (!res.success) {
        setError(res.error || 'Erro ao criar voucher')
        return
      }
      ;(e.target as HTMLFormElement).reset()
    })
  }

  function handleToggle(id: string, currentStatus: boolean) {
    startTransition(async () => {
      await toggleVoucherAction(id, currentStatus)
    })
  }

  function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja excluir este voucher permanentemente?')) return
    startTransition(async () => {
      const res = await excluirVoucherAction(id)
      if (!res?.success) alert(res?.error || 'Erro ao excluir')
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Formulário de Criação */}
      <form onSubmit={handleCreate} style={{
        background: '#fff', border: '1.5px solid var(--border)', borderRadius: 16, padding: 24,
        display: 'flex', flexDirection: 'column', gap: 20
      }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)' }}>Criar novo cupom</div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {/* Código */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
              CÓDIGO DO CUPOM *
            </label>
            <input
              name="codigo"
              required
              placeholder="Ex: VOLTAASAULAS"
              style={{
                width: '100%', height: 44, padding: '0 14px', borderRadius: 10, textTransform: 'uppercase',
                border: '1.5px solid var(--border)', background: 'var(--surface-2)', fontSize: 14, fontWeight: 700
              }}
            />
          </div>

          {/* Tipo de Desconto */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
              TIPO DE DESCONTO *
            </label>
            <select
              name="tipo_desconto"
              required
              style={{
                width: '100%', height: 44, padding: '0 14px', borderRadius: 10,
                border: '1.5px solid var(--border)', background: 'var(--surface-2)', fontSize: 14, fontWeight: 600
              }}
            >
              <option value="percentual">Porcentagem (%)</option>
              <option value="fixo">Valor Fixo (R$)</option>
            </select>
          </div>

          {/* Valor */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
              VALOR DO DESCONTO *
            </label>
            <input
              name="valor"
              type="number"
              step="0.01"
              required
              placeholder="Ex: 10,00"
              style={{
                width: '100%', height: 44, padding: '0 14px', borderRadius: 10,
                border: '1.5px solid var(--border)', background: 'var(--surface-2)', fontSize: 14, fontWeight: 600
              }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {/* Limite de Usos */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
              LIMITE DE USOS
            </label>
            <input
              name="limite_usos"
              type="number"
              placeholder="Ex: 50 (Vazio = Ilimitado)"
              style={{
                width: '100%', height: 44, padding: '0 14px', borderRadius: 10,
                border: '1.5px solid var(--border)', background: 'var(--surface-2)', fontSize: 14, fontWeight: 600
              }}
            />
          </div>

          {/* Compra Mínima */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
              COMPRA MÍNIMA (R$)
            </label>
            <input
              name="compra_minima"
              type="number"
              step="0.01"
              placeholder="Vazio = Sem mínimo"
              style={{
                width: '100%', height: 44, padding: '0 14px', borderRadius: 10,
                border: '1.5px solid var(--border)', background: 'var(--surface-2)', fontSize: 14, fontWeight: 600
              }}
            />
          </div>

          {/* Validade */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
              DATA DE VALIDADE
            </label>
            <input
              name="data_validade"
              type="date"
              style={{
                width: '100%', height: 44, padding: '0 14px', borderRadius: 10,
                border: '1.5px solid var(--border)', background: 'var(--surface-2)', fontSize: 14, fontWeight: 600
              }}
            />
          </div>
        </div>

        {error && <div style={{ color: '#ef4444', fontSize: 13, fontWeight: 600 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button
            type="submit"
            disabled={isPending}
            style={{
              height: 48, padding: '0 32px', borderRadius: 10, border: 'none',
              background: isPending ? '#94a3b8' : '#0f172a',
              color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer'
            }}
          >
            {isPending ? 'Salvando...' : 'Gerar Cupom'}
          </button>
        </div>
      </form>

      {/* Lista de Vouchers */}
      <div style={{
        background: '#fff', border: '1.5px solid var(--border)', borderRadius: 16, overflow: 'hidden'
      }}>
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
          fontSize: 13, fontWeight: 800, color: 'var(--text-1)', background: '#f8fafc'
        }}>
          Cupons Ativos e Inativos ({vouchers.length})
        </div>
        
        {vouchers.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
            Nenhum cupom gerado.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {vouchers.map(v => {
              const expirado = v.data_validade && new Date(v.data_validade) < new Date()
              const esgotado = v.limite_usos !== null && v.usos_atuais >= v.limite_usos
              const invalido = !v.ativo || expirado || esgotado

              return (
                <div key={v.id} style={{
                  padding: '16px 20px', borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  opacity: invalido ? 0.6 : 1, background: invalido ? '#f8fafc' : '#fff'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{
                      padding: '8px 12px', background: '#ede9fe', border: '1.5px dashed #a78bfa',
                      borderRadius: 8, fontSize: 15, fontWeight: 900, color: '#5b21b6', letterSpacing: 1
                    }}>
                      {v.codigo}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>
                        {v.tipo_desconto === 'percentual' ? `${v.valor}% de desconto` : `R$ ${v.valor.toFixed(2)} de desconto`}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, display: 'flex', gap: 12 }}>
                        <span>Usados: {v.usos_atuais}{v.limite_usos ? ` / ${v.limite_usos}` : ''}</span>
                        {v.compra_minima && <span>Mínimo: R$ {v.compra_minima.toFixed(2)}</span>}
                        {v.data_validade && <span>Validade: {new Date(v.data_validade).toLocaleDateString('pt-BR')}</span>}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                      onClick={() => handleToggle(v.id, v.ativo)}
                      style={{
                        height: 32, padding: '0 12px', borderRadius: 8,
                        background: v.ativo ? '#fff' : '#e2e8f0',
                        border: `1px solid ${v.ativo ? '#cbd5e1' : '#cbd5e1'}`,
                        color: 'var(--text-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      {v.ativo ? 'Desativar' : 'Reativar'}
                    </button>
                    <button
                      onClick={() => handleDelete(v.id)}
                      style={{
                        width: 32, height: 32, borderRadius: 8, background: '#fef2f2',
                        border: '1px solid #fecaca', color: '#ef4444', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                      title="Excluir"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
