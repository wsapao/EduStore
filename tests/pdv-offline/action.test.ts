import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/escola/getEscolaIdParaAdmin', () => ({
  getEscolaIdParaAdmin: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { getPdvSnapshotAction } from '@/app/actions/pdv-offline'

// ── Dataset de fixtures ──────────────────────────────────────
const ALUNOS_ESC1 = [
  { id: 'a1', nome: 'Ana',  serie: '5', turma: 'A', escola_id: 'esc-1', ativo: true },
  { id: 'a2', nome: 'Bruno', serie: '6', turma: 'B', escola_id: 'esc-1', ativo: true },
]
const CARTEIRAS_ESC1 = [
  {
    id: 'c1', aluno_id: 'a1', escola_id: 'esc-1',
    saldo: '50.00', limite_diario: '20.00', ativo: true, bloqueio_motivo: null,
    // o action NÃO deve pedir nem repassar isso; incluímos pra blindar o teste
    senha_pin_hash: 'NUNCA_DEVE_SAIR_DAQUI',
  },
  {
    id: 'c2', aluno_id: 'a2', escola_id: 'esc-1',
    saldo: '0.00', limite_diario: null, ativo: false, bloqueio_motivo: 'inadimplente',
  },
]
const PRODUTOS_ESC1_PRESENCIAIS = [
  { id: 'p1', escola_id: 'esc-1', nome: 'Suco', ativo: true, preco: '5.00', disponivel_presencial: true },
  { id: 'p3', escola_id: 'esc-1', nome: 'Pão',  ativo: true, preco: '3.50', disponivel_presencial: true },
]
const RESTRICOES_ESC1 = [
  { aluno_id: 'a1', produto_id: 'p1', motivo: 'alergia' },
]

/** Stub mínimo do client retornado por `createAdminClient()`. */
function makeAdminStub(opts: {
  alunosError?: { message: string }
  carteirasError?: { message: string }
  produtosError?: { message: string }
  restricoesError?: { message: string }
} = {}) {
  const calls: { table: string; filters: Array<[string, unknown]>; select?: string }[] = []

  // Cada chamada `from(table).select(...).eq(...).eq(...)` precisa ser thenável
  // no final. Implementamos como builder fluente cujo `then` resolve com `data/error`.
  function builder(table: string) {
    const filters: Array<[string, unknown]> = []
    let selectStr = ''

    const result = {
      select(s: string) {
        selectStr = s
        return chain
      },
      eq(col: string, val: unknown) {
        filters.push([col, val])
        return chain
      },
      then(resolve: (v: { data: unknown; error: unknown }) => void) {
        calls.push({ table, filters, select: selectStr })
        let payload: { data: unknown; error: unknown }
        if (table === 'alunos') {
          payload = opts.alunosError
            ? { data: null, error: opts.alunosError }
            : { data: ALUNOS_ESC1, error: null }
        } else if (table === 'cantina_carteiras') {
          payload = opts.carteirasError
            ? { data: null, error: opts.carteirasError }
            : { data: CARTEIRAS_ESC1, error: null }
        } else if (table === 'cantina_produtos') {
          payload = opts.produtosError
            ? { data: null, error: opts.produtosError }
            : { data: PRODUTOS_ESC1_PRESENCIAIS, error: null }
        } else if (table === 'cantina_restricoes') {
          payload = opts.restricoesError
            ? { data: null, error: opts.restricoesError }
            : { data: RESTRICOES_ESC1, error: null }
        } else {
          payload = { data: [], error: null }
        }
        resolve(payload)
      },
    }
    const chain = result
    return chain
  }

  return {
    client: { from: vi.fn((t: string) => builder(t)) } as any,
    calls,
  }
}

function makeSupabaseStub(user: { id: string; role?: string } | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: user ? { id: user.id, app_metadata: { role: user.role } } : null },
      }),
    },
  } as any
}

