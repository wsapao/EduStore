'use client'

import { useState, useTransition } from 'react'
import { criarCategoriaAction, toggleCategoriaAction, excluirCategoriaAction } from '@/app/actions/admin'
import type { Categoria } from '@/types/database'

export function CategoriaManager({ categorias }: { categorias: Categoria[] }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [iconVal, setIconVal] = useState('🏷️')
  const [nomeVal, setNomeVal] = useState('')

  const ICONS_SUGESTOES = ['🏷️', '🎉', '🚌', '📝', '📚', '👕', '📦', '🍔', '🎁', '📱', '🏀', '🎭']

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    
    startTransition(async () => {
      const res = await criarCategoriaAction(fd)
      if (!res.success) {
        setError(res.error || 'Erro ao criar categoria')
        return
      }
      setNomeVal('')
      setIconVal('🏷️')
    })
  }

  function handleToggle(id: string, currentStatus: boolean) {
    startTransition(async () => {
      await toggleCategoriaAction(id, currentStatus)
    })
  }

  function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja excluir esta categoria? Os produtos atrelados a ela ficarão sem categoria.')) return
    startTransition(async () => {
      const res = await excluirCategoriaAction(id)
      if (!res?.success) alert(res?.error || 'Erro ao excluir')
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Formulário de Criação */}
      <form onSubmit={handleCreate} style={{
        background: '#fff', border: '1.5px solid var(--border)', borderRadius: 16, padding: 20,
        display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap'
      }}>
        <div style={{ width: 90, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
            ÍCONE
          </label>
          <input
            name="icone"
            value={iconVal}
            onChange={e => setIconVal(e.target.value)}
            maxLength={4}
            style={{
              width: '100%', height: 48, borderRadius: 10, border: '1.5px solid var(--border)',
              background: 'var(--surface-2)', fontSize: 20, textAlign: 'center'
            }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
            NOME DA CATEGORIA *
          </label>
          <input
            name="nome"
            value={nomeVal}
            onChange={e => setNomeVal(e.target.value)}
            required
            placeholder="Ex: Eventos"
            style={{
              width: '100%', height: 48, padding: '0 14px', borderRadius: 10,
              border: '1.5px solid var(--border)', background: 'var(--surface-2)', fontSize: 14, fontWeight: 600
            }}
          />
        </div>
        <button
          type="submit"
          disabled={isPending || !nomeVal.trim()}
          style={{
            height: 48, padding: '0 24px', borderRadius: 10, border: 'none',
            background: isPending || !nomeVal.trim() ? '#94a3b8' : '#0f172a',
            color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer'
          }}
        >
          {isPending ? 'Salvando...' : 'Adicionar'}
        </button>

        <div style={{ width: '100%', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ICONS_SUGESTOES.map(ic => (
            <button key={ic} type="button" onClick={() => setIconVal(ic)}
              style={{
                fontSize: 16, background: iconVal === ic ? '#ede9fe' : 'var(--surface-2)',
                border: iconVal === ic ? '1.5px solid #a78bfa' : '1.5px solid transparent',
                borderRadius: 6, cursor: 'pointer', width: 32, height: 32,
              }}
            >{ic}</button>
          ))}
        </div>

        {error && <div style={{ width: '100%', color: '#ef4444', fontSize: 13, fontWeight: 600 }}>{error}</div>}
      </form>

      {/* Lista de Categorias */}
      <div style={{
        background: '#fff', border: '1.5px solid var(--border)', borderRadius: 16, overflow: 'hidden'
      }}>
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
          fontSize: 13, fontWeight: 800, color: 'var(--text-1)', background: '#f8fafc'
        }}>
          Categorias Existentes ({categorias.length})
        </div>
        
        {categorias.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
            Nenhuma categoria cadastrada ainda.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {categorias.map(cat => (
              <div key={cat.id} style={{
                padding: '16px 20px', borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                opacity: cat.ativo ? 1 : 0.6, background: cat.ativo ? '#fff' : '#f8fafc'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 24 }}>{cat.icone}</div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>
                      {cat.nome}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {cat.ativo ? 'Disponível no cadastro de produtos' : 'Oculta'}
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    onClick={() => handleToggle(cat.id, cat.ativo)}
                    style={{
                      height: 32, padding: '0 12px', borderRadius: 8,
                      background: cat.ativo ? '#fff' : '#e2e8f0',
                      border: `1px solid ${cat.ativo ? '#cbd5e1' : '#cbd5e1'}`,
                      color: 'var(--text-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer'
                    }}
                  >
                    {cat.ativo ? 'Desativar' : 'Reativar'}
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id)}
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
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
