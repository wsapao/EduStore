'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, ReceiptText, PackageSearch, GraduationCap, Store, MoreHorizontal,
  Users, Camera, ClipboardList, TrendingUp, Coffee, Tags, Ticket, Settings, Trophy,
  ExternalLink, LogOut, X,
} from 'lucide-react'
import { ADMIN_MOBILE_NAV_CLASS_NAME } from '@/lib/admin-shell-layout'
import type { AdminShellTheme } from '@/lib/admin-shell-theme'
import { logoutAction } from '@/app/actions/auth'

type MobileLink = { href: string; label: string; icon: any; perm: string | null }

// 5 itens fixos no rodapé + botão "Mais" que abre o drawer com o resto.
const PRIMARY_LINKS: MobileLink[] = [
  { href: '/admin',          label: 'Dashboard', icon: LayoutDashboard, perm: null },
  { href: '/admin/pedidos',  label: 'Pedidos',   icon: ReceiptText,     perm: 'pedidos.ver' },
  { href: '/admin/produtos', label: 'Produtos',  icon: PackageSearch,   perm: 'produtos.ver' },
  { href: '/admin/alunos',   label: 'Alunos',    icon: GraduationCap,   perm: 'alunos.ver' },
  { href: '/admin/pdv',      label: 'PDV',       icon: Store,           perm: 'pdv.usar' },
]

const MORE_LINKS: MobileLink[] = [
  { href: '/admin/concurso',            label: 'Concurso',        icon: Trophy,        perm: 'concurso.ver' },
  { href: '/admin/responsaveis',        label: 'Responsáveis',    icon: Users,         perm: 'responsaveis.ver' },
  { href: '/admin/checkin',             label: 'Check-in',        icon: Camera,        perm: 'checkin.usar' },
  { href: '/admin/relatorio',           label: 'Relatório',       icon: ClipboardList, perm: 'relatorios.ver' },
  { href: '/admin/receita',             label: 'Receita Líquida', icon: TrendingUp,    perm: 'receita.ver' },
  { href: '/admin/cantina',             label: 'Cantina',         icon: Coffee,        perm: 'cantina.ver' },
  { href: '/admin/produtos/categorias', label: 'Categorias',      icon: Tags,          perm: 'categorias.ver' },
  { href: '/admin/vouchers',            label: 'Vouchers',        icon: Ticket,        perm: 'vouchers.ver' },
  { href: '/admin/configuracoes',       label: 'Configurações',   icon: Settings,      perm: 'configuracoes.ver' },
]

export function AdminMobileNav({ permissoes, theme }: { permissoes: string[]; theme: AdminShellTheme }) {
  const pathname = usePathname()
  const [openMore, setOpenMore] = useState(false)
  const allowed = (p: string | null) => p === null || permissoes.includes(p)

  const primary = PRIMARY_LINKS.filter(l => allowed(l.perm))
  const more = MORE_LINKS.filter(l => allowed(l.perm))

  const moreActive = more.some(l => pathname === l.href || pathname.startsWith(l.href + '/'))

  return (
    <>
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
        {primary.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link key={href} href={href} style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 4,
              textDecoration: 'none',
              color: isActive ? theme.navIconActive : theme.buttonText,
              position: 'relative',
            }}>
              {isActive && (
                <div style={{ position: 'absolute', top: 0, width: 24, height: 2, background: theme.navIndicator, borderRadius: '0 0 4px 4px' }} />
              )}
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} style={{ marginTop: isActive ? 2 : 0, transition: 'all 0.2s' }} />
              <span style={{ fontSize: 10, fontWeight: isActive ? 800 : 600 }}>{label}</span>
            </Link>
          )
        })}

        {more.length > 0 && (
          <button
            type="button"
            onClick={() => setOpenMore(true)}
            aria-label="Mais opções"
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 4,
              background: 'none', border: 'none', cursor: 'pointer',
              color: moreActive ? theme.navIconActive : theme.buttonText,
              position: 'relative', padding: 0,
            }}
          >
            {moreActive && (
              <div style={{ position: 'absolute', top: 0, width: 24, height: 2, background: theme.navIndicator, borderRadius: '0 0 4px 4px' }} />
            )}
            <MoreHorizontal size={22} strokeWidth={moreActive ? 2.5 : 2} />
            <span style={{ fontSize: 10, fontWeight: moreActive ? 800 : 600 }}>Mais</span>
          </button>
        )}
      </nav>

      {openMore && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpenMore(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(15,23,42,0.45)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-end',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              background: theme.sidebarBackground,
              borderTop: `1px solid ${theme.sidebarBorder}`,
              borderRadius: '20px 20px 0 0',
              padding: '12px 16px calc(env(safe-area-inset-bottom, 0px) + 20px)',
              boxShadow: '0 -20px 60px rgba(15,23,42,0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 8 }}>
              <div style={{ width: 40, height: 4, borderRadius: 999, background: theme.sidebarBorder }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: theme.titleColor }}>Menu</span>
              <button
                type="button"
                onClick={() => setOpenMore(false)}
                aria-label="Fechar"
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: theme.buttonBackground, border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: theme.buttonText, cursor: 'pointer',
                }}
              >
                <X size={18} strokeWidth={2.2} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              {more.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpenMore(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '12px 14px', borderRadius: 14,
                      fontSize: 13, fontWeight: isActive ? 800 : 600,
                      color: isActive ? theme.navTextActive : theme.navText,
                      background: isActive ? theme.navActiveBackground : theme.buttonBackground,
                      textDecoration: 'none',
                      border: isActive ? `1px solid ${theme.navIndicator}` : '1px solid transparent',
                    }}
                  >
                    <Icon size={18} strokeWidth={isActive ? 2.5 : 2} style={{ color: isActive ? theme.navIconActive : 'inherit', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                  </Link>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${theme.sidebarBorder}` }}>
              <Link
                href="/loja"
                onClick={() => setOpenMore(false)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '12px 14px', borderRadius: 12,
                  fontSize: 13, fontWeight: 700, color: theme.buttonText,
                  background: theme.buttonBackground, textDecoration: 'none',
                }}
              >
                <ExternalLink size={16} strokeWidth={2} />
                Abrir loja
              </Link>
              <form action={logoutAction} style={{ flex: 1 }}>
                <button
                  type="submit"
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '12px 14px', borderRadius: 12,
                    fontSize: 13, fontWeight: 700, color: '#b91c1c',
                    background: '#fee2e2', border: 'none', cursor: 'pointer',
                  }}
                >
                  <LogOut size={16} strokeWidth={2} />
                  Sair
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
