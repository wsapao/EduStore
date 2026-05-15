import { describe, it, expect, vi, beforeEach } from 'vitest'

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
import {
  listarAuditoriaAction,
  exportarAuditoriaCsvAction,
} from '@/app/actions/configuracoes/auditoria'

type Builder = {
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  gte: ReturnType<typeof vi.fn>
  lte: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  _result: { data: any[]; error: null | Error }
}

function makeBuilder(rows: any[] = [], error: null | Error = null): Builder {
  const builder: any = { _result: { data: rows, error } }
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.gte = vi.fn(() => builder)
  builder.lte = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.limit = vi.fn(() => Promise.resolve(builder._result))
  return builder
}

describe('listarAuditoriaAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna erro quando permissão negada', async () => {
    ;(requirePermission as any).mockRejectedValue(new PermissionDeniedError('configuracoes.ver'))
    const r = await listarAuditoriaAction()
    expect((r as any).error).toBe('Sem permissão.')
  })

  it('aplica filtros user/modulo/datas no query e respeita limit', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')

    const builder = makeBuilder([])
    ;(createClient as any).mockResolvedValue({ from: vi.fn(() => builder) })
    ;(createAdminClient as any).mockReturnValue({
      auth: { admin: { getUserById: vi.fn() } },
    })

    const r = await listarAuditoriaAction({
      userId: 'u-1',
      modulo: 'pagamentos',
      dataInicio: '2026-01-01T00:00:00Z',
      dataFim: '2026-12-31T00:00:00Z',
      limit: 9999, // deve ser clampado para 500
    })

    expect((r as any).entries).toEqual([])
    expect(builder.eq).toHaveBeenCalledWith('escola_id', 'esc-1')
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u-1')
    expect(builder.eq).toHaveBeenCalledWith('modulo', 'pagamentos')
    expect(builder.gte).toHaveBeenCalledWith('created_at', '2026-01-01T00:00:00Z')
    expect(builder.lte).toHaveBeenCalledWith('created_at', '2026-12-31T00:00:00Z')
    expect(builder.limit).toHaveBeenCalledWith(500)
  })

  it('enriquece linhas com user_email via admin client', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')

    const builder = makeBuilder([
      {
        id: 'a-1',
        user_id: 'u-1',
        modulo: 'm',
        acao: 'a',
        descricao: null,
        metadata: null,
        ip: null,
        created_at: '2026-05-14T00:00:00Z',
      },
    ])
    ;(createClient as any).mockResolvedValue({ from: vi.fn(() => builder) })

    const getUserById = vi.fn().mockResolvedValue({
      data: { user: { email: 'foo@bar.com' } },
    })
    ;(createAdminClient as any).mockReturnValue({ auth: { admin: { getUserById } } })

    const r = await listarAuditoriaAction()
    expect((r as any).entries[0].user_email).toBe('foo@bar.com')
    expect(getUserById).toHaveBeenCalledTimes(1)
    expect(getUserById).toHaveBeenCalledWith('u-1')
  })
})

describe('exportarAuditoriaCsvAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna erro quando permissão negada', async () => {
    ;(requirePermission as any).mockRejectedValue(new PermissionDeniedError('configuracoes.ver'))
    const r = await exportarAuditoriaCsvAction()
    expect((r as any).error).toBe('Sem permissão.')
  })

  it('serializa CSV com header e escape de aspas/vírgulas', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')

    const builder = makeBuilder([
      {
        id: 'a-1',
        user_id: null,
        modulo: 'usuarios',
        acao: 'convidou',
        descricao: 'foo, bar "baz"',
        metadata: { email: 'x@y.com' },
        ip: '1.2.3.4',
        created_at: '2026-05-14T00:00:00Z',
      },
    ])
    ;(createClient as any).mockResolvedValue({ from: vi.fn(() => builder) })
    ;(createAdminClient as any).mockReturnValue({
      auth: { admin: { getUserById: vi.fn() } },
    })

    const r = await exportarAuditoriaCsvAction()
    if ('error' in r) throw new Error('expected csv')
    const lines = r.csv.split('\n')
    expect(lines[0]).toBe('created_at,modulo,acao,user_email,descricao,metadata,ip')
    // descricao tem vírgula e aspas → vai entre aspas, com aspas escapadas
    expect(lines[1]).toContain('"foo, bar ""baz"""')
    // metadata é objeto → JSON.stringify, e contém vírgula → vai entre aspas
    expect(lines[1]).toContain('"{""email"":""x@y.com""}"')
    expect(r.filename).toMatch(/^auditoria-\d{4}-\d{2}-\d{2}\.csv$/)
  })
})
