import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CartProvider } from '@/components/loja/CartProvider'
import { LojaHeader } from '@/components/loja/LojaHeader'
import { CartDrawer } from '@/components/loja/CartDrawer'
import { CartBar } from '@/components/loja/CartBar'
import { getEscolaByUser, escolaThemeStyle } from '@/lib/escola/getEscola'
import type { Responsavel } from '@/types/database'

export default async function LojaLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: responsavel } = await supabase
    .from('responsaveis')
    .select('*')
    .eq('id', user.id)
    .single<Responsavel>()

  if (!responsavel) redirect('/login')

  const escola = await getEscolaByUser(user.id)

  return (
    <CartProvider>
      <style dangerouslySetInnerHTML={{ __html: escolaThemeStyle(escola) }} />
      <div style={{ minHeight:'100vh', background:'var(--bg)', paddingBottom:100 }}>
        <LojaHeader responsavel={responsavel} escola={escola} />
        {children}
      </div>
      <CartDrawer />
      <CartBar />
    </CartProvider>
  )
}
