'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useCart } from './CartProvider'
import { X, Trash2, ShoppingBag } from 'lucide-react'

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
        className="fixed inset-0 z-[300] transition-opacity duration-300"
        style={{
          background: 'rgba(10,22,40,0.4)',
          backdropFilter: 'blur(4px)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'all' : 'none',
        }}
      />

      {/* Drawer */}
      <div 
        className="fixed bottom-0 left-1/2 w-full max-w-[560px] bg-white z-[400] flex flex-col transition-transform duration-300 shadow-[0_-8px_40px_rgba(0,0,0,.15)]"
        style={{
          transform: isOpen ? 'translate(-50%, 0)' : 'translate(-50%, 110%)',
          borderRadius: '24px 24px 0 0',
          maxHeight: '85vh',
        }}
      >
        {/* Handle */}
        <div className="pt-3 pb-2 flex justify-center shrink-0">
          <div className="w-9 h-1.5 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="px-5 pb-4 border-b border-black/5 flex items-center justify-between shrink-0">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[18px] font-[900] text-[#0a1628] tracking-[-0.02em]">
              Seu carrinho
            </h2>
            <span className="text-[13px] font-[600] text-[#9ca3af]">
              {items.length} {items.length === 1 ? 'item' : 'itens'}
            </span>
          </div>
          <button 
            onClick={close}
            className="w-8 h-8 rounded-full bg-[#f8f9fd] border border-black/5 flex items-center justify-center text-[#6b7280] active:scale-95 transition-transform"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10 text-center gap-3">
              <div className="w-20 h-20 bg-[#f8f9fd] rounded-full flex items-center justify-center mb-2">
                <ShoppingBag size={32} className="text-[#9ca3af] opacity-50" />
              </div>
              <h3 className="text-[16px] font-[800] text-[#0a1628]">Carrinho vazio</h3>
              <p className="text-[13px] text-[#6b7280] font-medium leading-relaxed max-w-[240px]">
                Adicione alguns produtos incríveis da nossa loja para continuar.
              </p>
            </div>
          ) : items.map(item => (
            <div key={item.id} className="flex items-center gap-3 bg-white border border-black/5 rounded-[16px] p-3 shadow-sm">
              {/* Icon / Image */}
              {item.produto.imagem_url ? (
                <div className="w-12 h-12 rounded-[10px] relative overflow-hidden shrink-0 border border-black/5">
                  <Image src={item.produto.imagem_url} alt={item.produto.nome} fill sizes="48px" style={{ objectFit: 'cover' }} />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-[10px] bg-[#f8f9fd] flex items-center justify-center text-[24px] shrink-0 border border-black/5">
                  {item.produto.icon ?? getCatIcon(item.produto.categoria)}
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="text-[13px] font-[800] text-[#0a1628] whitespace-nowrap overflow-hidden text-ellipsis mb-0.5">
                  {item.produto.nome}
                </div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[11px] font-[600] text-[#6b7280]">
                    Para: {item.aluno.nome.split(' ')[0]}
                  </span>
                  {item.variante && (
                    <>
                      <span className="text-[#d1d5db]">•</span>
                      <span className="text-[11px] font-[800] text-[#b45309] bg-[#fef9ec] px-1.5 rounded-md">
                        Tamanho {item.variante}
                      </span>
                    </>
                  )}
                </div>
                <div className="text-[14px] font-[900] text-[#0a1628]">
                  {formatPrice(item.produto.preco_promocional ?? item.produto.preco)}
                </div>
              </div>

              {/* Remove */}
              <button
                onClick={() => remove(item.id)}
                title="Remover"
                className="w-9 h-9 rounded-full bg-[#fef2f2] text-red-500 flex items-center justify-center shrink-0 active:scale-95 transition-transform"
              >
                <Trash2 size={16} strokeWidth={2.5} />
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-5 border-t border-black/5 bg-white pb-safe">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[13px] font-[700] text-[#9ca3af] uppercase tracking-wider">Total</span>
              <span className="text-[22px] font-[900] text-[#0a1628] tracking-[-0.03em] leading-none">
                {formatPrice(total)}
              </span>
            </div>
            <button 
              onClick={goToCheckout} 
              className="w-full h-[52px] bg-[#16a34a] text-white rounded-[14px] flex items-center justify-center gap-2 text-[15px] font-[800] shadow-[0_4px_16px_rgba(22,163,74,.4)] active:scale-[0.98] transition-transform"
            >
              Finalizar Pedido
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    </>
  )
}

function getCatIcon(cat: string) {
  const icons: Record<string, string> = {
    eventos: '🎉', passeios: '🚌', segunda_chamada: '📝',
    materiais: '📚', uniforme: '👕', outros: '📦',
  }
  return icons[cat] ?? '📦'
}

function formatPrice(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
