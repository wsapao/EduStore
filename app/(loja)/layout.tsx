import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CartProvider } from '@/components/loja/CartProvider'
import { CartDrawer } from '@/components/loja/CartDrawer'
import { CartBar } from '@/components/loja/CartBar'
import { BottomNavigation } from '@/components/loja/BottomNavigation'
import { escolaThemeStyle, ESCOLA_FALLBACK } from '@/lib/escola/getEscola'
import type { Escola, Responsavel } from '@/types/database'

export default async function LojaLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 1 query com join em vez de 2 sequenciais (responsaveis + getEscolaByUser)
  const { data: resp } = await supabase
    .from('responsaveis')
    .select('*, escola:escolas(*)')
    .eq('id', user.id)
    .single()

  if (!resp) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const responsavel = resp as unknown as Responsavel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const escola: Escola = (resp as any).escola ?? ESCOLA_FALLBACK

  return (
    <CartProvider>
      <style dangerouslySetInnerHTML={{ __html: escolaThemeStyle(escola) }} />
      <div style={{ minHeight:'100vh', background:'var(--bg)', paddingBottom: '64px' }}>
        {children}
      </div>
      <CartDrawer />
      <CartBar />
      <BottomNavigation />
    </CartProvider>
  )
}
