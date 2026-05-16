import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock da action do servidor — sync.ts importa de @/app/actions/pdv-offline.
vi.mock('@/app/actions/pdv-offline', () => ({
  getPdvSnapshotAction: vi.fn(),
}))

import { getPdvSnapshotAction } from '@/app/actions/pdv-offline'
import { getDb, resetDbForTests } from '@/lib/pdv-offline/db'
import {
  pullSnapshot,
  startBackgroundSync,
  getLastSyncAt,
  getCachedEscolaId,
} from '@/lib/pdv-offline/sync'

// ── Fixtures ─────────────────────────────────────────────────
const SNAPSHOT_OK = {
  ok: true as const,
  server_time: '2026-05-16T10:00:00.000Z',
  escola_id: 'esc-1',
  alunos: [
    { id: 'a1', nome: 'Ana',   serie: '5', turma: 'A', escola_id: 'esc-1', ativo: true },
    { id: 'a2', nome: 'Bruno', serie: '6', turma: 'B', escola_id: 'esc-1', ativo: true },
  ],
  carteiras: [
    { id: 'c1', aluno_id: 'a1', escola_id: 'esc-1', saldo: 50, limite_diario: 20, ativo: true, bloqueio_motivo: null },
    { id: 'c2', aluno_id: 'a2', escola_id: 'esc-1', saldo: 0,  limite_diario: null, ativo: false, bloqueio_motivo: 'inadimplente' },
  ],
  produtos: [
    { id: 'p1', escola_id: 'esc-1', nome: 'Suco', ativo: true, preco: 5 },
    { id: 'p2', escola_id: 'esc-1', nome: 'Pão',  ativo: true, preco: 3.5 },
  ],
  restricoes: [
    { aluno_id: 'a1', produto_id: 'p1', motivo: 'alergia' },
  ],
}

/**
 * Limpa o estado entre testes: reseta o singleton e zera todas as stores
 * do banco em memória (fake-indexeddb).
 */
async function clearDb() {
  resetDbForTests()
  const db = getDb()
  await db.alunos.clear()
  await db.carteiras.clear()
  await db.produtos.clear()
  await db.restricoes.clear()
  await db.meta.clear()
}

describe('pullSnapshot', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await clearDb()
  })

  it('popula IDB com dados do snapshot em sucesso', async () => {
    ;(getPdvSnapshotAction as any).mockResolvedValue(SNAPSHOT_OK)

    const res = await pullSnapshot()
    expect(res.ok).toBe(true)
    if (!res.ok) throw new Error('esperava sucesso')

    expect(res.counts).toEqual({ alunos: 2, carteiras: 2, produtos: 2, restricoes: 1 })

    const db = getDb()
    expect(await db.alunos.count()).toBe(2)
    expect(await db.carteiras.count()).toBe(2)
    expect(await db.produtos.count()).toBe(2)
    expect(await db.restricoes.count()).toBe(1)

    const a1 = await db.alunos.get('a1')
    expect(a1?.nome).toBe('Ana')
    const c1 = await db.carteiras.get('c1')
    expect(c1?.saldo).toBe(50)
  })

  it('atualiza meta.last_sync_at e meta.escola_id após sucesso', async () => {
    ;(getPdvSnapshotAction as any).mockResolvedValue(SNAPSHOT_OK)
    await pullSnapshot()

    expect(await getLastSyncAt()).toBe('2026-05-16T10:00:00.000Z')
    expect(await getCachedEscolaId()).toBe('esc-1')
  })

  it('pull subsequente não duplica e substitui registros', async () => {
    ;(getPdvSnapshotAction as any).mockResolvedValue(SNAPSHOT_OK)
    await pullSnapshot()

    // Segundo snapshot tem apenas 1 aluno; o anterior deve ser removido.
    const SNAPSHOT_2 = {
      ...SNAPSHOT_OK,
      server_time: '2026-05-16T11:00:00.000Z',
      alunos: [
        { id: 'a1', nome: 'Ana Editada', serie: '5', turma: 'A', escola_id: 'esc-1', ativo: true },
      ],
      carteiras: [],
      produtos: [],
      restricoes: [],
    }
    ;(getPdvSnapshotAction as any).mockResolvedValue(SNAPSHOT_2)
    const res = await pullSnapshot()
    expect(res.ok).toBe(true)

    const db = getDb()
    expect(await db.alunos.count()).toBe(1)
    expect((await db.alunos.get('a1'))?.nome).toBe('Ana Editada')
    expect(await db.carteiras.count()).toBe(0)
    expect(await db.produtos.count()).toBe(0)
    expect(await db.restricoes.count()).toBe(0)
    expect(await getLastSyncAt()).toBe('2026-05-16T11:00:00.000Z')
  })

  it('em erro da action, retorna ok:false sem mexer no IDB', async () => {
    // Primeiro popula com sucesso.
    ;(getPdvSnapshotAction as any).mockResolvedValue(SNAPSHOT_OK)
    await pullSnapshot()
    const lastSyncAntes = await getLastSyncAt()

    // Pull subsequente falha — IDB não pode ser alterado.
    ;(getPdvSnapshotAction as any).mockResolvedValue({ ok: false, error: 'sem rede' })
    const res = await pullSnapshot()
    expect(res).toEqual({ ok: false, error: 'sem rede' })

    const db = getDb()
    expect(await db.alunos.count()).toBe(2)
    expect(await db.carteiras.count()).toBe(2)
    expect(await getLastSyncAt()).toBe(lastSyncAntes)
  })

  it('em erro inesperado (throw), retorna ok:false sem corromper IDB', async () => {
    ;(getPdvSnapshotAction as any).mockResolvedValue(SNAPSHOT_OK)
    await pullSnapshot()

    ;(getPdvSnapshotAction as any).mockRejectedValue(new Error('network kaput'))
    const res = await pullSnapshot()
    expect(res.ok).toBe(false)
    if (res.ok) throw new Error('esperava falha')
    expect(res.error).toContain('network kaput')

    const db = getDb()
    expect(await db.alunos.count()).toBe(2)
  })
})

