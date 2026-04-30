'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ReceiptText,
  PackageSearch,
  Users,
  GraduationCap,
  Store
} from 'lucide-react'

export function AdminMobileNav() {
  const pathname = usePathname()

  const links = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/pedidos', label: 'Pedidos', icon: ReceiptText },
    { href: '/admin/responsaveis', label: 'Pessoas', icon: Users },
    { href: '/admin/alunos', label: 'Alunos', icon: GraduationCap },
    { href: '/admin/produtos', label: 'Produtos', icon: PackageSearch },
    { href: '/admin/pdv', label: 'PDV', icon: Store },
  ]

  return (
    <nav className="md-hide fixed bottom-0 left-0 right-0 z-[100] flex h-[68px] bg-[#0a1628]/95 backdrop-blur-xl border-t border-white/5 pb-safe">
      {links.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href
        return (
          <Link key={href} href={href} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 4,
            textDecoration: 'none', 
            color: isActive ? '#f59e0b' : '#64748b',
            position: 'relative'
          }}>
            {isActive && (
              <div style={{ position: 'absolute', top: 0, width: 24, height: 2, background: '#f59e0b', borderRadius: '0 0 4px 4px' }} />
            )}
            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} style={{ marginTop: isActive ? 2 : 0, transition: 'all 0.2s' }} />
            <span style={{ fontSize: 10, fontWeight: isActive ? 800 : 600 }}>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
