import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auditoria/log', () => ({ auditLog: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/permissoes', () => ({
  requirePermission: vi.fn(),
  PermissionDeniedError: class extends Error {},
}))
vi.mock('@/lib/escola/getEscolaIdParaAdmin', () => ({ getEscolaIdParaAdmin: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission, PermissionDeniedError } from '@/lib/permissoes'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { auditLog } from '@/lib/auditoria/log'

import {
  exportarPedidosCsvAction,
  exportarAlunosCsvAction,
  exportarResponsaveisCsvAction,
  previewExclusaoLgpdAction,
  executarExclusaoLgpdAction,
  exportarPortabilidadeLgpdAction,
} from '@/app/actions/configuracoes/dados'

// ---------- Mock helpers ----------

/**
 * Cria um query-builder thenable que termina automaticamente com o resultado
 * passado quando aguardado, mas continua encadeável até lá.
 */
function makeQuery(result: { data?: any; error?: any; count?: number | null }) {
  const r = { data: result.data ?? null, error: result.error ?? null, count: result.count ?? null }
  const builder: any = {}
  const passthrough = ['select', 'eq', 'gte', 'lte', 'in', 'order']
  for (const m of passthrough) builder[m] = vi.fn(() => builder)
  builder.limit = vi.fn(() => Promise.resolve(r))
  builder.maybeSingle = vi.fn(() => Promise.resolve(r))
  builder.single = vi.fn(() => Promise.resolve(r))
  builder.update = vi.fn(() => builder)
  builder.then = (resolve: any, reject: any) => Promise.resolve(r).then(resolve, reject)
  return builder
}

function adminPedidos(rows: any[]) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'pedidos') return makeQuery({ data: rows })
      return makeQuery({ data: [] })
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(requirePermission as any).mockResolvedValue(undefined)
  ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
  ;(createClient as any).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1', email: 'admin@example.com' } } }),
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    },
  })
})

// =============================================================================
// Exports CSV
// =============================================================================

describe('exportarPedidosCsvAction', () => {
  it('retorna erro quando permissão negada', async () => {
    ;(requirePermission as any).mockRejectedValue(new PermissionDeniedError('configuracoes.ver'))
    const r = await exportarPedidosCsvAction()
    expect((r as any).error).toBe('Sem permissão.')
  })

  it('gera CSV com header correto e escape de vírgulas/aspas', async () => {
    ;(createAdminClient as any).mockReturnValue(
      adminPedidos([
        {
          numero: 'PED-1',
          created_at: '2026-01-01T00:00:00Z',
          status: 'pago',
          metodo_pagamento: 'pix',
          total: 100,
          responsavel_id: 'r-1',
          itens: [{}, {}],
        },
        {
          // valor problemático: contém vírgula e aspas
          numero: 'PED,2 "ABC"',
          created_at: '2026-01-02T00:00:00Z',
          status: 'pendente',
          metodo_pagamento: 'cartao',
          total: 200,
          responsavel_id: 'r-2',
          itens: [],
        },
      ])
    )

    const r = await exportarPedidosCsvAction()
    expect('csv' in r).toBe(true)
    if (!('csv' in r)) return
    const linhas = r.csv.split('\r\n')
    expect(linhas[0]).toBe(
      'numero,data_criacao,status,metodo_pagamento,total,responsavel_id,total_itens'
    )
    expect(linhas[1]).toContain('PED-1')
    expect(linhas[1].endsWith(',2')).toBe(true) // total_itens=2 no final
    // escape: o valor com vírgula vira "PED,2 ""ABC"""
    expect(linhas[2]).toContain('"PED,2 ""ABC"""')
    expect(r.filename).toMatch(/^pedidos-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ modulo: 'dados', acao: 'exportou_pedidos' })
    )
  })
})

