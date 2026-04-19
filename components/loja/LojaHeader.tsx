'use client'

import React, { useState } from 'react'
import { useCart } from './CartProvider'
import { logoutAction } from '@/app/actions/auth'
import type { Responsavel, Escola } from '@/types/database'

interface Props {
  responsavel: Responsavel
  escola: Escola
}

export function LojaHeader({ responsavel, escola }: Props) {
  const { items, open } = useCart()
  const [menuOpen, setMenuOpen] = useState(false)
  const initials = responsavel.nome.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()

  return (
    <>
      <header style={{
        position:'sticky', top:0, zIndex:200,
        background:'rgba(255,255,255,.92)',
        backdropFilter:'blur(16px) saturate(180%)',
        WebkitBackdropFilter:'blur(16px) saturate(180%)',
        borderBottom:'1px solid var(--border)',
        height:64, padding:'0 20px',
        display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
      }}>
        {/* Brand */}
        <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <div style={{
            width:38, height:38, borderRadius:10, background:'var(--brand)',
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 2px 8px rgba(26,47,90,.35)', flexShrink:0,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div style={{ lineHeight:1.2 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--text-1)', letterSpacing:'-.01em' }}>
              {escola.nome}
            </div>
            <div style={{ fontSize:11, color:'var(--text-3)', fontWeight:500 }}>Loja Escolar</div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {/* Greeting (desktop only) */}
          <div style={{ textAlign:'right', display:'none' }} className="header-greeting">
            <div style={{ fontSize:11, color:'var(--text-3)', fontWeight:500 }}>Olá,</div>
            <div style={{ fontSize:13, color:'var(--text-1)', fontWeight:700 }}>
              {responsavel.nome.split(' ')[0]}
            </div>
          </div>

          {/* Cart button */}
          <button onClick={open} title="Meu Carrinho" style={{
            position:'relative', width:42, height:42, borderRadius:'var(--r-md)',
            background:'var(--brand)', border:'none', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            transition:'all .2s var(--ease)',
            boxShadow:'0 2px 8px rgba(26,47,90,.3)',
          }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
              ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(26,47,90,.4)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
              ;(e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(26,47,90,.3)'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 001.98 1.61h9.72a2 2 0 001.98-1.61L23 6H6"/>
            </svg>
            {items.length > 0 && (
              <span style={{
                position:'absolute', top:-5, right:-5,
                background:'var(--danger)', color:'white',
                borderRadius:'var(--r-pill)', minWidth:18, height:18,
                fontSize:10, fontWeight:800, display:'flex', alignItems:'center',
                justifyContent:'center', padding:'0 4px', border:'2px solid white',
              }}>
                {items.length}
              </span>
            )}
          </button>

          {/* Avatar + menu */}
          <div style={{ position:'relative' }}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              style={{
                width:38, height:38, borderRadius:'var(--r-pill)',
                background:'linear-gradient(135deg,#667eea,#764ba2)',
                border:'2px solid var(--surface)',
                boxShadow:'var(--shadow-xs)', display:'flex',
                alignItems:'center', justifyContent:'center',
                fontSize:13, fontWeight:700, color:'white', cursor:'pointer',
                transition:'all .2s',
              }}
            >
              {initials}
            </button>

            {menuOpen && (
              <>
                <div
                  onClick={() => setMenuOpen(false)}
                  style={{ position:'fixed', inset:0, zIndex:10 }}
                />
                <div style={{
                  position:'absolute', top:'calc(100% + 8px)', right:0, zIndex:20,
                  background:'var(--surface)', border:'1px solid var(--border)',
                  borderRadius:'var(--r-md)', boxShadow:'var(--shadow-md)',
                  minWidth:200, overflow:'hidden',
                  animation:'fade-up .15s var(--ease) both',
                }}>
                  <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--text-1)' }}>
                      {responsavel.nome}
                    </div>
                    <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
                      {responsavel.email}
                    </div>
                  </div>
                  <a href="/perfil" style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding:'10px 16px', fontSize:13, fontWeight:600,
                    color:'var(--text-2)', textDecoration:'none',
                    transition:'background .15s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    Meu perfil
                  </a>
                  <a href="/pedidos" style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding:'10px 16px', fontSize:13, fontWeight:600,
                    color:'var(--text-2)', textDecoration:'none',
                    transition:'background .15s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                    </svg>
                    Meus pedidos
                  </a>
                  <a href="/perfil/alunos" style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding:'10px 16px', fontSize:13, fontWeight:600,
                    color:'var(--text-2)', textDecoration:'none',
                    transition:'background .15s',
                    borderTop:'1px solid var(--border)',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                    </svg>
                    Meus filhos
                  </a>
                  <a href="/cantina" style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding:'10px 16px', fontSize:13, fontWeight:600,
                    color:'var(--text-2)', textDecoration:'none',
                    transition:'background .15s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ fontSize:15 }}>🍽️</span>
                    Cantina
                  </a>
                  <form action={logoutAction} style={{ borderTop:'1px solid var(--border)' }}>
                    <button type="submit" style={{
                      width:'100%', padding:'10px 16px',
                      display:'flex', alignItems:'center', gap:10,
                      fontSize:13, fontWeight:600, color:'var(--danger)',
                      background:'none', border:'none', cursor:'pointer',
                      textAlign:'left', transition:'background .15s',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--danger-light)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                        <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                      </svg>
                      Sair da conta
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <style>{`
        @media (min-width: 640px) {
          .header-greeting { display: block !important; }
        }
      `}</style>
    </>
  )
}
