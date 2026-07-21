import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getEscolaByUser, escolaThemeStyle } from '@/lib/escola/getEscola'
import { getUnidadesDoAdmin } from '@/lib/escola/getUnidadesDoAdmin'
import { currentPermissions, podeAcessarAdmin } from '@/lib/permissoes'
import { isPreviewTemaAdmin, PREVIEW_ESCOLA_NOME, PREVIEW_PERMISSOES } from '@/lib/preview-tema/admin-mocks'
import { AdminShell } from './AdminShell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (isPreviewTemaAdmin()) {
    return (
      <AdminShell
        escolas={[{ id: 'preview', nome: PREVIEW_ESCOLA_NOME }]}
        escolaAtivaId="preview"
        iniciais="WS"
        permissoes={PREVIEW_PERMISSOES}
      >
        {children}
      </AdminShell>
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const permissoes = await currentPermissions()
  if (!podeAcessarAdmin(permissoes)) redirect('/loja')

  const iniciais = (user.email ?? 'AD').slice(0, 2).toUpperCase()
  // getEscolaByUser resolve por `responsaveis` (branding/tema) — asimétrico
  // em relação à unidade ativa quando o admin não tem linha em `responsaveis`
  // (caso comum de staff puro): aí cai no fallback genérico (ESCOLA_FALLBACK)
  // e o tema/logo não acompanha a troca de unidade. O NOME exibido na
  // sidebar, porém, vem de getUnidadesDoAdmin (staff-aware) — ver relatório.
  const escola = await getEscolaByUser(user.id)
  const { escolas, escolaAtivaId } = await getUnidadesDoAdmin(supabase)

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: escolaThemeStyle(escola) }} />
      <AdminShell escolas={escolas} escolaAtivaId={escolaAtivaId} iniciais={iniciais} permissoes={permissoes}>
        {children}
      </AdminShell>
    </>
  )
}
