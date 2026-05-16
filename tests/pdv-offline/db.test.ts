import { describe, it, expect, afterEach } from 'vitest'
import Dexie from 'dexie'
import {
  PdvOfflineDB,
  getDb,
  resetDbForTests,
  type AlunoLocal,
  type CarteiraLocal,
  type ProdutoLocal,
  type RestricaoLocal,
} from '@/lib/pdv-offline/db'

// Isolamento: cada teste roda contra uma DB com nome único e a deleta no fim.
// Evita poluição cruzada entre tests no fake-indexeddb (que é in-memory global).
function makeIsolatedDb(testName: string): PdvOfflineDB {
  const unique = `pdv_test_${testName}_${Math.random().toString(36).slice(2, 8)}`
  return new PdvOfflineDB(unique)
}

describe('PdvOfflineDB (schema v1)', () => {
  const opened: PdvOfflineDB[] = []

  afterEach(async () => {
    // Cleanup: fecha e deleta cada DB criada no teste.
    for (const db of opened.splice(0)) {
      db.close()
      await Dexie.delete(db.name)
    }
    resetDbForTests()
  })

  function track(db: PdvOfflineDB) {
    opened.push(db)
    return db
  }

  it('abre o banco sem erro e expõe todas as stores esperadas', async () => {
    const db = track(makeIsolatedDb('open'))
    await db.open()

    const tableNames = db.tables.map((t) => t.name).sort()
    expect(tableNames).toEqual(
      ['alunos', 'carteiras', 'meta', 'produtos', 'restricoes'].sort()
    )
  })

  it('put/get funciona em alunos e respeita o tipo', async () => {
    const db = track(makeIsolatedDb('alunos'))
    const aluno: AlunoLocal = {
      id: 'a1',
      nome: 'João da Silva',
      serie: '5º ano',
      turma: 'A',
      escola_id: 'esc-1',
      ativo: true,
    }
    await db.alunos.put(aluno)
    const lido = await db.alunos.get('a1')
    expect(lido).toEqual(aluno)
  })

  it('put/get funciona em carteiras e índice por aluno_id permite busca', async () => {
    const db = track(makeIsolatedDb('carteiras'))
    const carteira: CarteiraLocal = {
      id: 'c1',
      aluno_id: 'a1',
      escola_id: 'esc-1',
      saldo: 42.5,
      limite_diario: 20,
      ativo: true,
      bloqueio_motivo: null,
    }
    await db.carteiras.put(carteira)
    const porAluno = await db.carteiras.where('aluno_id').equals('a1').first()
    expect(porAluno).toEqual(carteira)
  })

  it('put/get funciona em produtos e índice por escola_id filtra corretamente', async () => {
    const db = track(makeIsolatedDb('produtos'))
    const produtos: ProdutoLocal[] = [
      { id: 'p1', escola_id: 'esc-1', nome: 'Suco', ativo: true, preco: 5 },
      { id: 'p2', escola_id: 'esc-2', nome: 'Bolo', ativo: true, preco: 7 },
      { id: 'p3', escola_id: 'esc-1', nome: 'Pão',  ativo: true, preco: 3 },
    ]
    await db.produtos.bulkPut(produtos)

    const daEscola1 = await db.produtos.where('escola_id').equals('esc-1').toArray()
    expect(daEscola1.map((p) => p.id).sort()).toEqual(['p1', 'p3'])
  })

  it('restricoes usa PK autoincremental e indexa por aluno_id', async () => {
    const db = track(makeIsolatedDb('restricoes'))
    const r1: RestricaoLocal = { aluno_id: 'a1', produto_id: 'p1', motivo: 'alergia' }
    const r2: RestricaoLocal = { aluno_id: 'a1', produto_id: 'p2', motivo: null }
    const r3: RestricaoLocal = { aluno_id: 'a2', produto_id: 'p1', motivo: null }
    await db.restricoes.bulkAdd([r1, r2, r3])

    const doAluno1 = await db.restricoes.where('aluno_id').equals('a1').toArray()
    expect(doAluno1).toHaveLength(2)
    // localId deve ter sido atribuído automaticamente
    for (const r of doAluno1) {
      expect(typeof r.localId).toBe('number')
    }
  })

  it('meta funciona como key-value via PK chave', async () => {
    const db = track(makeIsolatedDb('meta'))
    await db.meta.put({ chave: 'last_sync_at', valor: '2026-05-15T10:00:00Z' })
    await db.meta.put({ chave: 'escola_id',    valor: 'esc-1' })

    const lastSync = await db.meta.get('last_sync_at')
    const escolaId = await db.meta.get('escola_id')
    expect(lastSync?.valor).toBe('2026-05-15T10:00:00Z')
    expect(escolaId?.valor).toBe('esc-1')
  })

  it('getDb() retorna sempre a mesma instância (singleton)', () => {
    const a = getDb()
    const b = getDb()
    expect(a).toBe(b)
    // Não deixa essa instância vazada — resetDbForTests no afterEach lida.
    opened.push(a)
  })
})
