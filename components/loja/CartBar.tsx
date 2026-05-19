'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { useCart } from './CartProvider'

// Rotas onde o usuário já está finalizando ou consultando o pedido — o
// CTA flutuante do carrinho atrapalha e confunde.
const ROTAS_SEM_CARRINHO_FLUTUANTE = ['/checkout', '/pedido', '/pedidos']

export function CartBar() {
  const { items, total, open, isOpen } = useCart()
  const pathname = usePathname()

  const escondidoNestaRota = ROTAS_SEM_CARRINHO_FLUTUANTE.some(
    (prefixo) => pathname === prefixo || pathname.startsWith(`${prefixo}/`),
  )

  if (items.length === 0 || isOpen || escondidoNestaRota) return null

  return (
    <div className="fixed left-0 right-0 z-[150] px-[18px] pb-[16px] animate-slideCart"
      style={{
        bottom: '64px', // Fica acima da Bottom Navigation
        background: 'linear-gradient(to top, #f0f2f8 70%, transparent)',
      }}
    >
      <div
        onClick={open}
        className="w-full h-[56px] rounded-[18px] flex items-center justify-between px-4 cursor-pointer max-w-[560px] mx-auto active:scale-[0.98] transition-transform duration-200"
        style={{
          background: 'linear-gradient(135deg, #f59e0b, #f59e0bdd)',
          boxShadow: '0 8px 24px rgba(245,158,11,.55)',
        }}
      >
        <div className="w-[30px] h-[30px] rounded-full bg-black/10 flex items-center justify-center text-[11px] font-[900] text-[#78350f]">
          {items.length}
        </div>

        <div className="text-[14px] font-[800] text-[#78350f] tracking-tight">
          Ver carrinho
        </div>

        <div className="text-[14px] font-[900] text-[#78350f]">
          {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </div>
      </div>
    </div>
  )
}