describe('exportarAlunosCsvAction', () => {
  it('gera CSV com responsaveis_emails concatenado', async () => {
    ;(createAdminClient as any).mockReturnValue({
      from: vi.fn(() =>
        makeQuery({
          data: [
            {
              id: 'a-1',
              nome: 'João',
              serie: '5º',
              turma: 'A',
              ativo: true,
              vinculos: [
                { responsavel: { email: 'pai@x.com' } },
                { responsavel: { email: 'mae@x.com' } },
              ],
            },
          ],
        })
      ),
    })

    const r = await exportarAlunosCsvAction()
    expect('csv' in r).toBe(true)
    if (!('csv' in r)) return
    expect(r.csv.split('\r\n')[0]).toBe('id,nome,serie,turma,ativo,responsaveis_emails')
    expect(r.csv).toContain('pai@x.com; mae@x.com')
    expect(r.filename).toMatch(/^alunos-/)
  })
})

describe('exportarResponsaveisCsvAction', () => {
  it('gera CSV com colunas LGPD', async () => {
    ;(createAdminClient as any).mockReturnValue({
      from: vi.fn(() =>
        makeQuery({
          data: [
            {
              id: 'r-1',
              nome: 'Maria',
              email: 'maria@x.com',
              cpf: '12345678901',
              telefone: null,
              ativo: true,
              excluido_em: null,
              created_at: '2025-01-01T00:00:00Z',
            },
          ],
        })
      ),
    })

    const r = await exportarResponsaveisCsvAction()
    expect('csv' in r).toBe(true)
    if (!('csv' in r)) return
    expect(r.csv.split('\r\n')[0]).toBe(
      'id,nome,email,cpf,telefone,ativo,excluido_em,created_at'
    )
    expect(r.csv).toContain('maria@x.com')
  })
})

// =============================================================================
// LGPD por CPF
// =============================================================================

describe('previewExclusaoLgpdAction', () => {
  it('retorna erro quando CPF não encontrado na escola', async () => {
    ;(createAdminClient as any).mockReturnValue({
      from: vi.fn(() => makeQuery({ data: null })),
    })
    const r = await previewExclusaoLgpdAction('123.456.789-01')
    expect((r as any).error).toMatch(/n[ãa]o encontrado/i)
  })

  it('retorna preview com contagens de pedidos/ingressos/carteiras', async () => {
    const responsavel = {
      id: 'r-1',
      nome: 'Carlos',
      email: 'carlos@x.com',
      cpf: '12345678901',
      telefone: '11999',
    }

    const adminMock: any = {
      from: vi.fn((table: string) => {
        if (table === 'responsaveis') return makeQuery({ data: responsavel })
        if (table === 'responsavel_aluno') {
          return makeQuery({
            data: [
              { aluno: { id: 'a-1', nome: 'Filho 1', serie: '1º' } },
              { aluno: { id: 'a-2', nome: 'Filho 2', serie: '3º' } },
            ],
          })
        }
        if (table === 'pedidos') return makeQuery({ count: 7 })
        if (table === 'ingressos') return makeQuery({ count: 3 })
        if (table === 'cantina_carteiras') return makeQuery({ count: 2 })
        return makeQuery({ data: [] })
      }),
    }
    ;(createAdminClient as any).mockReturnValue(adminMock)

    const r = await previewExclusaoLgpdAction('123.456.789-01')
    expect('preview' in r).toBe(true)
    if (!('preview' in r)) return
    expect(r.preview.responsavel.id).toBe('r-1')
    expect(r.preview.alunosVinculados).toHaveLength(2)
    expect(r.preview.totalPedidos).toBe(7)
    expect(r.preview.totalIngressos).toBe(3)
    expect(r.preview.carteirasCantina).toBe(2)
  })
})

