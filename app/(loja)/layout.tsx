import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CartProvider } from '@/components/loja/CartProvider'
import { CartDrawer } from '@/components/loja/CartDrawer'
import { CartBar } from '@/components/loja/CartBar'
import { BottomNavigation } from '@/components/loja/BottomNavigation'
import { escolaThemeStyle, ESCOLA_FALLBACK } from '@/lib/escola/getEscola'
import { getUserPermissions, podeAcessarAdmin } from '@/lib/permissoes'
import type { Escola } from '@/types/database'

export default async function LojaLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 1 query com join em vez de 2 sequenciais (responsaveis + getEscolaByUser)
  const [{ data: resp }, permissoes] = await Promise.all([
    supabase
      .from('responsaveis')
      .select('*, escola:escolas(*)')
      .eq('id', user.id)
      .single(),
    getUserPermissions(supabase),
  ])

  if (!resp) redirect('/login')

  const escola = ((resp as { escola?: Escola | null }).escola ?? ESCOLA_FALLBACK) as Escola

  return (
    <CartProvider>
      <style dangerouslySetInnerHTML={{ __html: escolaThemeStyle(escola) }} />
      <div style={{ minHeight:'100vh', background:'var(--bg)', paddingBottom: '64px' }}>
        {children}
      </div>
      <CartDrawer />
      <CartBar />
      <BottomNavigation showAdminShortcut={podeAcessarAdmin(permissoes)} />
    </CartProvider>
  )
}
