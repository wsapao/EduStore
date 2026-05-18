'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ReceiptText, PackageSearch, Users, GraduationCap, Store,
} from 'lucide-react'
import { ADMIN_MOBILE_NAV_CLASS_NAME } from '@/lib/admin-shell-layout'
import type { AdminShellTheme } from '@/lib/admin-shell-theme'

type MobileLink = { href: string; label: string; icon: any; perm: string | null }

export function AdminMobileNav({ permissoes, theme }: { permissoes: string[]; theme: AdminShellTheme }) {
  const pathname = usePathname()
  const allowed = (p: string | null) => p === null || permissoes.includes(p)

  const links: MobileLink[] = [
    { href: '/admin',              label: 'Dashboard', icon: LayoutDashboard, perm: null },
    { href: '/admin/pedidos',      label: 'Pedidos',   icon: ReceiptText,     perm: 'pedidos.ver' },
    { href: '/admin/responsaveis', label: 'Pessoas',   icon: Users,           perm: 'responsaveis.ver' },
    { href: '/admin/alunos',       label: 'Alunos',    icon: GraduationCap,   perm: 'alunos.ver' },
    { href: '/admin/produtos',     label: 'Produtos',  icon: PackageSearch,   perm: 'produtos.ver' },
    { href: '/admin/pdv',          label: 'PDV',       icon: Store,           perm: 'pdv.usar' },
  ].filter(l => allowed(l.perm))

  return (
    <nav
      className={ADMIN_MOBILE_NAV_CLASS_NAME}
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        display: 'flex',
        height: 68,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: theme.headerBackground,
        borderTop: `1px solid ${theme.headerBorder}`,
      }}
    >
      {links.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href
        return (
          <Link key={href} href={href} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 4,
            textDecoration: 'none',
            color: isActive ? theme.navIconActive : theme.buttonText,
            position: 'relative'
          }}>
            {isActive && (
              <div style={{ position: 'absolute', top: 0, width: 24, height: 2, background: theme.navIndicator, borderRadius: '0 0 4px 4px' }} />
            )}
            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} style={{ marginTop: isActive ? 2 : 0, transition: 'all 0.2s' }} />
            <span style={{ fontSize: 10, fontWeight: isActive ? 800 : 600 }}>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
