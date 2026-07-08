'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ReceiptText,
  PackageSearch,
  Users,
  GraduationCap,
  Camera,
  ClipboardList,
  Coffee,
  Store,
  Tags,
  Ticket,
  TrendingUp,
  Trophy,
  ExternalLink,
  LogOut,
  Settings,
} from 'lucide-react'
import { XkolaMark } from '@/components/brand/XkolaMark'

// Simulando a action caso seja passada via props ou usada em client form
import { logoutAction } from '@/app/actions/auth'
import { ADMIN_SIDEBAR_CLASS_NAME } from '@/lib/admin-shell-layout'
import type { AdminShellTheme } from '@/lib/admin-shell-theme'
import { LOJA_BRAND_NAME } from '@/lib/loja/brand'

type LinkItem = {
  href: string
  label: string
  icon: any
  perm: string | null  // null = sempre mostra (ex: dashboard)
}

export function AdminSidebar({
  escolaNome,
  iniciais,
  permissoes,
  theme,
}: {
  escolaNome: string
  iniciais: string
  permissoes: string[]
  theme: AdminShellTheme
}) {
  const pathname = usePathname()
  const allowed = (p: string | null) => p === null || permissoes.includes(p)
  const markTheme = theme.name === 'creative-light' ? 'light' : 'dark'

  const mainLinks: LinkItem[] = [
    { href: '/admin',              label: 'Dashboard',       icon: LayoutDashboard, perm: null },
    { href: '/admin/pedidos',      label: 'Pedidos',         icon: ReceiptText,     perm: 'pedidos.ver' },
    { href: '/admin/concurso',     label: 'Concurso',        icon: Trophy,          perm: 'concurso.ver' },
    { href: '/admin/produtos',     label: 'Produtos',        icon: PackageSearch,   perm: 'produtos.ver' },
    { href: '/admin/responsaveis', label: 'Responsáveis',    icon: Users,           perm: 'responsaveis.ver' },
    { href: '/admin/alunos',       label: 'Alunos',          icon: GraduationCap,   perm: 'alunos.ver' },
    { href: '/admin/checkin',      label: 'Check-in',        icon: Camera,          perm: 'checkin.usar' },
    { href: '/admin/relatorio',    label: 'Relatório',       icon: ClipboardList,   perm: 'relatorios.ver' },
    { href: '/admin/receita',      label: 'Receita Líquida', icon: TrendingUp,      perm: 'receita.ver' },
    { href: '/admin/cantina',      label: 'Cantina',         icon: Coffee,          perm: 'cantina.ver' },
    { href: '/admin/pdv',          label: 'PDV Balcão',      icon: Store,           perm: 'pdv.usar' },
  ].filter(l => allowed(l.perm))

  const settingsLinks: LinkItem[] = [
    { href: '/admin/produtos/categorias', label: 'Categorias',    icon: Tags,     perm: 'categorias.ver' },
    { href: '/admin/vouchers',            label: 'Vouchers',      icon: Ticket,   perm: 'vouchers.ver' },
    { href: '/admin/configuracoes',       label: 'Configurações', icon: Settings, perm: 'configuracoes.ver' },
  ].filter(l => allowed(l.perm))

  return (
    <aside className={ADMIN_SIDEBAR_CLASS_NAME} style={{
      width: 260,
      background: theme.sidebarBackground,
      backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      borderRight: `1px solid ${theme.sidebarBorder}`,
      padding: '24px 20px',
      position: 'fixed',
      top: 0, bottom: 0, left: 0,
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Logo */}
      <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 40, paddingLeft: 12 }}>
        <XkolaMark theme={markTheme} size={34} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 16, fontWeight: 900, fontFamily: 'var(--font-bricolage), "Plus Jakarta Sans", sans-serif', color: theme.titleColor, letterSpacing: '-.02em', lineHeight: 1 }}>
            {LOJA_BRAND_NAME}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: theme.subtitleColor, letterSpacing: '.05em', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
            {escolaNome}
          </span>
        </div>
      </Link>

      {/* Nav links */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, overflowY: 'auto' }} className="no-scrollbar">
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: theme.sectionLabelColor, marginBottom: 8, paddingLeft: 12 }}>
          Menu Principal
        </div>

        {mainLinks.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 12,
              fontSize: 14, fontWeight: isActive ? 800 : 600,
              color: isActive ? theme.navTextActive : theme.navText,
              background: isActive ? theme.navActiveBackground : 'transparent',
              textDecoration: 'none', transition: 'all .2s ease',
              position: 'relative',
              boxShadow: isActive && theme.name === 'creative-light' ? '0 10px 25px rgba(249,115,22,.12)' : 'none',
              border: isActive && theme.name === 'creative-light' ? '1px solid rgba(249,115,22,.16)' : '1px solid transparent',
            }}
            className={!isActive ? theme.navHoverClassName : ""}
            >
              {isActive && (
                <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 4, height: 16, background: theme.navIndicator, borderRadius: '0 4px 4px 0' }} />
              )}
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} style={{ color: isActive ? theme.navIconActive : 'inherit' }} />
              <span>{label}</span>
            </Link>
          )
        })}

        {/* Configurações */}
        {settingsLinks.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: theme.sectionLabelColor, marginBottom: 8, paddingLeft: 12 }}>
              Ajustes
            </div>
            {settingsLinks.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href
              return (
                <Link key={href} href={href} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', borderRadius: 12,
                  fontSize: 14, fontWeight: isActive ? 800 : 600,
                  color: isActive ? theme.navTextActive : theme.navText,
                  background: isActive ? theme.navActiveBackground : 'transparent',
                  textDecoration: 'none', transition: 'all .2s ease',
                  position: 'relative',
                  boxShadow: isActive && theme.name === 'creative-light' ? '0 10px 25px rgba(249,115,22,.12)' : 'none',
                  border: isActive && theme.name === 'creative-light' ? '1px solid rgba(249,115,22,.16)' : '1px solid transparent',
                }}
                className={!isActive ? theme.navHoverClassName : ""}
                >
                  {isActive && (
                    <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 4, height: 16, background: theme.navIndicator, borderRadius: '0 4px 4px 0' }} />
                  )}
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} style={{ color: isActive ? theme.navIconActive : 'inherit' }} />
                  <span>{label}</span>
                </Link>
              )
            })}
          </div>
        )}
      </nav>

      {/* Bottom Actions */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 24, borderTop: `1px solid ${theme.sidebarBorder}` }}>
        <Link href="/loja" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 12,
          fontSize: 13, fontWeight: 700, color: theme.buttonText,
          textDecoration: 'none', transition: 'all .2s'
        }}
        className={theme.name === 'creative-light' ? 'hover:translate-x-1' : 'hover:text-white hover:bg-white/5'}
        >
          <ExternalLink size={16} strokeWidth={2} />
          <span>Abrir Loja Online</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: theme.bottomCardBackground, padding: '10px 12px', borderRadius: 16, border: theme.bottomCardBorder }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: theme.logoGradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', border: theme.name === 'creative-light' ? '1px solid rgba(249,115,22,.16)' : '1px solid rgba(255,255,255,0.1)' }}>
              {iniciais}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: theme.titleColor }}>Admin</span>
            </div>
          </div>
          <form action={logoutAction}>
            <button type="submit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: theme.buttonBackground, border: 'none', cursor: 'pointer', color: theme.buttonText, transition: 'all .2s' }} className={theme.buttonHoverClassName} title="Sair">
              <LogOut size={16} strokeWidth={2} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}
