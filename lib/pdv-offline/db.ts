/**
 * Schema local IndexedDB do PDV Offline-First (Dexie).
 *
 * Versão 1 — Fase 1 do PDV Offline-First.
 * Mantém os dados necessários para o operador atender alunos mesmo sem
 * internet: cadastro de alunos, carteiras (saldo + limite), produtos da
 * cantina presencial e restrições nutricionais por aluno.
 *
 * Decisão da spec (3.4): NÃO armazenamos `senha_pin_hash` na Fase 1.
 * O PIN será introduzido em fase posterior junto da camada de auth offline.
 */
import Dexie, { type Table } from 'dexie'

// ── Tipos das stores ─────────────────────────────────────────

export interface AlunoLocal {
  id: string
  nome: string
  serie: string | null
  turma: string | null
  escola_id: string
  ativo: boolean
}

export interface CarteiraLocal {
  id: string
  aluno_id: string
  escola_id: string
  saldo: number
  limite_diario: number | null
  ativo: boolean
  bloqueio_motivo: string | null
}

export interface RestricaoLocal {
  /** PK autoincremental local — restrições não têm id estável vindo do servidor na Fase 1. */
  localId?: number
  aluno_id: string
  produto_id: string | null
  motivo: string | null
}

export interface ProdutoLocal {
  id: string
  escola_id: string
  nome: string
  ativo: boolean
  preco: number
}

/**
 * Store key-value pra metadados de sincronização e configuração local.
 * Ex: { chave: 'last_sync_at', valor: '2026-05-15T13:00:00Z' }
 */
export interface MetaLocal {
  chave: string
  valor: string
}

// ── Definição do banco ───────────────────────────────────────

export class PdvOfflineDB extends Dexie {
  alunos!: Table<AlunoLocal, string>
  carteiras!: Table<CarteiraLocal, string>
  restricoes!: Table<RestricaoLocal, number>
  produtos!: Table<ProdutoLocal, string>
  meta!: Table<MetaLocal, string>

  constructor(name = 'edustore_pdv_v1') {
    super(name)

    this.version(1).stores({
      // PK + índices secundários separados por vírgula (convenção Dexie).
      alunos:     'id, nome, serie, turma, escola_id',
      carteiras:  'id, aluno_id, escola_id, ativo',
      restricoes: '++localId, aluno_id',
      produtos:   'id, escola_id, nome, ativo',
      meta:       'chave',
    })
  }
}

// ── Singleton ────────────────────────────────────────────────

let _db: PdvOfflineDB | null = null

/**
 * Retorna a instância singleton do DB local. Cria sob demanda.
 * Em testes, use `resetDbForTests()` (ou crie uma instância manual)
 * para isolar dados entre cases.
 */
export function getDb(): PdvOfflineDB {
  if (!_db) {
    _db = new PdvOfflineDB()
  }
  return _db
}

/**
 * Apenas para testes: descarta a instância em memória pra que a próxima
 * chamada de `getDb()` crie uma nova. NÃO chama `delete()` no IndexedDB.
 */
export function resetDbForTests(): void {
  _db = null
}
