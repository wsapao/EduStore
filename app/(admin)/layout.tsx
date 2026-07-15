import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getEscolaByUser, escolaThemeStyle } from '@/lib/escola/getEscola'
import { currentPermissions, podeAcessarAdmin } from '@/lib/permissoes'
import { AdminShell } from './AdminShell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const permissoes = await currentPermissions()
  if (!podeAcessarAdmin(permissoes)) redirect('/loja')

  const iniciais = (user.email ?? 'AD').slice(0, 2).toUpperCase()
  const escola = await getEscolaByUser(user.id)

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: escolaThemeStyle(escola) }} />
      <AdminShell escolaNome={escola.nome} iniciais={iniciais} permissoes={permissoes}>
        {children}
      </AdminShell>
    </>
  )
}
