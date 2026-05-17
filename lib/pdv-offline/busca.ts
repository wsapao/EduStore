/**
 * Busca local de alunos no IndexedDB do PDV Offline-First (Fase 1).
 *
 * Lógica extraída em função pura pra facilitar testes (a UI do PdvClient
 * apenas chama esta função e renderiza o resultado).
 *
 * Política Fase 1:
 *  - `gastoHoje` sempre 0 (não temos histórico offline) — aceitamos o
 *    tradeoff de não validar limite diário quando o operador busca via IDB.
 *  - `carteira.bloqueio_motivo` é `null` no snapshot atual: o backend
 *    poderia preencher, mas a Fase 1 ignora — só usamos `ativo`.
 *  - `restricoes` por categoria NÃO são suportadas offline: o snapshot
 *    grava apenas `produto_id`. Restrições por categoria só funcionam
 *    quando a busca cai no path online (`buscarAlunoCantinaAction`).
 */
import { getDb } from './db'

export interface AlunoBuscaResultado {
  id: string
  nome: string
  serie: string
  carteira: {
    id: string
    saldo: number
    limite_diario: number | null
    ativo: boolean
    bloqueio_motivo: string | null
  }
  gastoHoje: number
  restricoes: { produto_id: string | null; categoria: string | null }[]
}

const MAX_RESULTADOS = 10

/**
 * Busca alunos por nome (case-insensitive, substring). Junta carteira
 * e restrições do IDB local. Alunos sem carteira são ignorados — a UI
 * do PDV exige carteira para qualquer operação.
 */
export async function buscarAlunoLocal(q: string): Promise<AlunoBuscaResultado[]> {
  const termo = q.trim().toLowerCase()
  if (termo.length < 2) return []

  const db = getDb()

  // Dexie não tem `ilike`; filtramos em JS com toLowerCase + includes.
  // O `limit(MAX_RESULTADOS)` corta cedo pra não percorrer toda a tabela
  // quando o termo é muito genérico.
  const alunos = await db.alunos
    .filter((a) => a.nome.toLowerCase().includes(termo))
    .limit(MAX_RESULTADOS)
    .toArray()

  const result: AlunoBuscaResultado[] = []
  for (const aluno of alunos) {
    const carteira = await db.carteiras.where('aluno_id').equals(aluno.id).first()
    if (!carteira) continue

    const restricoes = await db.restricoes.where('aluno_id').equals(aluno.id).toArray()

    result.push({
      id: aluno.id,
      nome: aluno.nome,
      serie: aluno.serie ?? '',
      carteira: {
        id: carteira.id,
        saldo: carteira.saldo,
        limite_diario: carteira.limite_diario,
        ativo: carteira.ativo,
        bloqueio_motivo: carteira.bloqueio_motivo ?? null,
      },
      gastoHoje: 0,
      restricoes: restricoes.map((r) => ({
        produto_id: r.produto_id,
        categoria: null,
      })),
    })
  }

  return result
}

/**
 * Conta quantos alunos existem no IDB local. Usado pra decidir se a busca
 * pode usar o snapshot ou precisa cair no fallback online (primeira sessão).
 */
export async function contarAlunosLocais(): Promise<number> {
  return getDb().alunos.count()
}
