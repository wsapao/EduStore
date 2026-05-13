'use server'

import { revalidatePath } from 'next/cache'

import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { normalizeLojaFuncionamento } from '@/lib/loja-online/config'
import { PermissionDeniedError, requirePermission } from '@/lib/permissoes'
import { createClient } from '@/lib/supabase/server'

const LAYOUTS_VALIDOS = new Set(['grid', 'lista'])

function trimToNull(value: FormDataEntryValue | null) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized || null
}

function uniqueStrings(values: FormDataEntryValue[]) {
  const result: string[] = []
  const seen = new Set<string>()

  for (const value of values) {
    if (typeof value !== 'string') continue

    const normalized = value.trim()
    if (!normalized || seen.has(normalized)) continue

    seen.add(normalized)
    result.push(normalized)
  }

  return result
}

export async function atualizarLojaOnlineAction(formData: FormData) {
  try {
    await requirePermission('configuracoes.editar_identidade')
  } catch (error) {
    if (error instanceof PermissionDeniedError) return { error: 'Sem permissao.' }
    return { error: 'Sem permissao.' }
  }

  const layoutHome = (formData.get('layout_home') as string | null)?.trim() ?? ''
  if (!LAYOUTS_VALIDOS.has(layoutHome)) {
    return { error: 'Layout da home invalido.' }
  }

  const horariosRaw = (formData.get('loja_funcionamento') as string | null)?.trim() || '[]'

  let parsedHorarios: unknown
  try {
    parsedHorarios = JSON.parse(horariosRaw)
  } catch {
    return { error: 'Horario de funcionamento invalido.' }
  }

  if (!Array.isArray(parsedHorarios)) {
    return { error: 'Horario de funcionamento invalido.' }
  }

  const lojaFuncionamento = normalizeLojaFuncionamento(parsedHorarios)
  if (lojaFuncionamento.length !== parsedHorarios.length) {
    return { error: 'Horario de funcionamento invalido.' }
  }

  const categoriasHomeVisiveis = uniqueStrings(formData.getAll('categorias_home_visiveis'))
  const produtosHomeDestaque = uniqueStrings(formData.getAll('produtos_home_destaque'))

  if (produtosHomeDestaque.length > 6) {
    return { error: 'Selecione no maximo 6 produtos em destaque.' }
  }

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola nao encontrada para este usuario.' }

  const { error } = await supabase
    .from('escola_configuracoes')
    .update({
      modo_manutencao: formData.get('modo_manutencao') === 'on',
      modo_manutencao_mensagem: trimToNull(formData.get('modo_manutencao_mensagem')),
      loja_funcionamento: lojaFuncionamento,
      categorias_home_visiveis: categoriasHomeVisiveis.length > 0 ? categoriasHomeVisiveis : null,
      produtos_home_destaque: produtosHomeDestaque,
      layout_home: layoutHome,
      mostrar_estoque_baixo: formData.get('mostrar_estoque_baixo') === 'on',
      texto_rodape: trimToNull(formData.get('texto_rodape')),
    })
    .eq('escola_id', escolaId)

  if (error) return { error: 'Erro ao salvar configuracoes da loja online.' }

  revalidatePath('/admin/configuracoes/loja-online')
  revalidatePath('/loja')

  return { success: true }
}
