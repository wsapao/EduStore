import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { logoutAction } from '@/app/actions/auth'
import { getEscolaByUser, escolaThemeStyle } from '@/lib/escola/getEscola'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Verifica se é admin pelo app_metadata (role definido via SQL no raw_app_meta_data)
  const isAdmin = user.app_metadata?.role === 'admin'
  if (!isAdmin) redirect('/loja')

  const iniciais = (user.email ?? 'AD').slice(0, 2).toUpperCase()
  const escola = await getEscolaByUser(user.id)

  return (
    <div style={{ minHeight: '100dvh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <style dangerouslySetInnerHTML={{ __html: escolaThemeStyle(escola) }} />

      {/* Top bar */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 200,
        height: 56, background: '#0f172a',
        display: 'flex', alignItems: 'center',
        padding: '0 20px', gap: 12,
        borderBottom: '1px solid #1e293b',
      }}>
        {/* Logo */}
        <Link href="/admin" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          textDecoration: 'none', flexShrink: 0,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>
            🏫
          </div>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-.01em' }}>
            Admin
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, color: '#94a3b8',
            background: '#1e293b', padding: '2px 6px', borderRadius: 4, letterSpacing: '.05em',
            maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {escola.nome.toUpperCase()}
          </span>
        </Link>

        <div style={{ flex: 1 }} />

        {/* Nav links — desktop */}
        <nav className="hidden md:flex gap-1">
          {[
            { href: '/admin', label: 'Dashboard', icon: '📊' },
            { href: '/admin/pedidos', label: 'Pedidos', icon: '🧾' },
            { href: '/admin/produtos', label: 'Produtos', icon: '📦' },
            { href: '/admin/responsaveis', label: 'Responsáveis', icon: '👥' },
            { href: '/admin/alunos', label: 'Alunos', icon: '🎒' },
            { href: '/admin/checkin', label: 'Check-in', icon: '📷' },
            { href: '/admin/relatorio', label: 'Relatório', icon: '📋' },
            { href: '/admin/cantina', label: 'Cantina', icon: '🍽️' },
          ].map(({ href, label, icon }) => (
            <Link key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 6,
              fontSize: 13, fontWeight: 600, color: '#94a3b8',
              textDecoration: 'none',
            }}>
              <span>{icon}</span>
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        {/* Avatar + sair */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#fff',
          }}>
            {iniciais}
          </div>
          <form action={logoutAction}>
            <button type="submit" style={{
              fontSize: 12, fontWeight: 600, color: '#94a3b8',
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px 8px', borderRadius: 4,
            }}>
              Sair
            </button>
          </form>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 w-full max-w-[1200px] mx-auto p-6 pb-24 md:pb-6">
        {children}
      </main>

      {/* Bottom nav — mobile */}
      <nav 
        className="md:hidden fixed bottom-0 left-0 right-0 z-[100] flex h-[60px] bg-slate-900 border-t border-slate-800"
      >
        {[
          { href: '/admin', label: 'Dashboard', icon: '📊' },
          { href: '/admin/pedidos', label: 'Pedidos', icon: '🧾' },
          { href: '/admin/responsaveis', label: 'Pessoas', icon: '👥' },
          { href: '/admin/alunos', label: 'Alunos', icon: '🎒' },
          { href: '/admin/produtos', label: 'Produtos', icon: '📦' },
          { href: '/loja', label: 'Loja', icon: '🏪' },
        ].map(({ href, label, icon }) => (
          <Link key={href} href={href} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 3,
            textDecoration: 'none', color: '#64748b',
            fontSize: 10, fontWeight: 600,
          }}>
            <span style={{ fontSize: 18 }}>{icon}</span>
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
