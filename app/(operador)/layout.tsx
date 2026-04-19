import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logoutAction } from '@/app/actions/auth'

export default async function OperadorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const role = user.app_metadata?.role
  if (role !== 'operador' && role !== 'admin') redirect('/loja')

  const nomeOperador = user.email?.split('@')[0] ?? 'Operador'

  return (
    <div style={{ minHeight: '100dvh', background: '#f4f6f9', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 200,
        height: 64, background: '#1e3a5f',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', gap: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,.18)',
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>🍽️ Cantina · Operador</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.72)', marginTop: 2 }}>
            PDV — Ponto de venda
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            background: 'rgba(255,255,255,.12)', padding: '6px 12px',
            borderRadius: 999, fontSize: 12, fontWeight: 700, color: '#fff',
          }}>
            {nomeOperador}
          </div>
          <form action={logoutAction}>
            <button type="submit" style={{
              padding: '6px 12px', borderRadius: 8,
              background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)',
              color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
              Sair
            </button>
          </form>
        </div>
      </header>

      <main style={{ flex: 1, padding: '20px', maxWidth: 1180, margin: '0 auto', width: '100%' }}>
        {children}
      </main>
    </div>
  )
}
