import { createClient } from '@/lib/supabase/server'
import LoginForm from './LoginForm'

export default async function LoginPage() {
  const supabase = await createClient()
  // Fetch default escola info
  const { data: escola } = await supabase.from('escolas').select('nome, logo_url').limit(1).maybeSingle()

  return <LoginForm logoUrl={escola?.logo_url} nome={escola?.nome} />
}
