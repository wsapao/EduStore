import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/crm/series', () => ({ getSeriesDisponiveis: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { getSeriesDisponiveis } from '@/lib/crm/series'
import { criarAlunoAction, editarAlunoAction } from '@/app/actions/alunos'

function makeForm(data: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(data)) fd.set(k, v)
  return fd
}

function setupSupabase() {
  const rpc = vi.fn().mockResolvedValue({ data: 'aluno-1', error: null })
  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'resp-1' } } }) },
    rpc,
  }
  ;(createClient as any).mockResolvedValue(supabase)
  return { rpc }
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(getSeriesDisponiveis as any).mockResolvedValue(['2º Ano', '2º Série EM'])
})

describe('criarAlunoAction — validação de série', () => {
  it('rejeita série fora da lista de séries da escola', async () => {
    const { rpc } = setupSupabase()
    const res = await criarAlunoAction(
      makeForm({ nome: 'Aluna Teste', serie: 'Quinta série', turma: 'A' }),
    )
    expect(res.error).toBeTruthy()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('aceita série da lista e salva', async () => {
    const { rpc } = setupSupabase()
    const res = await criarAlunoAction(
      makeForm({ nome: 'Aluna Teste', serie: '2º Série EM', turma: 'A' }),
    )
    expect(res).toEqual({ success: true, aluno_id: 'aluno-1' })
    expect(rpc).toHaveBeenCalledWith('criar_aluno_responsavel', {
      p_nome: 'Aluna Teste',
      p_serie: '2º Série EM',
      p_turma: 'A',
    })
  })

  it('normaliza variante equivalente para a grafia canônica da lista', async () => {
    const { rpc } = setupSupabase()
    await criarAlunoAction(
      makeForm({ nome: 'Aluna Teste', serie: '2º ano EM', turma: '' }),
    )
    expect(rpc).toHaveBeenCalledWith('criar_aluno_responsavel', {
      p_nome: 'Aluna Teste',
      p_serie: '2º Série EM',
      p_turma: null,
    })
  })
})

describe('editarAlunoAction — validação de série', () => {
  it('rejeita série fora da lista de séries da escola', async () => {
    const { rpc } = setupSupabase()
    const res = await editarAlunoAction(
      makeForm({ aluno_id: 'aluno-1', nome: 'Aluna Teste', serie: 'serie do fundao', turma: '' }),
    )
    expect(res.error).toBeTruthy()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('aceita série da lista e salva com a grafia canônica', async () => {
    const { rpc } = setupSupabase()
    const res = await editarAlunoAction(
      makeForm({ aluno_id: 'aluno-1', nome: 'Aluna Teste', serie: '2º Ano', turma: 'B' }),
    )
    expect(res).toEqual({ success: true })
    expect(rpc).toHaveBeenCalledWith('editar_aluno_responsavel', {
      p_aluno_id: 'aluno-1',
      p_nome: 'Aluna Teste',
      p_serie: '2º Ano',
      p_turma: 'B',
    })
  })
})
