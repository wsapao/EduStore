import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auditoria/log', () => ({ auditLog: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/permissoes', () => ({
  requirePermission: vi.fn(),
  PermissionDeniedError: class extends Error {},
}))
vi.mock('@/lib/escola/getEscolaIdParaAdmin', () => ({ getEscolaIdParaAdmin: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/permissoes'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import {
  publicarVersaoTermosAction,
  listarVersoesTermosAction,
} from '@/app/actions/configuracoes/termos'

function conteudoValido(prefix = 'Conteúdo válido para termos') {
  // 50+ chars
  return prefix + ' ' + 'lorem ipsum dolor sit amet consectetur adipiscing.'
}

function setupPublishHappy(opts: {
  maxVersao?: number | null
  insertError?: { message: string } | null
  userId?: string | null
} = {}) {
  ;(requirePermission as any).mockResolvedValue(undefined)
  ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')

  const maxRow = opts.maxVersao == null ? null : { versao: opts.maxVersao }
  const maybeSingle = vi.fn().mockResolvedValue({ data: maxRow, error: null })
  const limit = vi.fn(() => ({ maybeSingle }))
  const order = vi.fn(() => ({ limit }))
  const eqTipo = vi.fn(() => ({ order }))
  const eqEscola = vi.fn(() => ({ eq: eqTipo }))
  const selectMax = vi.fn(() => ({ eq: eqEscola }))

  const insertResult = { error: opts.insertError ?? null }
  const insert = vi.fn().mockResolvedValue(insertResult)

  const fromMock = vi.fn(() => ({
    select: selectMax,
    insert,
  }))

  const getUser = vi.fn().mockResolvedValue({
    data: { user: opts.userId === undefined ? { id: 'user-1' } : (opts.userId ? { id: opts.userId } : null) },
  })

  ;(createClient as any).mockResolvedValue({
    from: fromMock,
    auth: { getUser },
  })

  return { insert, fromMock }
}

describe('publicarVersaoTermosAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exige permissão configuracoes.editar_identidade', async () => {
    ;(requirePermission as any).mockRejectedValue(new Error('denied'))
    const r = await publicarVersaoTermosAction({ tipo: 'termos_uso', conteudo: conteudoValido() })
    expect(requirePermission).toHaveBeenCalledWith('configuracoes.editar_identidade')
    expect((r as any).error).toBeDefined()
  })

  it('rejeita tipo inválido', async () => {
    setupPublishHappy()
    const r = await publicarVersaoTermosAction({
      tipo: 'invalido' as any,
      conteudo: conteudoValido(),
    })
    expect((r as any).error).toMatch(/tipo/i)
  })

  it('rejeita conteúdo curto (< 50 chars)', async () => {
    setupPublishHappy()
    const r = await publicarVersaoTermosAction({
      tipo: 'termos_uso',
      conteudo: 'curto',
    })
    expect((r as any).error).toMatch(/curto|caracteres/i)
  })

  it('primeira publicação cria versao=1', async () => {
    const { insert } = setupPublishHappy({ maxVersao: null })
    const r = await publicarVersaoTermosAction({
      tipo: 'termos_uso',
      conteudo: conteudoValido(),
    })
    expect(r).toEqual({ success: true, versao: 1 })
    const payload = insert.mock.calls[0][0] as any
    expect(payload.versao).toBe(1)
    expect(payload.tipo).toBe('termos_uso')
    expect(payload.escola_id).toBe('esc-1')
    expect(payload.publicado_por).toBe('user-1')
  })

  it('incrementa versão (max=3 → versao=4)', async () => {
    const { insert } = setupPublishHappy({ maxVersao: 3 })
    const r = await publicarVersaoTermosAction({
      tipo: 'privacidade',
      conteudo: conteudoValido(),
    })
    expect(r).toEqual({ success: true, versao: 4 })
    expect((insert.mock.calls[0][0] as any).versao).toBe(4)
    expect((insert.mock.calls[0][0] as any).tipo).toBe('privacidade')
  })

  it('retorna erro quando insert falha', async () => {
    setupPublishHappy({ maxVersao: 0, insertError: { message: 'boom' } })
    const r = await publicarVersaoTermosAction({
      tipo: 'termos_uso',
      conteudo: conteudoValido(),
    })
    expect((r as any).error).toBeDefined()
  })
})

describe('listarVersoesTermosAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna lista vazia quando não há versões', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')

    const limit = vi.fn().mockResolvedValue({ data: [], error: null })
    const order = vi.fn(() => ({ limit }))
    const eqTipo = vi.fn(() => ({ order }))
    const eqEscola = vi.fn(() => ({ eq: eqTipo }))
    const select = vi.fn(() => ({ eq: eqEscola }))
    ;(createClient as any).mockResolvedValue({
      from: vi.fn(() => ({ select })),
    })

    const r = await listarVersoesTermosAction({ tipo: 'termos_uso' })
    expect(r).toEqual({ versoes: [] })
  })

  it('enriquece com email de publicado_por', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')

    const versoesData = [
      { id: 'v2', versao: 2, publicado_em: '2026-05-14T12:00:00Z', publicado_por: 'user-A' },
      { id: 'v1', versao: 1, publicado_em: '2026-05-13T12:00:00Z', publicado_por: null },
    ]
    const limit = vi.fn().mockResolvedValue({ data: versoesData, error: null })
    const order = vi.fn(() => ({ limit }))
    const eqTipo = vi.fn(() => ({ order }))
    const eqEscola = vi.fn(() => ({ eq: eqTipo }))
    const select = vi.fn(() => ({ eq: eqEscola }))
    ;(createClient as any).mockResolvedValue({
      from: vi.fn(() => ({ select })),
    })

    const getUserById = vi.fn().mockResolvedValue({
      data: { user: { email: 'admin@email.com' } },
      error: null,
    })
    ;(createAdminClient as any).mockReturnValue({
      auth: { admin: { getUserById } },
    })

    const r = await listarVersoesTermosAction({ tipo: 'termos_uso' })
    expect((r as any).versoes).toHaveLength(2)
    expect((r as any).versoes[0]).toMatchObject({
      id: 'v2',
      versao: 2,
      publicado_por_email: 'admin@email.com',
    })
    expect((r as any).versoes[1]).toMatchObject({
      id: 'v1',
      versao: 1,
      publicado_por_email: null,
    })
    expect(getUserById).toHaveBeenCalledWith('user-A')
  })
})