describe('getLastSyncAt / getCachedEscolaId', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await clearDb()
  })

  it('retorna null quando nunca sincronizou', async () => {
    expect(await getLastSyncAt()).toBeNull()
    expect(await getCachedEscolaId()).toBeNull()
  })
})

describe('startBackgroundSync', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await clearDb()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('dispara pull imediato e em intervalos', async () => {
    ;(getPdvSnapshotAction as any).mockResolvedValue(SNAPSHOT_OK)

    const stop = startBackgroundSync({ intervalMs: 1000 })

    // Pull inicial é assíncrono — flush microtasks.
    await vi.runOnlyPendingTimersAsync()
    expect((getPdvSnapshotAction as any).mock.calls.length).toBeGreaterThanOrEqual(1)
    const inicial = (getPdvSnapshotAction as any).mock.calls.length

    await vi.advanceTimersByTimeAsync(1000)
    expect((getPdvSnapshotAction as any).mock.calls.length).toBe(inicial + 1)

    await vi.advanceTimersByTimeAsync(1000)
    expect((getPdvSnapshotAction as any).mock.calls.length).toBe(inicial + 2)

    stop()
    await vi.advanceTimersByTimeAsync(5000)
    // Após parar, número de chamadas não cresce.
    expect((getPdvSnapshotAction as any).mock.calls.length).toBe(inicial + 2)
  })

  it('não sobrepõe pulls: se anterior ainda roda, pula o tick', async () => {
    let resolveAtual: ((v: unknown) => void) = () => {}
    ;(getPdvSnapshotAction as any).mockImplementation(
      () => new Promise((resolve) => { resolveAtual = (v) => resolve(v as never) }),
    )

    const stop = startBackgroundSync({ intervalMs: 1000 })

    // Aguarda kick-off do pull inicial.
    await vi.advanceTimersByTimeAsync(0)
    expect((getPdvSnapshotAction as any).mock.calls.length).toBe(1)

    // Avança 3 ticks SEM resolver o pull inicial — não pode disparar novos.
    await vi.advanceTimersByTimeAsync(3000)
    expect((getPdvSnapshotAction as any).mock.calls.length).toBe(1)

    // Resolve o pull em andamento.
    resolveAtual(SNAPSHOT_OK)
    await vi.advanceTimersByTimeAsync(0)

    // Agora o próximo tick deve disparar novo pull.
    await vi.advanceTimersByTimeAsync(1000)
    expect((getPdvSnapshotAction as any).mock.calls.length).toBe(2)

    stop()
  })
})
