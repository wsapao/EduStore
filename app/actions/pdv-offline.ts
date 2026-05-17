'use server'

/**
 * Server actions do PDV Offline-First (Fase 1).
 *
 * Esta camada expõe o snapshot completo de dados que o operador precisa
 * para atender alunos mesmo offline. A spec (3.4) define que o cliente
 * (Dexie/IndexedDB) faz o pré-download inicial e depois sync incremental.
 * Na Fase 1, ignoramos `since` e sempre devolvemos o snapshot completo
 * — a assinatura já está pronta pra evoluir.
 *
 * Decisão de segurança (spec 3.4): NÃO incluímos `senha_pin_hash` no
 * payload. O PIN offline será introduzido em fase posterior.
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'

export interface PdvSnapshotAluno {
  id: string
  nome: string
  serie: string | null
  turma: string | null
  escola_id: string
  ativo: boolean
}

export interface PdvSnapshotCarteira {
  id: string
  aluno_id: string
  escola_id: string
  saldo: number
  limite_diario: number | null
  ativo: boolean
  bloqueio_motivo: string | null
}

export interface PdvSnapshotProduto {
  id: string
  escola_id: string
  nome: string
  ativo: boolean
  preco: number
}

export interface PdvSnapshotRestricao {
  aluno_id: string
  produto_id: string | null
  motivo: string | null
}

export interface PdvSnapshotSuccess {
  ok: true
  server_time: string
  escola_id: string
  alunos: PdvSnapshotAluno[]
  carteiras: PdvSnapshotCarteira[]
  produtos: PdvSnapshotProduto[]
  restricoes: PdvSnapshotRestricao[]
}

export interface PdvSnapshotError {
  ok: false
  error: string
}

export type PdvSnapshotResult = PdvSnapshotSuccess | PdvSnapshotError

/**
 * Retorna o snapshot completo de alunos / carteiras / produtos / restrições
 * da escola do operador autenticado.
 *
 * @param since (opcional) timestamp ISO — preparado para sync incremental.
 *   Na Fase 1 é ignorado: sempre retornamos o dataset completo.
 */
export async function getPdvSnapshotAction(
  _since?: string,
): Promise<PdvSnapshotResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Não autenticado.' }

  // Mesmo padrão de autorização de `buscarAlunoCantinaAction`:
  // apenas admin ou operador podem operar o PDV.
  const role = user.app_metadata?.role
  if (role !== 'admin' && role !== 'operador') {
    return { ok: false, error: 'Acesso negado.' }
  }

  const escola_id = await getEscolaIdParaAdmin(supabase)
  if (!escola_id) return { ok: false, error: 'Escola não encontrada para o usuário.' }

  // Usa client admin para bypassar RLS — autorização já foi feita acima.
  const admin = createAdminClient()

  const [alunosRes, carteirasRes, produtosRes, restricoesRes] = await Promise.all([
    admin
      .from('alunos')
      .select('id, nome, serie, turma, escola_id, ativo')
      .eq('escola_id', escola_id)
      .eq('ativo', true),
    admin
      .from('cantina_carteiras')
      .select('id, aluno_id, escola_id, saldo, limite_diario, ativo, bloqueio_motivo')
      .eq('escola_id', escola_id),
    admin
      .from('cantina_produtos')
      .select('id, escola_id, nome, ativo, preco')
      .eq('escola_id', escola_id)
      .eq('disponivel_presencial', true)
      .eq('ativo', true),
    // Restrições: filtramos via join lógico (aluno pertence à escola).
    // Como a tabela não tem escola_id, pedimos junto via embed.
    admin
      .from('cantina_restricoes')
      .select('aluno_id, produto_id, motivo, alunos!inner(escola_id)')
      .eq('alunos.escola_id', escola_id),
  ])

  if (alunosRes.error)     return { ok: false, error: alunosRes.error.message }
  if (carteirasRes.error)  return { ok: false, error: carteirasRes.error.message }
  if (produtosRes.error)   return { ok: false, error: produtosRes.error.message }
  if (restricoesRes.error) return { ok: false, error: restricoesRes.error.message }

  type AlunoRow     = PdvSnapshotAluno
  type CarteiraRow  = PdvSnapshotCarteira
  type ProdutoRow   = PdvSnapshotProduto
  type RestricaoRow = PdvSnapshotRestricao & { alunos?: unknown }

  const alunos: PdvSnapshotAluno[] = ((alunosRes.data ?? []) as AlunoRow[]).map((a) => ({
    id: a.id,
    nome: a.nome,
    serie: a.serie,
    turma: a.turma,
    escola_id: a.escola_id,
    ativo: a.ativo,
  }))

  const carteiras: PdvSnapshotCarteira[] = ((carteirasRes.data ?? []) as CarteiraRow[]).map((c) => ({
    id: c.id,
    aluno_id: c.aluno_id,
    escola_id: c.escola_id,
    // saldo / limite vêm como string do PG numeric — normaliza pra number.
    saldo: Number(c.saldo),
    limite_diario: c.limite_diario === null ? null : Number(c.limite_diario),
    ativo: c.ativo,
    bloqueio_motivo: c.bloqueio_motivo,
  }))

  const produtos: PdvSnapshotProduto[] = ((produtosRes.data ?? []) as ProdutoRow[]).map((p) => ({
    id: p.id,
    escola_id: p.escola_id,
    nome: p.nome,
    ativo: p.ativo,
    preco: Number(p.preco),
  }))

  const restricoes: PdvSnapshotRestricao[] = ((restricoesRes.data ?? []) as RestricaoRow[]).map((r) => ({
    aluno_id: r.aluno_id,
    produto_id: r.produto_id,
    motivo: r.motivo,
  }))

  return {
    ok: true,
    server_time: new Date().toISOString(),
    escola_id,
    alunos,
    carteiras,
    produtos,
    restricoes,
  }
}
