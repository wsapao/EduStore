import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { hasPermission } from '@/lib/permissoes'
import { ConvidarForm } from './ConvidarForm'
import { UsuarioRow } from './UsuarioRow'

type Vinculo = {
  user_id: string
  papel_id: string
  suspenso: boolean
  papel: { id: string; nome: string; chave_preset: string | null } | null
}

type AuthMeta = {
  email: string | null
  nome: string | null
  last_sign_in_at: string | null
}

export type UsuarioListItem = {
  user_id: string
  email: string | null
  nome: string | null
  papel_id: string
  papel_nome: string
  papel_chave_preset: string | null
  suspenso: boolean
  last_sign_in_at: string | null
}

export default async function UsuariosListPage() {
  if (!(await hasPermission('configuracoes.gerenciar_usuarios'))) {
    redirect('/admin/configuracoes')
  }

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) {
    return (
      <div>
        <Header />
        <p style={{ color: '#94a3b8' }}>Sua conta não está vinculada a uma escola.</p>
      </div>
    )
  }

  const { data: { user: currentUser } } = await supabase.auth.getUser()

  const { data: vinculosRaw } = await supabase
    .from('usuario_papel')
    .select('user_id, papel_id, suspenso, papel:papeis(id, nome, chave_preset)')
    .eq('escola_id', escolaId)
    .order('suspenso')

  const vinculos = (vinculosRaw ?? []) as unknown as Vinculo[]

  // Lê emails / nomes / last_sign_in via admin (a anon API não expõe)
  const adminClient = createAdminClient()
  const authMap: Record<string, AuthMeta> = {}
  await Promise.all(vinculos.map(async v => {
    const { data } = await adminClient.auth.admin.getUserById(v.user_id)
    if (data?.user) {
      authMap[v.user_id] = {
        email: data.user.email ?? null,
        nome: ((data.user.user_metadata as any)?.nome ?? null) as string | null,
        last_sign_in_at: data.user.last_sign_in_at ?? null,
      }
    }
  }))

  const usuarios: UsuarioListItem[] = vinculos.map(v => ({
    user_id: v.user_id,
    email: authMap[v.user_id]?.email ?? null,
    nome: authMap[v.user_id]?.nome ?? null,
    papel_id: v.papel_id,
    papel_nome: v.papel?.nome ?? '—',
    papel_chave_preset: v.papel?.chave_preset ?? null,
    suspenso: v.suspenso,
    last_sign_in_at: authMap[v.user_id]?.last_sign_in_at ?? null,
  }))

  // Lista de papéis disponíveis pra reatribuição
  const { data: papeisRaw } = await supabase
    .from('papeis')
    .select('id, nome, chave_preset, preset')
    .eq('escola_id', escolaId)
    .order('preset', { ascending: false })
    .order('nome')

  const papeis = (papeisRaw ?? []) as Array<{ id: string; nome: string; chave_preset: string | null; preset: boolean }>

  return (
    <div>
      <Header />

      <section style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        padding: 16,
        marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc', marginBottom: 12 }}>
          Convidar novo usuário
        </h2>
        <ConvidarForm papeis={papeis} />
      </section>

      <section>
        <h2 style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc', marginBottom: 12 }}>
          Usuários ({usuarios.length})
        </h2>
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          overflow: 'hidden',
        }}>
          {usuarios.length === 0 ? (
            <p style={{ padding: 20, color: '#94a3b8', fontSize: 13 }}>Nenhum usuário ainda. Use o formulário acima para convidar.</p>
          ) : usuarios.map(u => (
            <UsuarioRow
              key={u.user_id}
              usuario={u}
              papeis={papeis}
              isSelf={currentUser?.id === u.user_id}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function Header() {
  return (
    <div style={{ marginBottom: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginBottom: 6 }}>
        Usuários
      </h1>
      <p style={{ color: '#94a3b8', fontSize: 13 }}>
        Convide membros da equipe, atribua papéis e suspenda acessos.
      </p>
    </div>
  )
}
