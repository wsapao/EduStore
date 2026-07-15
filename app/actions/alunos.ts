'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSeriesDisponiveis } from '@/lib/crm/series'
import { serieMatches } from '@/lib/crm/series-core'

// Só aceita séries que a escola oferece — devolve a grafia canônica da lista
// (comparação normalizada, então variantes tipo "2º ano EM" viram "2º Série EM").
async function resolverSerieCanonica(serie: string): Promise<string | null> {
  const disponiveis = await getSeriesDisponiveis()
  return disponiveis.find(s => serieMatches(s, serie)) ?? null
}

// ── Criar aluno + vínculo ─────────────────────────────────────────────────────
export async function criarAlunoAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const nome  = (formData.get('nome') as string)?.trim()
  const serie = (formData.get('serie') as string)?.trim()
  const turma = (formData.get('turma') as string)?.trim() || null

  if (!nome || !serie) return { error: 'Nome e série são obrigatórios.' }
  if (nome.length < 3) return { error: 'Nome muito curto.' }

  const serieCanonica = await resolverSerieCanonica(serie)
  if (!serieCanonica) return { error: 'Selecione uma das séries disponíveis na lista.' }

  const { data, error } = await supabase
    .rpc('criar_aluno_responsavel', { p_nome: nome, p_serie: serieCanonica, p_turma: turma })

  if (error) return { error: 'Erro ao adicionar aluno. Verifique se sua conta está vinculada a uma escola.' }

  revalidatePath('/perfil/alunos')
  revalidatePath('/loja')
  return { success: true, aluno_id: data as string }
}

// ── Editar aluno ──────────────────────────────────────────────────────────────
export async function editarAlunoAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const alunoId = formData.get('aluno_id') as string
  const nome    = (formData.get('nome') as string)?.trim()
  const serie   = (formData.get('serie') as string)?.trim()
  const turma   = (formData.get('turma') as string)?.trim() || null

  if (!alunoId || !nome || !serie) return { error: 'Dados incompletos.' }

  const serieCanonica = await resolverSerieCanonica(serie)
  if (!serieCanonica) return { error: 'Selecione uma das séries disponíveis na lista.' }

  const { error } = await supabase
    .rpc('editar_aluno_responsavel', {
      p_aluno_id: alunoId,
      p_nome: nome,
      p_serie: serieCanonica,
      p_turma: turma,
    })

  if (error) return { error: 'Erro ao editar aluno.' }

  revalidatePath('/perfil/alunos')
  revalidatePath('/loja')
  return { success: true }
}

// ── Ativar / desativar aluno ──────────────────────────────────────────────────
export async function toggleAlunoAtivoAction(alunoId: string, ativo: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { error } = await supabase
    .rpc('toggle_aluno_ativo', { p_aluno_id: alunoId, p_ativo: !ativo })

  if (error) return { error: 'Erro ao alterar status do aluno.' }

  revalidatePath('/perfil/alunos')
  revalidatePath('/loja')
  return { success: true }
}
