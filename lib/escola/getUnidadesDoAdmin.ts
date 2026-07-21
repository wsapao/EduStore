import type { SupabaseClient } from '@supabase/supabase-js'
import { pickEscolaAtiva, type VinculoAtivo } from './pickEscolaAtiva'

export type UnidadeAdmin = { id: string; nome: string }

type VinculoRow = {
  id: string
  escola_id: string
  papel_id: string
  created_at: string
  // O client Supabase aqui não é tipado com o schema do banco (sem generic
  // `Database`), então o join `escola:escolas(nome)` é inferido como array
  // por padrão — mas em runtime, por ser N:1 (usuario_papel → escolas),
  // vem como objeto único. Aceita as duas formas defensivamente.
  escola: { nome: string } | { nome: string }[] | null
}

/**
 * Lista as unidades (escolas) às quais o staff autenticado tem vínculo
 * não-suspenso em usuario_papel, junto com a unidade ATIVA.
 *
 * A unidade ativa é resolvida com o MESMO pickEscolaAtiva usado por
 * getEscolaIdParaAdmin, para que as duas fontes nunca divirjam sobre
 * qual escola está selecionada.
 *
 * Alimenta o seletor de unidade no AdminSidebar. Este helper é
 * staff-only: sem vínculo em usuario_papel, retorna lista vazia (não
 * cai para `responsaveis` como getEscolaIdParaAdmin faz).
 */
export async function getUnidadesDoAdmin(
  supabase: SupabaseClient
): Promise<{ escolas: UnidadeAdmin[]; escolaAtivaId: string | null }> {
  const { data: userRes } = await supabase.auth.getUser()
  const user = userRes?.user
  if (!user) return { escolas: [], escolaAtivaId: null }

  const { data: vinculos } = await supabase
    .from('usuario_papel')
    .select('id, escola_id, papel_id, created_at, escola:escolas(nome)')
    .eq('user_id', user.id)
    .eq('suspenso', false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (vinculos ?? []) as any as VinculoRow[]
  if (rows.length === 0) return { escolas: [], escolaAtivaId: null }

  const { data: selecao } = await supabase
    .from('saas_unidade_ativa')
    .select('escola_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const vinculosAtivos: VinculoAtivo[] = rows.map((v) => ({
    escolaId: v.escola_id,
    papelId: v.papel_id,
    createdAt: v.created_at,
    vinculoId: v.id,
  }))

  const ativo = pickEscolaAtiva(vinculosAtivos, selecao?.escola_id ?? null)

  const nomesPorEscola = new Map<string, string>()
  for (const v of rows) {
    const escolaRel = Array.isArray(v.escola) ? v.escola[0] : v.escola
    const nome = escolaRel?.nome
    if (nome && !nomesPorEscola.has(v.escola_id)) nomesPorEscola.set(v.escola_id, nome)
  }

  const escolas: UnidadeAdmin[] = Array.from(nomesPorEscola, ([id, nome]) => ({ id, nome })).sort(
    (a, b) => a.nome.localeCompare(b.nome, 'pt-BR')
  )

  return { escolas, escolaAtivaId: ativo?.escolaId ?? null }
}
