'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { iniciarRecargaAction } from '@/app/actions/cantina'

const VALORES_RAPIDOS = [20, 30, 50, 100, 150, 200]

interface Props {
  alunoId: string
  alunoNome: string
  saldoAtual: number
}

function fmtMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function RecargaClient({ alunoId, alunoNome, saldoAtual }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [valorSelecionado, setValorSelecionado] = useState<number | null>(null)
  const [valorCustom, setValorCustom] = useState('')
  // futuro: estado para tela de PIX após integração com gateway
  const [erro, setErro] = useState<string | null>(null)

  const valorFinal = valorSelecionado ?? (valorCustom ? parseFloat(valorCustom.replace(',', '.')) : null)

  function handleValorRapido(v: number) {
    setValorSelecionado(v)
    setValorCustom('')
  }

  function handleCustom(raw: string) {
    setValorCustom(raw)
    setValorSelecionado(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!valorFinal || isNaN(valorFinal) || valorFinal < 5) {
      setErro('Valor mínimo de recarga é R$ 5,00.')
      return
    }
    if (valorFinal > 2000) {
      setErro('Valor máximo por recarga é R$ 2.000,00.')
      return
    }

    startTransition(async () => {
      const res = await iniciarRecargaAction(alunoId, valorFinal)
      if (!res.success) {
        setErro(res.error ?? 'Erro ao iniciar recarga.')
        return
      }
      // MVP: recarga creditada diretamente (sem gateway)
      router.push(`/cantina/${alunoId}/extrato`)
    })
  }

  // ── Formulário de recarga ───────────────────────────────────
  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Saldo atual */}
      <div style={{
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)', padding: '12px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>
          Saldo atual de {alunoNome.split(' ')[0]}
        </span>
        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--brand)' }}>
          {fmtMoeda(saldoAtual)}
        </span>
      </div>

      {/* Valores rápidos */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
          Escolha o valor
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {VALORES_RAPIDOS.map(v => (
            <button
              key={v}
              type="button"
              onClick={() => handleValorRapido(v)}
              style={{
                padding: '12px 8px', borderRadius: 'var(--r-md)',
                border: `2px solid ${valorSelecionado === v ? 'var(--brand)' : 'var(--border)'}`,
                background: valorSelecionado === v ? 'var(--brand)' : 'var(--surface)',
                color: valorSelecionado === v ? '#fff' : 'var(--text-1)',
                fontSize: 14, fontWeight: 800, cursor: 'pointer',
                transition: 'all .15s',
              }}
            >
              {fmtMoeda(v)}
            </button>
          ))}
        </div>
      </div>

      {/* Valor personalizado */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>
          Ou valor personalizado
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-2)' }}>R$</span>
          <input
            type="number"
            min="5"
            max="2000"
            step="0.01"
            placeholder="Ex: 75,00"
            value={valorCustom}
            onChange={e => handleCustom(e.target.value)}
            style={{
              flex: 1, padding: '11px 12px',
              borderRadius: 'var(--r-md)',
              border: `1.5px solid ${valorCustom ? 'var(--brand)' : 'var(--border)'}`,
              fontSize: 15, fontWeight: 700, outline: 'none',
              transition: 'border-color .15s',
            }}
          />
        </div>
      </div>

      {/* Método */}
      <div style={{
        background: '#eff6ff', border: '1px solid #bfdbfe',
        borderRadius: 'var(--r-md)', padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 20 }}>⚡</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>Pagamento via PIX</div>
          <div style={{ fontSize: 12, color: '#1d4ed8' }}>Saldo creditado imediatamente após confirmação</div>
        </div>
      </div>

      {/* Erro */}
      {erro && (
        <div style={{
          padding: '12px', borderRadius: 'var(--r-md)',
          background: 'var(--danger-light)', color: '#991b1b',
          fontSize: 13, fontWeight: 600,
        }}>
          ❌ {erro}
        </div>
      )}

      {/* Total + submit */}
      {valorFinal && !isNaN(valorFinal) && (
        <div style={{
          background: '#fff7ed', border: '1.5px solid #fed7aa',
          borderRadius: 'var(--r-md)', padding: '14px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#9a3412', textTransform: 'uppercase', letterSpacing: '.07em' }}>
            Total da recarga
          </span>
          <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--brand)' }}>
            {fmtMoeda(valorFinal)}
          </span>
        </div>
      )}

      <button type="submit" disabled={pending || !valorFinal || isNaN(valorFinal!)} style={{
        padding: '14px', borderRadius: 'var(--r-md)',
        background: (!valorFinal || isNaN(valorFinal!)) ? 'var(--border)' : 'var(--brand)',
        color: '#fff', border: 'none',
        cursor: (!valorFinal || isNaN(valorFinal!)) ? 'not-allowed' : 'pointer',
        fontSize: 15, fontWeight: 800,
        transition: 'all .2s',
      }}>
        {pending ? 'Gerando PIX…' : `Recarregar ${valorFinal && !isNaN(valorFinal) ? fmtMoeda(valorFinal) : ''}`}
      </button>
    </form>
  )
}
