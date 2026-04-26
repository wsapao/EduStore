"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Store, ShoppingBag, Utensils, User } from 'lucide-react'
import { useCart } from './CartProvider'

export function BottomNavigation() {
  const pathname = usePathname()
  const { items: cartItems } = useCart()

  // Mostrar apenas nas rotas raiz
  const isRootPath = ['/loja', '/pedidos', '/cantina', '/perfil'].includes(pathname)
  if (!isRootPath) return null

  const items = [
    { label: 'Loja', href: '/loja', icon: Store },
    { label: 'Pedidos', href: '/pedidos', icon: ShoppingBag },
    { label: 'Cantina', href: '/cantina', icon: Utensils },
    { label: 'Perfil', href: '/perfil', icon: User },
  ]

  const cartItemsCount = cartItems.length

  return (
    <nav className="fixed bottom-0 w-full bg-white/96 backdrop-blur-[24px] border-t border-black/5 z-40 flex items-center justify-around pb-safe pt-1 px-1">
      {items.map((item) => {
        const isActive = pathname === item.href
        const Icon = item.icon

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-[11px] transition-colors ${
              isActive ? 'bg-[#fef9ec] text-[#b45309]' : 'text-[#9ca3af]'
            }`}
          >
            <div className="relative mb-0.5">
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              {item.href === '/loja' && cartItemsCount > 0 && (
                <span className="absolute -top-1 -right-1.5 w-[14px] h-[14px] bg-red-500 rounded-full border-2 border-white flex items-center justify-center animate-pulseRing">
                  <span className="sr-only">{cartItemsCount} itens no carrinho</span>
                </span>
              )}
            </div>
            <span className={`text-[9px] font-[700]`}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
