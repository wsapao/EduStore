'use client'

import { useState, useTransition } from 'react'
import { ajusteManualAdminAction, bloquearCarteiraAdminAction } from '@/app/actions/cantina'

interface Carteira {
  id: string
  saldo: number
  limite_diario: number | null
  ativo: boolean
  bloqueio_motivo: string | null
  aluno: { id: string; nome: string; serie: string; turma: string | null } | null
}

interface Props {
  carteiras: Carteira[]
}

function fmtMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function CarteirasClient({ carteiras }: Props) {
  const [pending, startTransition] = useTransition()
  const [ajusteAberto, setAjusteAberto] = useState<string | null>(null) // carteiraId
  const [tipo, setTipo] = useState<'credito' | 'debito'>('credito')
  const [valor, setValor] = useState('')
  const [motivo, setMotivo] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const filtradas = carteiras.filter(c =>
    !q || c.aluno?.nome.toLowerCase().includes(q.toLowerCase())
  )

  function handleAjuste(carteiraId: string) {
    setAjusteAberto(carteiraId)
    setTipo('credito')
    setValor('')
    setMotivo('')
    setMsg(null)
  }

  function handleSubmitAjuste(carteiraId: string) {
    const v = parseFloat(valor.replace(',', '.'))
    if (isNaN(v) || v <= 0) { setMsg('❌ Valor inválido.'); return }
    if (!motivo.trim()) { setMsg('❌ Informe o motivo do ajuste.'); return }

    startTransition(async () => {
      const res = await ajusteManualAdminAction(carteiraId, tipo, v, motivo.trim())
      if (res.error) { setMsg(`❌ ${res.error}`); return }
      setMsg('✅ Ajuste realizado!')
      setAjusteAberto(null)
      window.location.reload()
    })
  }

  function handleBloquear(carteira: Carteira) {
    const bloqueando = carteira.ativo
    const motivoInput = bloqueando ? window.prompt('Motivo do bloqueio (opcional):') ?? '' : ''
    if (bloqueando && motivoInput === null) return // cancelou
    startTransition(async () => {
      await bloquearCarteiraAdminAction(carteira.id, bloqueando, motivoInput)
      window.location.reload()
    })
  }

  return (
    <div>
      {/* Busca */}
      <input
        type="text"
        placeholder="Buscar aluno..."
        value={q}
        onChange={e => setQ(e.target.value)}
        style={{
          width: '100%', padding: '10px 14px', marginBottom: 16,
          borderRadius: 'var(--r-md)', border: '1.5px solid var(--border)',
          fontSize: 14, outline: 'none',
        }}
      />

      {/* Lista */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtradas.map(c => (
          <div key={c.id} style={{
            background: 'var(--surface)', border: `1.5px solid ${!c.ativo ? 'var(--danger)' : 'var(--border)'}`,
            borderRadius: 'var(--r-lg)', overflow: 'hidden',
            boxShadow: 'var(--shadow-xs)',
          }}>
            {/* Topo */}
            <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)' }}>
                  {c.aluno?.nome ?? 'Aluno desvinculado'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                  {c.aluno?.serie}{c.aluno?.turma ? ` · Turma ${c.aluno.turma}` : ''}
                  {!c.ativo && <span style={{ color: 'var(--danger)', marginLeft: 8 }}>🔒 {c.bloqueio_motivo ?? 'Bloqueada'}</span>}
                </div>
              </div>
              <div style={{
                background: '#eff6ff', border: '1px solid #bfdbfe',
                borderRadius: 'var(--r-md)', padding: '10px 14px', textAlign: 'right', minWidth: 120,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#1e40af', marginBottom: 4 }}>
                  Saldo
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand)' }}>{fmtMoeda(c.saldo)}</div>
              </div>
            </div>

            {/* Info */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Limite diário: <strong>{c.limite_diario ? fmtMoeda(c.limite_diario) : 'Sem limite'}</strong>
              </div>
            </div>

            {/* Ações */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => handleAjuste(c.id)} style={{
                padding: '7px 12px', borderRadius: 'var(--r-md)', fontSize: 12, fontWeight: 700,
                background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer',
              }}>✏️ Ajuste manual</button>
              <button onClick={() => handleBloquear(c)} disabled={pending} style={{
                padding: '7px 12px', borderRadius: 'var(--r-md)', fontSize: 12, fontWeight: 700,
                background: c.ativo ? 'var(--danger-light)' : 'var(--success-light)',
                color: c.ativo ? '#991b1b' : '#065f46', border: 'none', cursor: 'pointer',
              }}>
                {c.ativo ? '🔒 Bloquear' : '🔓 Desbloquear'}
              </button>
            </div>

            {/* Formulário de ajuste inline */}
            {ajusteAberto === c.id && (
              <div style={{ padding: '16px', borderTop: '2px solid var(--brand)', background: '#eff6ff' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand)', marginBottom: 12 }}>
                  Ajuste manual — {c.aluno?.nome}
                </div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                  {(['credito', 'debito'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setTipo(t)} style={{
                      padding: '8px 14px', borderRadius: 'var(--r-md)', fontSize: 12, fontWeight: 800,
                      border: `2px solid ${tipo === t ? 'var(--brand)' : 'var(--border)'}`,
                      background: tipo === t ? 'var(--brand)' : 'var(--surface)',
                      color: tipo === t ? '#fff' : 'var(--text-2)', cursor: 'pointer',
                    }}>
                      {t === 'credito' ? '💰 Crédito (+)' : '💸 Débito (-)'}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                  <input
                    type="number" min="0.01" step="0.01" placeholder="Valor (R$)"
                    value={valor} onChange={e => setValor(e.target.value)}
                    style={{ flex: 1, minWidth: 120, padding: '9px 12px', borderRadius: 'var(--r-md)', border: '1.5px solid var(--border)', fontSize: 14 }}
                  />
                  <input
                    type="text" placeholder="Motivo obrigatório"
                    value={motivo} onChange={e => setMotivo(e.target.value)}
                    style={{ flex: 2, minWidth: 180, padding: '9px 12px', borderRadius: 'var(--r-md)', border: '1.5px solid var(--border)', fontSize: 13 }}
                  />
                </div>
                {msg && <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: msg.startsWith('✅') ? '#065f46' : '#991b1b' }}>{msg}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleSubmitAjuste(c.id)} disabled={pending} style={{
                    padding: '8px 16px', borderRadius: 'var(--r-md)', fontSize: 13, fontWeight: 800,
                    background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer',
                  }}>
                    {pending ? 'Salvando…' : 'Confirmar ajuste'}
                  </button>
                  <button onClick={() => setAjusteAberto(null)} style={{
                    padding: '8px 14px', borderRadius: 'var(--r-md)', fontSize: 13, fontWeight: 600,
                    background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-2)',
                  }}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        ))}

        {filtradas.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-3)', fontSize: 13 }}>
            Nenhuma carteira encontrada.
          </div>
        )}
      </div>
    </div>
  )
}
