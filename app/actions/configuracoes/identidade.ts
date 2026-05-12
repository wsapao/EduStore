'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission, PermissionDeniedError } from '@/lib/permissoes'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'

export async function atualizarIdentidadeAction(formData: FormData) {
  try {
    await requirePermission('configuracoes.editar_identidade')
  } catch (e) {
    if (e instanceof PermissionDeniedError) return { error: 'Sem permissão.' }
    return { error: 'Sem permissão.' }
  }

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const nome              = (formData.get('nome') as string | null)?.trim() ?? ''
  const razao_social      = (formData.get('razao_social') as string | null)?.trim() || null
  const cnpj              = (formData.get('cnpj') as string | null)?.replace(/\D/g, '') || null
  const slogan            = (formData.get('slogan') as string | null)?.trim() || null
  const texto_boas_vindas = (formData.get('texto_boas_vindas') as string | null)?.trim() || null
  const cor_primaria_raw  = (formData.get('cor_primaria') as string | null)?.trim() || ''

  if (!nome || nome.length < 2) return { error: 'Nome da escola é obrigatório (mín. 2 caracteres).' }
  if (slogan && slogan.length > 120) return { error: 'Slogan deve ter no máximo 120 caracteres.' }
  if (texto_boas_vindas && texto_boas_vindas.length > 500) {
    return { error: 'Texto de boas-vindas deve ter no máximo 500 caracteres.' }
  }
  if (cnpj && cnpj.length !== 14) return { error: 'CNPJ deve ter 14 dígitos.' }

  const payload: Record<string, unknown> = {
    nome,
    razao_social,
    cnpj,
    slogan,
    texto_boas_vindas,
  }
  if (cor_primaria_raw && /^#[0-9a-fA-F]{6}$/.test(cor_primaria_raw)) {
    payload.cor_primaria = cor_primaria_raw
  }

  const { error } = await supabase.from('escolas').update(payload).eq('id', escolaId)
  if (error) return { error: 'Erro ao salvar identidade.' }

  revalidatePath('/admin/configuracoes/loja')
  revalidatePath('/loja')
  return { success: true }
}

export async function atualizarEnderecoAction(formData: FormData) {
  try {
    await requirePermission('configuracoes.editar_identidade')
  } catch {
    return { error: 'Sem permissão.' }
  }

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const logradouro = (formData.get('endereco_logradouro') as string | null)?.trim() || null
  const numero     = (formData.get('endereco_numero') as string | null)?.trim() || null
  const bairro     = (formData.get('endereco_bairro') as string | null)?.trim() || null
  const cidade     = (formData.get('endereco_cidade') as string | null)?.trim() || null
  const ufRaw      = (formData.get('endereco_uf') as string | null)?.trim() || null
  const cepRaw     = (formData.get('endereco_cep') as string | null)?.trim() || null

  let uf: string | null = null
  if (ufRaw) {
    const u = ufRaw.toUpperCase()
    if (u.length !== 2 || !/^[A-Z]{2}$/.test(u)) return { error: 'UF deve ter exatamente 2 letras.' }
    uf = u
  }

  let cep: string | null = null
  if (cepRaw) {
    const digits = cepRaw.replace(/\D/g, '')
    if (digits.length !== 8) return { error: 'CEP deve ter 8 dígitos.' }
    cep = digits
  }

  const { error } = await supabase
    .from('escolas')
    .update({
      endereco_logradouro: logradouro,
      endereco_numero: numero,
      endereco_bairro: bairro,
      endereco_cidade: cidade,
      endereco_uf: uf,
      endereco_cep: cep,
    })
    .eq('id', escolaId)

  if (error) return { error: 'Erro ao salvar endereço.' }

  revalidatePath('/admin/configuracoes/loja')
  return { success: true }
}

export type AssetKind = 'logo' | 'banner' | 'favicon'

const MIMES_VALIDOS: Record<AssetKind, string[]> = {
  logo:    ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'],
  banner:  ['image/png', 'image/jpeg', 'image/webp'],
  favicon: ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon'],
}

const TAMANHO_MAX = 2 * 1024 * 1024 // 2MB

const COLUNAS: Record<AssetKind, 'logo_url' | 'banner_url' | 'favicon_url'> = {
  logo: 'logo_url',
  banner: 'banner_url',
  favicon: 'favicon_url',
}

export async function uploadAssetEscolaAction(kind: AssetKind, file: File) {
  try {
    await requirePermission('configuracoes.editar_identidade')
  } catch {
    return { error: 'Sem permissão.' }
  }

  if (!['logo', 'banner', 'favicon'].includes(kind)) {
    return { error: 'Tipo de asset inválido.' }
  }
  if (!file || file.size === 0) {
    return { error: 'Arquivo vazio.' }
  }
  if (!MIMES_VALIDOS[kind].includes(file.type)) {
    return { error: 'Formato de imagem não suportado para este campo.' }
  }
  if (file.size > TAMANHO_MAX) {
    return { error: 'Arquivo maior que 2 MB.' }
  }

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const extMatch = /\.([a-zA-Z0-9]+)$/.exec(file.name)
  const ext = (extMatch?.[1] ?? 'bin').toLowerCase()
  const fileName = `${escolaId}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { data: upData, error: upErr } = await supabase
    .storage
    .from('escola-assets')
    .upload(fileName, file, { upsert: false, contentType: file.type })

  if (upErr || !upData) return { error: 'Falha no upload do arquivo.' }

  const { data: pub } = supabase.storage.from('escola-assets').getPublicUrl(upData.path)
  const url = pub.publicUrl

  const { error: updErr } = await supabase
    .from('escolas')
    .update({ [COLUNAS[kind]]: url })
    .eq('id', escolaId)

  if (updErr) return { error: 'Upload OK, mas falhou ao atualizar a escola.' }

  revalidatePath('/admin/configuracoes/loja')
  revalidatePath('/loja')
  return { success: true, url }
}
