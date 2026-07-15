import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserPermissions, podeAcessarAdmin } from '@/lib/permissoes'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Mesmo critério do login e do guard do /admin: qualquer papel de equipe
  // entra pelo painel; responsáveis sem papel vão para a vitrine.
  const permissoes = await getUserPermissions(supabase)
  redirect(podeAcessarAdmin(permissoes) ? '/admin' : '/loja')
}
