import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/permissoes', () => ({
  requirePermission: vi.fn(),
  PermissionDeniedError: class extends Error {},
}))
vi.mock('@/lib/escola/getEscolaIdParaAdmin', () => ({ getEscolaIdParaAdmin: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/activesoft', () => ({
  activesoft: { listTurmas: vi.fn() },
}))

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/permissoes'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { activesoft } from '@/lib/activesoft'
import {
  atualizarIntegracoesAction,
  testarActivesoftAction,
  testarCrmAction,
  getStatusAsaasWebhookAction,
  reativarAsaasWebhookAction,
} from '@/app/actions/configuracoes/integracoes'

function fd(obj: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(obj)) f.append(k, v)
  return f
}

function setupHappy() {
  ;(requirePermission as any).mockResolvedValue(undefined)
  ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
  const eq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn(() => ({ eq }))
  ;(createClient as any).mockResolvedValue({ from: vi.fn(() => ({ update })) })
  return { update, eq }
}

describe('atualizarIntegracoesAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exige permissão configuracoes.editar_identidade', async () => {
    ;(requirePermission as any).mockRejectedValue(new Error('denied'))
    const r = await atualizarIntegracoesAction(fd({}))
    expect(requirePermission).toHaveBeenCalledWith('configuracoes.editar_identidade')
    expect(r.error).toBeDefined()
  })

  it('rejeita GA4 ID com formato inválido', async () => {
    setupHappy()
    const r = await atualizarIntegracoesAction(fd({ ga4_id: 'UA-12345' }))
    expect(r.error).toMatch(/GA4/i)
  })

  it('rejeita Meta Pixel ID com não-dígitos', async () => {
    setupHappy()
    const r = await atualizarIntegracoesAction(fd({ meta_pixel_id: 'abc123' }))
    expect(r.error).toMatch(/Pixel/i)
  })

  it('persiste happy path mínimo (todos vazios)', async () => {
    const { update, eq } = setupHappy()
    const r = await atualizarIntegracoesAction(fd({}))
    expect(r).toEqual({ success: true })
    expect(update).toHaveBeenCalledWith({
      activesoft_ativo: false,
      crm_ativo: false,
      ga4_id: null,
      meta_pixel_id: null,
    })
    expect(eq).toHaveBeenCalledWith('escola_id', 'esc-1')
  })

  it('persiste happy path completo com GA4 e Pixel válidos', async () => {
    const { update } = setupHappy()
    const r = await atualizarIntegracoesAction(fd({
      activesoft_ativo: 'on',
      crm_ativo: 'on',
      ga4_id: 'G-ABC123',
      meta_pixel_id: '123456789',
    }))
    expect(r).toEqual({ success: true })
    expect(update).toHaveBeenCalledWith({
      activesoft_ativo: true,
      crm_ativo: true,
      ga4_id: 'G-ABC123',
      meta_pixel_id: '123456789',
    })
  })

  it('retorna erro quando update falha', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    const eq = vi.fn().mockResolvedValue({ error: { message: 'boom' } })
    ;(createClient as any).mockResolvedValue({ from: vi.fn(() => ({ update: () => ({ eq }) })) })
    const r = await atualizarIntegracoesAction(fd({}))
    expect(r.error).toMatch(/salvar|erro/i)
  })

  it('retorna erro quando escola não encontrada', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue(null)
    ;(createClient as any).mockResolvedValue({ from: vi.fn() })
    const r = await atualizarIntegracoesAction(fd({}))
    expect(r.error).toMatch(/escola/i)
  })
})

describe('testarActivesoftAction', () => {
  const ORIG_ENV = { ...process.env }
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requirePermission as any).mockResolvedValue(undefined)
  })
  afterEach(() => {
    process.env = { ...ORIG_ENV }
  })

  it('retorna ok:false se ACTIVESOFT_TOKEN não configurada', async () => {
    delete process.env.ACTIVESOFT_TOKEN
    const r = await testarActivesoftAction()
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/ACTIVESOFT_TOKEN/i)
  })

  it('retorna ok:true com count de turmas no happy path', async () => {
    process.env.ACTIVESOFT_TOKEN = 'tok'
    ;(activesoft.listTurmas as any).mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }])
    const r = await testarActivesoftAction()
    expect(r.ok).toBe(true)
    expect(r.message).toMatch(/3/)
  })
})

describe('testarCrmAction', () => {
  const ORIG_ENV = { ...process.env }
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requirePermission as any).mockResolvedValue(undefined)
  })
  afterEach(() => {
    process.env = { ...ORIG_ENV }
    vi.restoreAllMocks()
  })

  it('retorna ok:false se EDUCRM_API_URL/KEY ausentes', async () => {
    delete process.env.EDUCRM_API_URL
    delete process.env.EDUCRM_API_KEY
    const r = await testarCrmAction()
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/EDUCRM/i)
  })

  it('retorna ok:true se CRM responde 200', async () => {
    process.env.EDUCRM_API_URL = 'https://crm.example.com'
    process.env.EDUCRM_API_KEY = 'key'
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 }) as any
    const r = await testarCrmAction()
    expect(r.ok).toBe(true)
  })
})

describe('getStatusAsaasWebhookAction', () => {
  const ORIG_ENV = { ...process.env }
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requirePermission as any).mockResolvedValue(undefined)
  })
  afterEach(() => {
    process.env = { ...ORIG_ENV }
    vi.restoreAllMocks()
  })

  it('retorna ok:false se ASAAS_API_KEY ausente', async () => {
    delete process.env.ASAAS_API_KEY
    const r = await getStatusAsaasWebhookAction()
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/ASAAS/i)
  })

  it('retorna ok:true com lista de webhooks no happy path', async () => {
    process.env.ASAAS_API_KEY = 'akey'
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { id: 'w1', name: 'Loja', url: 'https://x', interrupted: false, extra: 'ignored' },
          { id: 'w2', name: 'CRM', url: 'https://y', interrupted: true },
        ],
      }),
    }) as any
    const r = await getStatusAsaasWebhookAction()
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.webhooks).toEqual([
        { id: 'w1', name: 'Loja', url: 'https://x', interrupted: false },
        { id: 'w2', name: 'CRM', url: 'https://y', interrupted: true },
      ])
    }
  })
})

describe('reativarAsaasWebhookAction', () => {
  const ORIG_ENV = { ...process.env }
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requirePermission as any).mockResolvedValue(undefined)
  })
  afterEach(() => {
    process.env = { ...ORIG_ENV }
    vi.restoreAllMocks()
  })

  it('reativa webhook com sucesso (PUT interrupted=false)', async () => {
    process.env.ASAAS_API_KEY = 'akey'
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    globalThis.fetch = fetchMock as any
    const r = await reativarAsaasWebhookAction({ webhookId: 'w1' })
    expect(r).toEqual({ success: true })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.asaas.com/v3/webhooks/w1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ interrupted: false }),
      }),
    )
  })
})
