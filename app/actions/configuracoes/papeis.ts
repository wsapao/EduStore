'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission, PermissionDeniedError, isValidPermissionKey } from '@/lib/permissoes'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'

const PERM_GUARD = 'configuracoes.gerenciar_papeis'

async function ensurePermissao(): Promise<{ error: string } | null> {
  try {
    await requirePermission(PERM_GUARD)
    return null
  } catch (e) {
    if (e instanceof PermissionDeniedError) return { error: 'Sem permissão.' }
    return { error: 'Sem permissão.' }
  }
}

function parseChavesValidando(formData: FormData): { chaves: string[]; error?: string } {
  const raw = formData.getAll('chaves').map(String)
  const chaves: string[] = []
  for (const c of raw) {
    if (!c) continue
    if (!isValidPermissionKey(c)) {
      return { chaves: [], error: `Chave de permissão desconhecida: ${c}` }
    }
    chaves.push(c)
  }
  return { chaves: Array.from(new Set(chaves)) }
}

// ── CRIAR ─────────────────────────────────────────────────────────────────────

export async function criarPapelAction(formData: FormData) {
  const denied = await ensurePermissao()
  if (denied) return denied

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const nome = (formData.get('nome') as string | null)?.trim() ?? ''
  const descricao = (formData.get('descricao') as string | null)?.trim() || null

  if (!nome || nome.length < 2) return { error: 'Nome do papel é obrigatório (mín. 2 caracteres).' }
  if (nome.length > 50) return { error: 'Nome do papel deve ter no máximo 50 caracteres.' }

  const { chaves, error: chavesErr } = parseChavesValidando(formData)
  if (chavesErr) return { error: chavesErr }

  const { data: existente } = await supabase
    .from('papeis')
    .select('id')
    .eq('escola_id', escolaId)
    .eq('nome', nome)
    .maybeSingle()

  if (existente) return { error: 'Já existe um papel com este nome nesta escola.' }

  const { data: novo, error: insertErr } = await supabase
    .from('papeis')
    .insert({
      escola_id: escolaId,
      nome,
      descricao,
      preset: false,
      chave_preset: null,
    })
    .select('id')
    .single()

  if (insertErr || !novo) return { error: 'Erro ao criar papel.' }

  if (chaves.length > 0) {
    const { error: permsErr } = await supabase
      .from('papel_permissoes')
      .insert(chaves.map(c => ({ papel_id: novo.id, chave: c })))
    if (permsErr) return { error: 'Papel criado, mas falhou ao gravar permissões.' }
  }

  revalidatePath('/admin/configuracoes/papeis')
  return { success: true, papelId: novo.id as string }
}

// ── ATUALIZAR ─────────────────────────────────────────────────────────────────

export async function atualizarPapelAction(papelId: string, formData: FormData) {
  const denied = await ensurePermissao()
  if (denied) return denied

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const nome = (formData.get('nome') as string | null)?.trim() ?? ''
  const descricao = (formData.get('descricao') as string | null)?.trim() || null

  if (!nome || nome.length < 2) return { error: 'Nome do papel é obrigatório (mín. 2 caracteres).' }
  if (nome.length > 50) return { error: 'Nome do papel deve ter no máximo 50 caracteres.' }

  const { chaves, error: chavesErr } = parseChavesValidando(formData)
  if (chavesErr) return { error: chavesErr }

  const { data: papel } = await supabase
    .from('papeis')
    .select('id, preset, chave_preset')
    .eq('id', papelId)
    .eq('escola_id', escolaId)
    .maybeSingle()

  if (!papel) return { error: 'Papel não encontrado.' }

  const { data: dup } = await supabase
    .from('papeis')
    .select('id')
    .eq('escola_id', escolaId)
    .eq('nome', nome)
    .neq('id', papelId)
    .maybeSingle()

  if (dup) return { error: 'Já existe outro papel com este nome.' }

  const { error: updErr } = await supabase
    .from('papeis')
    .update({ nome, descricao })
    .eq('id', papelId)

  if (updErr) return { error: 'Erro ao salvar papel.' }

  const { error: delErr } = await supabase
    .from('papel_permissoes')
    .delete()
    .eq('papel_id', papelId)
  if (delErr) return { error: 'Erro ao limpar permissões antigas.' }

  if (chaves.length > 0) {
    const { error: insErr } = await supabase
      .from('papel_permissoes')
      .insert(chaves.map(c => ({ papel_id: papelId, chave: c })))
    if (insErr) return { error: 'Erro ao gravar novas permissões.' }
  }

  revalidatePath('/admin/configuracoes/papeis')
  revalidatePath(`/admin/configuracoes/papeis/${papelId}`)
  return { success: true }
}

// ── DUPLICAR ──────────────────────────────────────────────────────────────────

export async function duplicarPapelAction(papelId: string) {
  const denied = await ensurePermissao()
  if (denied) return denied

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const { data: original } = await supabase
    .from('papeis')
    .select('id, escola_id, nome, descricao')
    .eq('id', papelId)
    .eq('escola_id', escolaId)
    .maybeSingle()

  if (!original) return { error: 'Papel não encontrado.' }

  const { data: perms } = await supabase
    .from('papel_permissoes')
    .select('chave')
    .eq('papel_id', papelId)

  const novoNome = `${original.nome} (cópia)`

  const { data: novo, error: insertErr } = await supabase
    .from('papeis')
    .insert({
      escola_id: escolaId,
      nome: novoNome,
      descricao: original.descricao,
      preset: false,
      chave_preset: null,
    })
    .select('id')
    .single()

  if (insertErr || !novo) return { error: 'Erro ao duplicar papel.' }

  const chaves = (perms ?? []).map((p: { chave: string }) => p.chave)
  if (chaves.length > 0) {
    const { error: permsErr } = await supabase
      .from('papel_permissoes')
      .insert(chaves.map(c => ({ papel_id: novo.id, chave: c })))
    if (permsErr) return { error: 'Cópia criada, mas falhou ao copiar permissões.' }
  }

  revalidatePath('/admin/configuracoes/papeis')
  return { success: true, papelId: novo.id as string }
}

// ── EXCLUIR ───────────────────────────────────────────────────────────────────

export async function excluirPapelAction(papelId: string) {
  const denied = await ensurePermissao()
  if (denied) return denied

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const { data: papel } = await supabase
    .from('papeis')
    .select('id, preset')
    .eq('id', papelId)
    .eq('escola_id', escolaId)
    .maybeSingle()

  if (!papel) return { error: 'Papel não encontrado.' }
  if (papel.preset) return { error: 'Papéis preset não podem ser excluídos.' }

  const { count } = await supabase
    .from('usuario_papel')
    .select('id', { count: 'exact', head: true })
    .eq('papel_id', papelId)

  if ((count ?? 0) > 0) {
    return { error: `Este papel está em uso por ${count} usuário(s). Reatribua antes de excluir.` }
  }

  const { error: delErr } = await supabase
    .from('papeis')
    .delete()
    .eq('id', papelId)

  if (delErr) return { error: 'Erro ao excluir papel.' }

  revalidatePath('/admin/configuracoes/papeis')
  return { success: true }
}
