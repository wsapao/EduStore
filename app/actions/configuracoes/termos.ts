'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission, PermissionDeniedError } from '@/lib/permissoes'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { auditLog } from '@/lib/auditoria/log'

type TipoTermo = 'termos_uso' | 'privacidade'
const TIPOS_VALIDOS = new Set<TipoTermo>(['termos_uso', 'privacidade'])
const MIN_CONTEUDO = 50
const MAX_VERSOES_LISTADAS = 50

function tipoValido(t: string): t is TipoTermo {
  return TIPOS_VALIDOS.has(t as TipoTermo)
}

export async function publicarVersaoTermosAction(input: {
  tipo: TipoTermo
  conteudo: string
}): Promise<{ success: true; versao: number } | { error: string }> {
  try {
    await requirePermission('configuracoes.editar_identidade')
  } catch (e) {
    if (e instanceof PermissionDeniedError) return { error: 'Sem permissão.' }
    return { error: 'Sem permissão.' }
  }

  if (!tipoValido(input.tipo)) {
    return { error: 'Tipo inválido.' }
  }

  const conteudo = (input.conteudo ?? '').trim()
  if (conteudo.length < MIN_CONTEUDO) {
    return { error: `Conteúdo muito curto (mínimo ${MIN_CONTEUDO} caracteres).` }
  }

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? null

  const { data: maxRow, error: maxErr } = await supabase
    .from('termos_versoes')
    .select('versao')
    .eq('escola_id', escolaId)
    .eq('tipo', input.tipo)
    .order('versao', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (maxErr) {
    return { error: 'Erro ao calcular próxima versão.' }
  }

  const novaVersao = ((maxRow as any)?.versao ?? 0) + 1

  const { error: insertErr } = await supabase
    .from('termos_versoes')
    .insert({
      escola_id: escolaId,
      tipo: input.tipo,
      versao: novaVersao,
      conteudo,
      publicado_por: userId,
    })

  if (insertErr) {
    return { error: 'Erro ao publicar nova versão.' }
  }

  await auditLog({
    modulo: 'termos',
    acao: 'publicou_versao',
    metadata: { tipo: input.tipo, versao: novaVersao },
  })

  revalidatePath('/admin/configuracoes/termos')
  revalidatePath('/termos')
  revalidatePath('/privacidade')

  return { success: true, versao: novaVersao }
}

export async function listarVersoesTermosAction(input: {
  tipo: TipoTermo
}): Promise<{
  versoes: Array<{
    id: string
    versao: number
    publicado_em: string
    publicado_por_email: string | null
  }>
} | { error: string }> {
  try {
    await requirePermission('configuracoes.editar_identidade')
  } catch (e) {
    if (e instanceof PermissionDeniedError) return { error: 'Sem permissão.' }
    return { error: 'Sem permissão.' }
  }

  if (!tipoValido(input.tipo)) {
    return { error: 'Tipo inválido.' }
  }

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const { data, error } = await supabase
    .from('termos_versoes')
    .select('id, versao, publicado_em, publicado_por')
    .eq('escola_id', escolaId)
    .eq('tipo', input.tipo)
    .order('versao', { ascending: false })
    .limit(MAX_VERSOES_LISTADAS)

  if (error) return { error: 'Erro ao listar versões.' }

  const rows = (data ?? []) as Array<{
    id: string
    versao: number
    publicado_em: string
    publicado_por: string | null
  }>

  if (rows.length === 0) return { versoes: [] }

  let admin: ReturnType<typeof createAdminClient> | null = null
  try {
    admin = createAdminClient()
  } catch {
    // service role indisponível — devolvemos sem emails
    admin = null
  }

  const enriched = await Promise.all(
    rows.map(async (r) => {
      let email: string | null = null
      if (admin && r.publicado_por) {
        try {
          const res = await admin.auth.admin.getUserById(r.publicado_por)
          email = res?.data?.user?.email ?? null
        } catch {
          email = null
        }
      }
      return {
        id: r.id,
        versao: r.versao,
        publicado_em: r.publicado_em,
        publicado_por_email: email,
      }
    })
  )

  return { versoes: enriched }
}

export async function getVersaoAtualTermos(input: {
  tipo: TipoTermo
  escolaId: string
}): Promise<{ versao: number; conteudo: string; publicado_em: string } | null> {
  if (!tipoValido(input.tipo)) return null
  if (!input.escolaId) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('termos_versoes')
    .select('versao, conteudo, publicado_em')
    .eq('escola_id', input.escolaId)
    .eq('tipo', input.tipo)
    .order('versao', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return data as { versao: number; conteudo: string; publicado_em: string }
}
