'use client'

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import { usePostHog } from 'posthog-js/react'
import type { Produto, Aluno } from '@/types/database'

// ── Types ──────────────────────────────────────────────────────────────────

export interface CartItem {
  id: string           // unique: produto_id + aluno_id
  produto: Produto
  aluno: Aluno
  variante_id: string | null
  variante: string | null
}

interface CartState {
  items: CartItem[]
  isOpen: boolean
  hydrated: boolean
}

type CartAction =
  | { type: 'ADD'; produto: Produto; aluno: Aluno; varianteId?: string | null; variante?: string | null }
  | { type: 'REMOVE'; id: string }
  | { type: 'CLEAR' }
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'HYDRATE'; items: CartItem[] }

// ── Reducer ─────────────────────────────────────────────────────────────────

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD': {
      const varianteId = action.varianteId ?? null
      const variante = action.variante ?? null
      const id = `${action.produto.id}__${action.aluno.id}__${variante ?? 'sem-variante'}`
      if (state.items.find(i => i.id === id)) return state
      return { ...state, items: [...state.items, { id, produto: action.produto, aluno: action.aluno, variante_id: varianteId, variante }] }
    }
    case 'REMOVE':
      return { ...state, items: state.items.filter(i => i.id !== action.id) }
    case 'CLEAR':
      return { ...state, items: [] }
    case 'OPEN':
      return { ...state, isOpen: true }
    case 'CLOSE':
      return { ...state, isOpen: false }
    case 'HYDRATE':
      return { ...state, items: action.items, hydrated: true }
    default:
      return state
  }
}

// ── Context ──────────────────────────────────────────────────────────────────

interface CartContextValue {
  items: CartItem[]
  isOpen: boolean
  hydrated: boolean
  total: number
  add: (produto: Produto, aluno: Aluno, varianteId?: string | null, variante?: string | null) => void
  remove: (id: string) => void
  clear: () => void
  open: () => void
  close: () => void
  hasItem: (produtoId: string, alunoId: string, variante?: string | null) => boolean
}

const CartContext = createContext<CartContextValue | null>(null)

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}

// ── Provider ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'loja_cart'

export function CartProvider({ children }: { children: ReactNode }) {
  const posthog = usePostHog()
  const [state, dispatch] = useReducer(cartReducer, { items: [], isOpen: false, hydrated: false })

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const items = JSON.parse(stored) as CartItem[]
        dispatch({ type: 'HYDRATE', items })
        return
      }
    } catch {}

    dispatch({ type: 'HYDRATE', items: [] })
  }, [])

  // Persist to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items))
    } catch {}
  }, [state.items])

  // Lock body scroll when cart is open
  useEffect(() => {
    document.body.style.overflow = state.isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [state.isOpen])

  const total = state.items.reduce((sum, i) => sum + (i.produto.preco_promocional ?? i.produto.preco), 0)

  const value: CartContextValue = {
    items: state.items,
    isOpen: state.isOpen,
    hydrated: state.hydrated,
    total,
    add: (produto, aluno, varianteId, variante) => {
      posthog?.capture('add_to_cart', {
        produto_id: produto.id,
        produto_nome: produto.titulo,
        preco: produto.preco_promocional ?? produto.preco,
      })
      dispatch({ type: 'ADD', produto, aluno, varianteId, variante })
    },
    remove: (id) => dispatch({ type: 'REMOVE', id }),
    clear: () => dispatch({ type: 'CLEAR' }),
    open: () => dispatch({ type: 'OPEN' }),
    close: () => dispatch({ type: 'CLOSE' }),
    hasItem: (produtoId, alunoId, variante) =>
      state.items.some(i => i.id === `${produtoId}__${alunoId}__${variante ?? 'sem-variante'}`),
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
