import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { logoutAction } from '@/app/actions/auth'
import { getEscolaByUser, escolaThemeStyle } from '@/lib/escola/getEscola'
import { AdminSidebar } from './AdminSidebar'
import { AdminMobileNav } from './AdminMobileNav'

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
    <div style={{ minHeight: '100dvh', background: 'radial-gradient(ellipse at 30% 20%, #1e3a5f 0%, #0a1628 60%)', fontFamily: '"Plus Jakarta Sans", sans-serif', display: 'flex' }}>
      <style dangerouslySetInnerHTML={{ __html: escolaThemeStyle(escola) }} />

      {/* SIDEBAR — Desktop */}
      <AdminSidebar escolaNome={escola.nome} iniciais={iniciais} />

      {/* MAIN CONTENT WRAPPER */}
      <div className="flex-1 md-sidebar-offset flex flex-col min-h-screen">
        
        {/* Header Mobile Only */}
        <header className="md-hide" style={{
          position: 'sticky', top: 0, zIndex: 90,
          height: 64, background: 'rgba(10, 22, 40, 0.85)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
              🏫
            </div>
            <span style={{ fontSize: 16, fontWeight: 900, color: '#f8fafc' }}>Admin</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/loja" style={{ fontSize: 20, textDecoration: 'none' }}>🏪</Link>
            <form action={logoutAction}>
              <button type="submit" style={{ fontSize: 20, background: 'none', border: 'none' }}>🚪</button>
            </form>
          </div>
        </header>

        {/* Conteúdo */}
        <main className="flex-1 w-full max-w-[1400px] mx-auto p-6 pb-28 md:pb-10 md:p-10">
          {children}
        </main>
      </div>

      {/* Bottom nav — mobile */}
      <AdminMobileNav />
    </div>
  )
}
