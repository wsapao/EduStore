'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, Store } from 'lucide-react'

import { logoutAction } from '@/app/actions/auth'
import { AdminMobileNav } from '@/app/(admin)/AdminMobileNav'
import { AdminSidebar } from '@/app/(admin)/AdminSidebar'
import { XkolaMark } from '@/components/brand/XkolaMark'
import {
  ADMIN_SHELL_CONTENT_CLASS_NAME,
  ADMIN_SHELL_MAIN_CLASS_NAME,
  getAdminShellContentStyle,
  getAdminShellMainStyle,
} from '@/lib/admin-shell-layout'
import { getAdminShellTheme, resolveAdminShellThemeName } from '@/lib/admin-shell-theme'
import { LOJA_BRAND_NAME } from '@/lib/loja/brand'

export function AdminShell({
  children,
  escolaNome,
  iniciais,
  permissoes,
}: {
  children: React.ReactNode
  escolaNome: string
  iniciais: string
  permissoes: string[]
}) {
  const pathname = usePathname()
  const theme = getAdminShellTheme(resolveAdminShellThemeName(pathname))
  const markTheme = theme.name === 'creative-light' ? 'light' : 'dark'
  const shellStyle = {
    minHeight: '100dvh',
    background: theme.rootBackground,
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    display: 'flex',
    ...(theme.shellVariables ?? {}),
  } as React.CSSProperties

  return (
    <div style={shellStyle}>
      <AdminSidebar escolaNome={escolaNome} iniciais={iniciais} permissoes={permissoes} theme={theme} />

      <div className={ADMIN_SHELL_MAIN_CLASS_NAME} style={getAdminShellMainStyle()}>
        <header
          className="md-hide"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 90,
            height: 64,
            background: theme.headerBackground,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            borderBottom: `1px solid ${theme.headerBorder}`,
          }}
        >
          <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <XkolaMark theme={markTheme} width={34} height={25} />
            <span style={{ fontSize: 15, fontWeight: 900, color: theme.titleColor }}>{LOJA_BRAND_NAME}</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link
              href="/loja"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: 10,
                textDecoration: 'none',
                color: theme.buttonText,
              }}
            >
              <Store size={18} strokeWidth={2.2} />
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'none',
                  border: 'none',
                  color: theme.buttonText,
                }}
              >
                <LogOut size={18} strokeWidth={2.2} />
              </button>
            </form>
          </div>
        </header>

        <main className={ADMIN_SHELL_CONTENT_CLASS_NAME} style={getAdminShellContentStyle()}>{children}</main>
      </div>

      <AdminMobileNav permissoes={permissoes} theme={theme} />
    </div>
  )
}
