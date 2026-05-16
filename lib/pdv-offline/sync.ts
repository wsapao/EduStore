/**
 * Engine de sincronização do PDV Offline-First (Fase 1).
 *
 * Responsabilidades:
 *  - Pull do snapshot completo via server action (`getPdvSnapshotAction`)
 *    e gravação atômica no IndexedDB local (Dexie).
 *  - Loop em background com intervalo configurável, sem sobreposição de
 *    pulls (se o anterior ainda está em andamento, o tick é pulado).
 *  - Leitura de metadados de sync (last_sync_at, escola_id cacheado).
 *
 * Em caso de erro de rede / autorização / exceção inesperada, o IDB
 * permanece inalterado: usamos uma transação `rw` que aborta na exceção
 * e não persiste leituras parciais.
 */
import { getPdvSnapshotAction } from '@/app/actions/pdv-offline'
import {
  getDb,
  type AlunoLocal,
  type CarteiraLocal,
  type ProdutoLocal,
  type RestricaoLocal,
} from './db'

// ── Tipos públicos ───────────────────────────────────────────

export interface PullSnapshotSuccess {
  ok: true
  counts: {
    alunos: number
    carteiras: number
    produtos: number
    restricoes: number
  }
}

export interface PullSnapshotError {
  ok: false
  error: string
}

export type PullSnapshotResult = PullSnapshotSuccess | PullSnapshotError

// ── Chaves de meta (mantidas como constantes pra evitar typos) ──
const META_LAST_SYNC = 'last_sync_at'
const META_ESCOLA_ID = 'escola_id'

// ── Pull principal ───────────────────────────────────────────

export async function pullSnapshot(): Promise<PullSnapshotResult> {
  let snapshot
  try {
    snapshot = await getPdvSnapshotAction()
  } catch (err) {
    // Falha de rede / erro inesperado da action — não tocamos IDB.
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }

  if (!snapshot.ok) {
    // Action devolveu erro de autorização / query — preserva IDB anterior.
    return { ok: false, error: snapshot.error }
  }

  const db = getDb()

  // Normaliza para os tipos locais. As shapes batem 1:1 hoje, mas a
  // tradução explícita protege contra drift de schema entre server/local.
  const alunos: AlunoLocal[] = snapshot.alunos.map((a) => ({
    id: a.id,
    nome: a.nome,
    serie: a.serie,
    turma: a.turma,
    escola_id: a.escola_id,
    ativo: a.ativo,
  }))
  const carteiras: CarteiraLocal[] = snapshot.carteiras.map((c) => ({
    id: c.id,
    aluno_id: c.aluno_id,
    escola_id: c.escola_id,
    saldo: c.saldo,
    limite_diario: c.limite_diario,
    ativo: c.ativo,
    bloqueio_motivo: c.bloqueio_motivo,
  }))
  const produtos: ProdutoLocal[] = snapshot.produtos.map((p) => ({
    id: p.id,
    escola_id: p.escola_id,
    nome: p.nome,
    ativo: p.ativo,
    preco: p.preco,
  }))
  // Restrições NÃO carregam localId — Dexie atribui via ++ autoincrement.
  const restricoes: RestricaoLocal[] = snapshot.restricoes.map((r) => ({
    aluno_id: r.aluno_id,
    produto_id: r.produto_id,
    motivo: r.motivo,
  }))

  try {
    await db.transaction(
      'rw',
      [db.alunos, db.carteiras, db.produtos, db.restricoes, db.meta],
      async () => {
        // Snapshot completo: limpa antes de repor pra refletir deleções
        // do servidor (Fase 1 não tem flag de tombstone).
        await db.alunos.clear()
        await db.carteiras.clear()
        await db.produtos.clear()
        await db.restricoes.clear()

        // bulkPut substitui por PK; bulkAdd lançaria erro em duplicatas.
        await db.alunos.bulkPut(alunos)
        await db.carteiras.bulkPut(carteiras)
        await db.produtos.bulkPut(produtos)
        if (restricoes.length > 0) {
          await db.restricoes.bulkPut(restricoes)
        }

        await db.meta.put({ chave: META_LAST_SYNC, valor: snapshot.server_time })
        await db.meta.put({ chave: META_ESCOLA_ID, valor: snapshot.escola_id })
      },
    )
  } catch (err) {
    // A transação Dexie aborta automaticamente em exceção: nenhuma das
    // escritas acima é commitada, então o IDB permanece consistente.
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }

  return {
    ok: true,
    counts: {
      alunos: alunos.length,
      carteiras: carteiras.length,
      produtos: produtos.length,
      restricoes: restricoes.length,
    },
  }
}

// ── Background loop ──────────────────────────────────────────

/**
 * Inicia loop de pulls em background. Faz um pull imediato e depois
 * repete a cada `intervalMs` (default 60s). Garante que pulls não se
 * sobreponham: se um pull anterior ainda está em andamento quando o
 * timer dispara, o tick é simplesmente pulado.
 *
 * Retorna função que, quando chamada, para o loop (clearInterval).
 */
export function startBackgroundSync(opts?: { intervalMs?: number }): () => void {
  const intervalMs = opts?.intervalMs ?? 60_000
  let inFlight = false
  let stopped = false

  const tick = () => {
    if (stopped || inFlight) return
    inFlight = true
    void pullSnapshot()
      .catch(() => {
        // pullSnapshot já captura próprios erros; este catch é defesa em
        // profundidade pra nunca deixar uma rejeição vazar pro event loop.
      })
      .finally(() => {
        inFlight = false
      })
  }

  // Pull imediato + loop periódico.
  tick()
  const handle = setInterval(tick, intervalMs)

  return () => {
    stopped = true
    clearInterval(handle)
  }
}

// ── Leitura de metadados ─────────────────────────────────────

export async function getLastSyncAt(): Promise<string | null> {
  const row = await getDb().meta.get(META_LAST_SYNC)
  return row?.valor ?? null
}

export async function getCachedEscolaId(): Promise<string | null> {
  const row = await getDb().meta.get(META_ESCOLA_ID)
  return row?.valor ?? null
}
