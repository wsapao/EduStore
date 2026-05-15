'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { criarCategoriaAction } from '@/app/actions/admin'
import type { Categoria } from '@/types/database'

const ICONS_SUGESTOES = ['🏷️', '🎉', '🚌', '📝', '📚', '👕', '📦', '🍔', '🎁', '📱', '🏀', '🎭']

type Props = {
  open: boolean
  onClose: () => void
  /** Chamado com a nova categoria após sucesso. O pai deve atualizar a lista local + selecionar. */
  onCreated: (categoria: Categoria) => void
}

export function NovaCategoriaModal({ open, onClose, onCreated }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [nome, setNome] = useState('')
  const [icone, setIcone] = useState('🏷️')
  const [temVariantes, setTemVariantes] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset state ao abrir
  useEffect(() => {
    if (open) {
      setNome('')
      setIcone('🏷️')
      setTemVariantes(false)
      setError('')
      // Foca no input nome ao abrir
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Fecha com ESC
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    if (!nome.trim()) {
      setError('Informe o nome da categoria.')
      return
    }
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await criarCategoriaAction(fd)
      if (!res.success || !res.categoria) {
        setError(res.error || 'Erro ao criar categoria.')
        return
      }
      onCreated(res.categoria as Categoria)
      onClose()
    })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 16,
          padding: 24,
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,.3)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
            Nova categoria
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 22,
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="Ícone">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ICONS_SUGESTOES.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcone(ic)}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 8,
                    border: icone === ic ? '2px solid #2563eb' : '1.5px solid #e2e8f0',
                    background: icone === ic ? '#eff6ff' : '#f8fafc',
                    fontSize: 18,
                    cursor: 'pointer',
                  }}
                >
                  {ic}
                </button>
              ))}
            </div>
            <input type="hidden" name="icone" value={icone} />
          </Field>

          <Field label="Nome da categoria">
            <input
              ref={inputRef}
              name="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Eventos, Materiais, Uniforme..."
              required
              style={inputStyle}
            />
          </Field>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              name="tem_variantes"
              checked={temVariantes}
              onChange={(e) => setTemVariantes(e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 13, color: '#475569' }}>
              Esta categoria tem variantes (ex: tamanhos P/M/G)
            </span>
          </label>

          {error && (
            <div style={{ background: '#fee2e2', color: '#991b1b', padding: '8px 12px', borderRadius: 8, fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              style={{
                padding: '10px 16px',
                borderRadius: 10,
                background: '#f1f5f9',
                color: '#475569',
                border: '1.5px solid #e2e8f0',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              style={{
                padding: '10px 18px',
                borderRadius: 10,
                background: pending ? '#94a3b8' : '#2563eb',
                color: 'white',
                border: 'none',
                fontSize: 13,
                fontWeight: 800,
                cursor: pending ? 'wait' : 'pointer',
              }}
            >
              {pending ? 'Criando…' : 'Criar categoria'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em' }}>
        {label}
      </span>
      {children}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  border: '1.5px solid #e2e8f0',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 14,
  outline: 'none',
  fontFamily: 'inherit',
}
