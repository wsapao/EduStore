import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { hasPermission } from '@/lib/permissoes'
import { PapelCard } from './PapelCard'

type PapelComMeta = {
  id: string
  nome: string
  descricao: string | null
  preset: boolean
  chave_preset: string | null
  qtd_usuarios: number
  qtd_permissoes: number
}

export default async function PapeisListPage() {
  if (!(await hasPermission('configuracoes.gerenciar_papeis'))) {
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

  const { data: papeisRaw } = await supabase
    .from('papeis')
    .select('id, nome, descricao, preset, chave_preset')
    .eq('escola_id', escolaId)
    .order('preset', { ascending: false })
    .order('nome')

  const papeis = (papeisRaw ?? []) as Array<{
    id: string; nome: string; descricao: string | null; preset: boolean; chave_preset: string | null
  }>

  const ids = papeis.map(p => p.id)

  const [usosRes, permsRes] = await Promise.all([
    ids.length > 0
      ? supabase.from('usuario_papel').select('papel_id').in('papel_id', ids)
      : Promise.resolve({ data: [] as Array<{ papel_id: string }> }),
    ids.length > 0
      ? supabase.from('papel_permissoes').select('papel_id').in('papel_id', ids)
      : Promise.resolve({ data: [] as Array<{ papel_id: string }> }),
  ])

  const usosMap: Record<string, number> = {}
  for (const r of (usosRes.data ?? []) as Array<{ papel_id: string }>) {
    usosMap[r.papel_id] = (usosMap[r.papel_id] ?? 0) + 1
  }
  const permsMap: Record<string, number> = {}
  for (const r of (permsRes.data ?? []) as Array<{ papel_id: string }>) {
    permsMap[r.papel_id] = (permsMap[r.papel_id] ?? 0) + 1
  }

  const enriched: PapelComMeta[] = papeis.map(p => ({
    ...p,
    qtd_usuarios: usosMap[p.id] ?? 0,
    qtd_permissoes: permsMap[p.id] ?? 0,
  }))

  return (
    <div>
      <Header />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Link href="/admin/configuracoes/papeis/novo" style={btnPrimary}>
          + Novo papel
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {enriched.map(papel => (
          <PapelCard key={papel.id} papel={papel} />
        ))}
      </div>
    </div>
  )
}

function Header() {
  return (
    <div style={{ marginBottom: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginBottom: 6 }}>
        Papéis & Permissões
      </h1>
      <p style={{ color: '#94a3b8', fontSize: 13 }}>
        Defina quem acessa o quê. 6 presets de fábrica + papéis customizados.
      </p>
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  background: '#f59e0b',
  border: 'none',
  borderRadius: 10,
  padding: '8px 16px',
  color: '#0a1628',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-block',
}
