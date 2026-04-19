'use client'

import React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { CategoriaProduto } from '@/types/database'

export const CATEGORIAS: Record<CategoriaProduto | 'todas', { label: string; icon: string }> = {
  todas: { label: 'Todos', icon: '' },
  eventos: { label: 'Eventos', icon: '🎉' },
  passeios: { label: 'Passeios', icon: '🚌' },
  segunda_chamada: { label: '2ª Chamada', icon: '📝' },
  materiais: { label: 'Materiais', icon: '📚' },
  uniforme: { label: 'Uniforme', icon: '👕' },
  outros: { label: 'Outros', icon: '📦' },
}

interface Props {
  counts: Partial<Record<CategoriaProduto | 'todas', number>>
}

export function CategoryFilter({ counts }: Props) {
  const router = useRouter()
  const sp = useSearchParams()
  const selected = (sp.get('categoria') ?? 'todas') as CategoriaProduto | 'todas'

  function select(cat: string) {
    const params = new URLSearchParams(sp.toString())
    if (cat === 'todas') params.delete('categoria')
    else params.set('categoria', cat)
    router.push(`/loja?${params.toString()}`)
  }

  const tabs = Object.entries(CATEGORIAS).filter(([cat]) => {
    if (cat === 'todas') return true
    return (counts[cat as CategoriaProduto] ?? 0) > 0
  })

  if (tabs.length <= 1) return null

  return (
    <section style={{ padding:'16px 20px 0' }}>
      <div style={{
        display:'flex', gap:8, overflowX:'auto',
        paddingBottom:2, scrollbarWidth:'none',
      }}>
        {tabs.map(([cat, { label, icon }]) => {
          const isActive = selected === cat
          const count = cat === 'todas'
            ? (counts.todas ?? 0)
            : (counts[cat as CategoriaProduto] ?? 0)

          return (
            <button key={cat} onClick={() => select(cat)} style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'8px 16px', borderRadius:'var(--r-pill)',
              border: `1.5px solid ${isActive ? 'var(--brand)' : 'var(--border)'}`,
              background: isActive ? 'var(--brand)' : 'var(--surface)',
              fontFamily:'inherit', fontSize:13, fontWeight:600,
              color: isActive ? 'white' : 'var(--text-2)',
              cursor:'pointer', whiteSpace:'nowrap', flexShrink:0,
              transition:'all .2s var(--ease)',
              boxShadow: isActive ? '0 2px 10px rgba(26,47,90,.3)' : 'var(--shadow-xs)',
            }}>
              {icon && <span>{icon}</span>}
              {label}
              <span style={{
                fontSize:10, fontWeight:700,
                background: isActive ? 'rgba(255,255,255,.25)' : 'var(--border)',
                color: isActive ? 'white' : 'var(--text-3)',
                borderRadius:'var(--r-pill)', padding:'1px 6px', lineHeight:1.6,
              }}>
                {count}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
