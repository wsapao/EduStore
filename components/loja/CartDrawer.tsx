'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from './CartProvider'

export function CartDrawer() {
  const { items, isOpen, close, remove, total } = useCart()
  const router = useRouter()

  function goToCheckout() {
    close()
    router.push('/checkout')
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={close}
        style={{
          position:'fixed', inset:0,
          background:'rgba(0,0,0,.5)',
          backdropFilter:'blur(4px)',
          zIndex:300,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'all' : 'none',
          transition:'opacity .3s var(--ease)',
        }}
      />

      {/* Drawer */}
      <div style={{
        position:'fixed', top:0, right:0, bottom:0,
        width:'min(88vw, 380px)',
        background:'var(--surface)',
        zIndex:400,
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition:'transform .35s cubic-bezier(.34,1.56,.64,1)',
        display:'flex', flexDirection:'column',
        borderRadius:'var(--r-xl) 0 0 var(--r-xl)',
        boxShadow:'-8px 0 40px rgba(0,0,0,.15)',
      }}>
        {/* Header */}
        <div style={{
          padding:'20px 20px 16px', borderBottom:'1px solid var(--border)',
          display:'flex', alignItems:'center', justifyContent:'space-between',
        }}>
          <div>
            <span style={{ fontSize:18, fontWeight:800, color:'var(--text-1)', letterSpacing:'-.02em' }}>
              Carrinho
            </span>
            <span style={{ fontSize:13, fontWeight:600, color:'var(--text-3)', marginLeft:6 }}>
              {items.length} {items.length === 1 ? 'item' : 'itens'}
            </span>
          </div>
          <button onClick={close} style={{
            width:34, height:34, borderRadius:'var(--r-sm)',
            background:'var(--surface-2)', border:'1.5px solid var(--border)',
            cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
            color:'var(--text-2)', transition:'all .15s',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{
          flex:1, overflowY:'auto', padding:'16px 20px',
          display:'flex', flexDirection:'column', gap:10,
        }}>
          {items.length === 0 ? (
            <div style={{
              flex:1, display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center',
              padding:'40px 20px', textAlign:'center', gap:12,
            }}>
              <div style={{ fontSize:48, opacity:.35 }}>🛒</div>
              <div style={{ fontSize:16, fontWeight:700, color:'var(--text-2)' }}>
                Carrinho vazio
              </div>
              <div style={{ fontSize:13, color:'var(--text-3)', lineHeight:1.6 }}>
                Adicione produtos da loja para continuar.
              </div>
              <button onClick={close} style={{
                marginTop:8, padding:'10px 24px',
                background:'var(--brand)', color:'white', border:'none',
                borderRadius:'var(--r-md)', fontFamily:'inherit',
                fontSize:14, fontWeight:700, cursor:'pointer',
              }}>
                Ver produtos
              </button>
            </div>
          ) : items.map(item => (
            <div key={item.id} style={{
              display:'flex', alignItems:'center', gap:12,
              background:'var(--surface)', border:'1.5px solid var(--border)',
              borderRadius:'var(--r-md)', padding:12, boxShadow:'var(--shadow-xs)',
            }}>
              {/* Icon */}
              <div style={{
                width:44, height:44, borderRadius:'var(--r-sm)',
                background:'var(--surface-2)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:20, flexShrink:0,
              }}>
                {item.produto.icon ?? getCatIcon(item.produto.categoria)}
              </div>

              {/* Info */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{
                  fontSize:13, fontWeight:700, color:'var(--text-1)',
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                }}>
                  {item.produto.nome}
                </div>
                <div style={{ fontSize:11, color:'var(--text-3)', fontWeight:500, marginTop:2 }}>
                  {item.aluno.nome.split(' ')[0]} · {item.aluno.serie}
                </div>
                {item.variante && (
                  <div style={{ fontSize:11, color:'var(--brand)', fontWeight:700, marginTop:3 }}>
                    Tamanho {item.variante}
                  </div>
                )}
              </div>

              {/* Price */}
              <div style={{ fontSize:15, fontWeight:800, color:'var(--text-1)', whiteSpace:'nowrap' }}>
                {formatPrice(item.produto.preco)}
              </div>

              {/* Remove */}
              <button
                onClick={() => remove(item.id)}
                title="Remover"
                style={{
                  width:26, height:26, borderRadius:'50%', background:'none',
                  border:'1.5px solid var(--border)', cursor:'pointer',
                  color:'var(--text-3)', display:'flex', alignItems:'center',
                  justifyContent:'center', transition:'all .15s', flexShrink:0,
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.background = 'var(--danger-light)'
                  el.style.borderColor = 'var(--danger)'
                  el.style.color = 'var(--danger)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.background = 'none'
                  el.style.borderColor = 'var(--border)'
                  el.style.color = 'var(--text-3)'
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div style={{
            padding:'16px 20px', borderTop:'1px solid var(--border)',
            background:'var(--surface-2)',
            borderRadius:'0 0 0 var(--r-xl)',
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingBottom:14, borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontSize:16, fontWeight:700, color:'var(--text-1)' }}>Total</span>
              <span style={{ fontSize:24, fontWeight:800, color:'var(--text-1)', letterSpacing:'-.03em' }}>
                {formatPrice(total)}
              </span>
            </div>
            <button onClick={goToCheckout} style={{
              width:'100%', marginTop:14,
              background:'var(--brand)', color:'white', border:'none',
              borderRadius:'var(--r-md)', height:52, fontFamily:'inherit',
              fontSize:15, fontWeight:700, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              transition:'all .2s var(--ease)',
              boxShadow:'0 4px 14px rgba(26,47,90,.35)',
              letterSpacing:'-.01em',
            }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.background = '#243b70'
                el.style.transform = 'translateY(-1px)'
                el.style.boxShadow = '0 6px 20px rgba(26,47,90,.45)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.background = 'var(--brand)'
                el.style.transform = 'translateY(0)'
                el.style.boxShadow = '0 4px 14px rgba(26,47,90,.35)'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/>
                <line x1="12" y1="22" x2="12" y2="7"/>
                <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/>
                <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/>
              </svg>
              Finalizar Compra
            </button>
          </div>
        )}
      </div>
    </>
  )
}

function getCatIcon(cat: string) {
  const icons: Record<string, string> = {
    eventos:'🎉', passeios:'🚌', segunda_chamada:'📝',
    materiais:'📚', uniforme:'👕', outros:'📦',
  }
  return icons[cat] ?? '📦'
}

function formatPrice(value: number) {
  return value.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })
}
