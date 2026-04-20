import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PrivacidadeClient } from './PrivacidadeClient'

export const metadata = { title: 'Privacidade e dados — Perfil' }

export default async function PrivacidadePerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const isAdmin = user.app_metadata?.role === 'admin'
  return <PrivacidadeClient userEmail={user.email ?? ''} isAdmin={isAdmin} />
}
