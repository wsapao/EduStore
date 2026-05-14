import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/escola/getEscolaIdParaAdmin', () => ({ getEscolaIdParaAdmin: vi.fn() }))
vi.mock('next/headers', () => ({ headers: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { headers } from 'next/headers'
import { auditLog } from '@/lib/auditoria/log'

function makeHeaders(map: Record<string, string> = {}) {
  return {
    get: (key: string) => map[key.toLowerCase()] ?? null,
  }
}

describe('auditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('retorna silencioso quando escola não encontrada (sem insert)', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
    })
    ;(getEscolaIdParaAdmin as any).mockResolvedValue(null)
    ;(headers as any).mockResolvedValue(makeHeaders())
    ;(createAdminClient as any).mockReturnValue({ from: vi.fn(() => ({ insert })) })

    await auditLog({ modulo: 'identidade', acao: 'atualizou' })

    expect(insert).not.toHaveBeenCalled()
  })

  it('chama insert com payload correto no caminho feliz', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const from = vi.fn(() => ({ insert }))
    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    })
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    ;(headers as any).mockResolvedValue(makeHeaders({ 'x-forwarded-for': '1.2.3.4' }))
    ;(createAdminClient as any).mockReturnValue({ from })

    await auditLog({
      modulo: 'pagamentos',
      acao: 'atualizou_config',
      descricao: 'desc',
      metadata: { foo: 'bar' },
    })

    expect(from).toHaveBeenCalledWith('auditoria_log')
    expect(insert).toHaveBeenCalledWith({
      escola_id: 'esc-1',
      user_id: 'user-1',
      modulo: 'pagamentos',
      acao: 'atualizou_config',
      descricao: 'desc',
      metadata: { foo: 'bar' },
      ip: '1.2.3.4',
    })
  })

  it('captura primeiro IP do x-forwarded-for', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    ;(headers as any).mockResolvedValue(makeHeaders({ 'x-forwarded-for': '10.0.0.1, 10.0.0.2, 10.0.0.3' }))
    ;(createAdminClient as any).mockReturnValue({ from: vi.fn(() => ({ insert })) })

    await auditLog({ modulo: 'm', acao: 'a' })

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ ip: '10.0.0.1', user_id: null }))
  })

  it('faz fallback para x-real-ip quando x-forwarded-for ausente', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u' } } }) },
    })
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    ;(headers as any).mockResolvedValue(makeHeaders({ 'x-real-ip': '5.6.7.8' }))
    ;(createAdminClient as any).mockReturnValue({ from: vi.fn(() => ({ insert })) })

    await auditLog({ modulo: 'm', acao: 'a' })

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ ip: '5.6.7.8' }))
  })

  it('silencia exception quando algo falha (não propaga)', async () => {
    ;(createClient as any).mockRejectedValue(new Error('boom'))

    await expect(auditLog({ modulo: 'm', acao: 'a' })).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalled()
  })
})
