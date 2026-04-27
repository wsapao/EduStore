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
  ExternalLink,
  LogOut
} from 'lucide-react'

// Simulando a action caso seja passada via props ou usada em client form
import { logoutAction } from '@/app/actions/auth'

export function AdminSidebar({
  escolaNome,
  iniciais
}: {
  escolaNome: string
  iniciais: string
}) {
  const pathname = usePathname()

  const mainLinks = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/pedidos', label: 'Pedidos', icon: ReceiptText },
    { href: '/admin/produtos', label: 'Produtos', icon: PackageSearch },
    { href: '/admin/responsaveis', label: 'Responsáveis', icon: Users },
    { href: '/admin/alunos', label: 'Alunos', icon: GraduationCap },
    { href: '/admin/checkin', label: 'Check-in', icon: Camera },
    { href: '/admin/relatorio', label: 'Relatório', icon: ClipboardList },
    { href: '/admin/receita', label: 'Receita Líquida', icon: TrendingUp },
    { href: '/admin/cantina', label: 'Cantina', icon: Coffee },
    { href: '/admin/pdv', label: 'PDV Balcão', icon: Store },
  ]

  const settingsLinks = [
    { href: '/admin/produtos/categorias', label: 'Categorias', icon: Tags },
    { href: '/admin/vouchers', label: 'Vouchers', icon: Ticket },
  ]

  return (
    <aside className="mobile-hide md-show-flex flex-col" style={{
      width: 260,
      background: 'rgba(10, 22, 40, 0.4)',
      backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      borderRight: '1px solid rgba(255,255,255,0.05)',
      padding: '24px 20px',
      position: 'fixed',
      top: 0, bottom: 0, left: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 40, paddingLeft: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(245,158,11,.3)' }}>
          <Store size={20} strokeWidth={2.5} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 16, fontWeight: 900, color: '#f8fafc', letterSpacing: '-.02em', lineHeight: 1 }}>
            EduStore
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', letterSpacing: '.05em', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
            {escolaNome}
          </span>
        </div>
      </Link>

      {/* Nav links */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, overflowY: 'auto' }} className="no-scrollbar">
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 8, paddingLeft: 12 }}>
          Menu Principal
        </div>
        
        {mainLinks.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 12,
              fontSize: 14, fontWeight: isActive ? 800 : 600, 
              color: isActive ? '#fff' : '#cbd5e1',
              background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
              textDecoration: 'none', transition: 'all .2s ease',
              position: 'relative'
            }}
            className={!isActive ? "hover:bg-white/5 hover:text-white hover:translate-x-1" : ""}
            >
              {isActive && (
                <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 4, height: 16, background: '#f59e0b', borderRadius: '0 4px 4px 0' }} />
              )}
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} style={{ color: isActive ? '#f59e0b' : 'inherit' }} />
              <span>{label}</span>
            </Link>
          )
        })}

        {/* Configurações */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 8, paddingLeft: 12 }}>
            Ajustes
          </div>
          {settingsLinks.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href
            return (
              <Link key={href} href={href} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 12,
                fontSize: 14, fontWeight: isActive ? 800 : 600, 
                color: isActive ? '#fff' : '#cbd5e1',
                background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                textDecoration: 'none', transition: 'all .2s ease',
                position: 'relative'
              }}
              className={!isActive ? "hover:bg-white/5 hover:text-white hover:translate-x-1" : ""}
              >
                {isActive && (
                  <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 4, height: 16, background: '#f59e0b', borderRadius: '0 4px 4px 0' }} />
                )}
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} style={{ color: isActive ? '#f59e0b' : 'inherit' }} />
                <span>{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Bottom Actions */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <Link href="/loja" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 12,
          fontSize: 13, fontWeight: 700, color: '#94a3b8',
          textDecoration: 'none', transition: 'all .2s'
        }}
        className="hover:text-white hover:bg-white/5"
        >
          <ExternalLink size={16} strokeWidth={2} />
          <span>Abrir Loja Online</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '10px 12px', borderRadius: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #1e3a8a, #1e40af)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
              {iniciais}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>Admin</span>
            </div>
          </div>
          <form action={logoutAction}>
            <button type="submit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', color: '#94a3b8', transition: 'all .2s' }} className="hover:bg-red-500/20 hover:text-red-400" title="Sair">
              <LogOut size={16} strokeWidth={2} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}