describe('executarExclusaoLgpdAction', () => {
  it('retorna erro quando senha de admin está incorreta', async () => {
    ;(createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1', email: 'admin@example.com' } } }),
        signInWithPassword: vi.fn().mockResolvedValue({ error: { message: 'invalid' } }),
      },
    })
    const r = await executarExclusaoLgpdAction({
      cpf: '12345678901',
      senhaConfirmacao: 'errada',
    })
    expect((r as any).error).toMatch(/senha/i)
  })

  it('anonimiza responsável e registra auditoria', async () => {
    const responsavel = {
      id: 'r-1',
      nome: 'Carlos',
      email: 'carlos@x.com',
      cpf: '12345678901',
      telefone: '11999',
    }

    const updateBuilder = makeQuery({ data: null, error: null })
    const adminMock: any = {
      from: vi.fn((table: string) => {
        if (table === 'responsaveis') {
          // primeiro a busca via maybeSingle, depois update().eq()
          // para distinguir basta retornar o builder único — funciona pq update e eq retornam builder
          return Object.assign(updateBuilder, makeQuery({ data: responsavel }))
        }
        return makeQuery({ data: null })
      }),
      auth: {
        admin: { deleteUser: vi.fn().mockResolvedValue({ error: null }) },
      },
    }
    ;(createAdminClient as any).mockReturnValue(adminMock)

    const r = await executarExclusaoLgpdAction({
      cpf: '123.456.789-01',
      senhaConfirmacao: 'correta',
    })
    expect((r as any).success).toBe(true)
    expect(adminMock.auth.admin.deleteUser).toHaveBeenCalledWith('r-1')
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ modulo: 'dados', acao: 'lgpd_excluido' })
    )
  })
})

describe('exportarPortabilidadeLgpdAction', () => {
  it('retorna erro quando CPF não encontrado', async () => {
    ;(createAdminClient as any).mockReturnValue({
      from: vi.fn(() => makeQuery({ data: null })),
    })
    const r = await exportarPortabilidadeLgpdAction('123.456.789-01')
    expect((r as any).error).toMatch(/n[ãa]o encontrado/i)
  })

  it('gera JSON com responsavel, alunos, pedidos, ingressos e carteiras', async () => {
    const responsavel = {
      id: 'r-1',
      nome: 'Carlos',
      email: 'c@x.com',
      cpf: '12345678901',
      telefone: '11',
    }
    let respCallCount = 0
    const adminMock: any = {
      from: vi.fn((table: string) => {
        if (table === 'responsaveis') {
          respCallCount++
          // 1ª chamada: busca por CPF (maybeSingle); 2ª: select * full
          return makeQuery({
            data: respCallCount === 1 ? responsavel : { ...responsavel, extra: 'full' },
          })
        }
        if (table === 'responsavel_aluno') {
          return makeQuery({ data: [{ aluno: { id: 'a-1', nome: 'F1', serie: '1º' } }] })
        }
        if (table === 'pedidos') return makeQuery({ data: [{ id: 'p-1', itens: [] }] })
        if (table === 'ingressos') return makeQuery({ data: [{ id: 'i-1' }] })
        if (table === 'cantina_carteiras') return makeQuery({ data: [{ id: 'cc-1' }] })
        return makeQuery({ data: [] })
      }),
    }
    ;(createAdminClient as any).mockReturnValue(adminMock)

    const r = await exportarPortabilidadeLgpdAction('123.456.789-01')
    expect('json' in r).toBe(true)
    if (!('json' in r)) return
    const parsed = JSON.parse(r.json)
    expect(parsed.responsavel.id).toBe('r-1')
    expect(parsed.alunos).toHaveLength(1)
    expect(parsed.pedidos).toHaveLength(1)
    expect(parsed.ingressos).toHaveLength(1)
    expect(parsed.carteiras_cantina).toHaveLength(1)
    expect(parsed.lgpd).toBeDefined()
    expect(r.filename).toMatch(/^lgpd-portabilidade-123xxx01-/)
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ modulo: 'dados', acao: 'lgpd_portabilidade' })
    )
  })
})