describe('getPdvSnapshotAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejeita usuário não autenticado', async () => {
    ;(createClient as any).mockResolvedValue(makeSupabaseStub(null))
    const res = await getPdvSnapshotAction()
    expect(res).toEqual({ ok: false, error: 'Não autenticado.' })
  })

  it('rejeita role "responsavel"', async () => {
    ;(createClient as any).mockResolvedValue(makeSupabaseStub({ id: 'u1', role: 'responsavel' }))
    const res = await getPdvSnapshotAction()
    expect(res).toEqual({ ok: false, error: 'Acesso negado.' })
  })

  it('rejeita role indefinida', async () => {
    ;(createClient as any).mockResolvedValue(makeSupabaseStub({ id: 'u1' }))
    const res = await getPdvSnapshotAction()
    expect(res).toEqual({ ok: false, error: 'Acesso negado.' })
  })

  it('aceita role "admin" e devolve snapshot completo', async () => {
    ;(createClient as any).mockResolvedValue(makeSupabaseStub({ id: 'u1', role: 'admin' }))
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    const { client } = makeAdminStub()
    ;(createAdminClient as any).mockReturnValue(client)

    const res = await getPdvSnapshotAction()
    if (!res.ok) throw new Error('esperava sucesso, veio: ' + JSON.stringify(res))

    expect(res.escola_id).toBe('esc-1')
    expect(res.alunos).toHaveLength(2)
    expect(res.carteiras).toHaveLength(2)
    expect(res.produtos).toHaveLength(2)
    expect(res.restricoes).toEqual([
      { aluno_id: 'a1', produto_id: 'p1', motivo: 'alergia' },
    ])
    expect(typeof res.server_time).toBe('string')
    expect(() => new Date(res.server_time).toISOString()).not.toThrow()
  })

  it('aceita role "operador"', async () => {
    ;(createClient as any).mockResolvedValue(makeSupabaseStub({ id: 'u1', role: 'operador' }))
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    const { client } = makeAdminStub()
    ;(createAdminClient as any).mockReturnValue(client)

    const res = await getPdvSnapshotAction()
    expect(res.ok).toBe(true)
  })

  it('filtra todas as tabelas por escola_id', async () => {
    ;(createClient as any).mockResolvedValue(makeSupabaseStub({ id: 'u1', role: 'admin' }))
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    const { client, calls } = makeAdminStub()
    ;(createAdminClient as any).mockReturnValue(client)

    await getPdvSnapshotAction()

    const alunoCall      = calls.find((c) => c.table === 'alunos')
    const carteiraCall   = calls.find((c) => c.table === 'cantina_carteiras')
    const produtoCall    = calls.find((c) => c.table === 'cantina_produtos')
    const restricaoCall  = calls.find((c) => c.table === 'cantina_restricoes')

    expect(alunoCall?.filters).toContainEqual(['escola_id', 'esc-1'])
    expect(carteiraCall?.filters).toContainEqual(['escola_id', 'esc-1'])
    expect(produtoCall?.filters).toContainEqual(['escola_id', 'esc-1'])
    expect(restricaoCall?.filters).toContainEqual(['alunos.escola_id', 'esc-1'])
  })

  it('produtos filtra disponivel_presencial=true e ativo=true', async () => {
    ;(createClient as any).mockResolvedValue(makeSupabaseStub({ id: 'u1', role: 'admin' }))
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    const { client, calls } = makeAdminStub()
    ;(createAdminClient as any).mockReturnValue(client)

    await getPdvSnapshotAction()

    const produtoCall = calls.find((c) => c.table === 'cantina_produtos')
    expect(produtoCall?.filters).toContainEqual(['disponivel_presencial', true])
    expect(produtoCall?.filters).toContainEqual(['ativo', true])
  })

  it('NÃO inclui senha_pin_hash na resposta de carteiras', async () => {
    ;(createClient as any).mockResolvedValue(makeSupabaseStub({ id: 'u1', role: 'admin' }))
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    const { client, calls } = makeAdminStub()
    ;(createAdminClient as any).mockReturnValue(client)

    const res = await getPdvSnapshotAction()
    if (!res.ok) throw new Error('esperava sucesso')

    for (const c of res.carteiras) {
      expect(c).not.toHaveProperty('senha_pin_hash')
    }
    // E o próprio SELECT da carteira não deve ter pedido o hash —
    // defesa em profundidade contra vazamentos.
    const carteiraCall = calls.find((c) => c.table === 'cantina_carteiras')
    expect(carteiraCall?.select).not.toContain('senha_pin_hash')
    expect(carteiraCall?.select).not.toContain('senha_pin')
  })

  it('converte saldo e limite_diario de string para number', async () => {
    ;(createClient as any).mockResolvedValue(makeSupabaseStub({ id: 'u1', role: 'admin' }))
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    const { client } = makeAdminStub()
    ;(createAdminClient as any).mockReturnValue(client)

    const res = await getPdvSnapshotAction()
    if (!res.ok) throw new Error('esperava sucesso')

    const c1 = res.carteiras.find((c) => c.id === 'c1')!
    expect(c1.saldo).toBe(50)
    expect(c1.limite_diario).toBe(20)
    const c2 = res.carteiras.find((c) => c.id === 'c2')!
    expect(c2.saldo).toBe(0)
    expect(c2.limite_diario).toBeNull()
  })

  it('retorna erro quando escola_id não é encontrada', async () => {
    ;(createClient as any).mockResolvedValue(makeSupabaseStub({ id: 'u1', role: 'admin' }))
    ;(getEscolaIdParaAdmin as any).mockResolvedValue(null)

    const res = await getPdvSnapshotAction()
    expect(res).toEqual({ ok: false, error: 'Escola não encontrada para o usuário.' })
  })

  it('propaga erro de query como mensagem amigável', async () => {
    ;(createClient as any).mockResolvedValue(makeSupabaseStub({ id: 'u1', role: 'admin' }))
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    const { client } = makeAdminStub({ alunosError: { message: 'boom alunos' } })
    ;(createAdminClient as any).mockReturnValue(client)

    const res = await getPdvSnapshotAction()
    expect(res).toEqual({ ok: false, error: 'boom alunos' })
  })
})
