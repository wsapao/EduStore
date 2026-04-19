'use client'

import React from 'react'
import { useCart } from './CartProvider'

export function CartBar() {
  const { items, total, open, isOpen } = useCart()

  if (items.length === 0 || isOpen) return null

  return (
    <div style={{
      position:'fixed', bottom:0, left:0, right:0,
      padding:'0 20px 24px', zIndex:150,
      transform: items.length > 0 ? 'translateY(0)' : 'translateY(100%)',
      transition:'transform .35s cubic-bezier(.34,1.56,.64,1)',
      pointerEvents: items.length > 0 ? 'all' : 'none',
    }}>
      <div
        onClick={open}
        style={{
          background:'var(--brand)', borderRadius:'var(--r-xl)',
          padding:'14px 18px',
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
          boxShadow:'0 12px 40px rgba(0,0,0,.12), 0 4px 12px rgba(0,0,0,.06), 0 0 0 1px rgba(255,255,255,.08) inset',
          cursor:'pointer', transition:'all .2s var(--ease)',
          maxWidth:560, margin:'0 auto',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#243b70' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--brand)' }}
      >
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{
            background:'rgba(255,255,255,.15)', borderRadius:'var(--r-sm)',
            padding:'4px 10px', fontSize:14, fontWeight:800, color:'white', lineHeight:1.4,
          }}>
            {items.length}
          </span>
          <span style={{ fontSize:14, fontWeight:600, color:'rgba(255,255,255,.85)' }}>
            {items.length === 1 ? 'item no ' : 'itens no '}
            <strong style={{ color:'white' }}>carrinho</strong>
          </span>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:18, fontWeight:800, color:'white', letterSpacing:'-.02em' }}>
            {total.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })}
          </span>
          <span style={{ color:'rgba(255,255,255,.6)', fontSize:20, lineHeight:1 }}>›</span>
        </div>
      </div>
    </div>
  )
}
