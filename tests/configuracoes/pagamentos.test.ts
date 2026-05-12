import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/permissoes', () => ({
  requirePermission: vi.fn(),
  PermissionDeniedError: class extends Error {},
}))
vi.mock('@/lib/escola/getEscolaIdParaAdmin', () => ({ getEscolaIdParaAdmin: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/permissoes'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { atualizarPagamentosAction } from '@/app/actions/configuracoes/pagamentos'

function fd(obj: Record<string, string | string[]>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) v.forEach(x => f.append(k, x))
    else f.append(k, v)
  }
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

describe('atualizarPagamentosAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exige permissão configuracoes.editar_pagamentos', async () => {
    ;(requirePermission as any).mockRejectedValue(new Error('denied'))
    const r = await atualizarPagamentosAction(fd({}))
    expect(requirePermission).toHaveBeenCalledWith('configuracoes.editar_pagamentos')
    expect(r.error).toBeDefined()
  })

  it('rejeita quando nenhum método de pagamento é selecionado', async () => {
    setupHappy()
    const r = await atualizarPagamentosAction(fd({
      metodos_aceitos_padrao: [],
      max_parcelas_padrao: '12',
      pix_expiracao_segundos: '1800',
    }))
    expect(r.error).toMatch(/m[ée]todo/i)
  })

  it('rejeita método inválido', async () => {
    setupHappy()
    const r = await atualizarPagamentosAction(fd({
      metodos_aceitos_padrao: ['bitcoin'],
      max_parcelas_padrao: '12',
      pix_expiracao_segundos: '1800',
    }))
    expect(r.error).toMatch(/m[ée]todo/i)
  })

  it('rejeita parcelas fora do range 1-12', async () => {
    setupHappy()
    const r1 = await atualizarPagamentosAction(fd({
      metodos_aceitos_padrao: ['pix'],
      max_parcelas_padrao: '0',
      pix_expiracao_segundos: '1800',
    }))
    expect(r1.error).toMatch(/parcela/i)

    const r2 = await atualizarPagamentosAction(fd({
      metodos_aceitos_padrao: ['pix'],
      max_parcelas_padrao: '13',
      pix_expiracao_segundos: '1800',
    }))
    expect(r2.error).toMatch(/parcela/i)
  })

  it('rejeita expiração PIX <= 0', async () => {
    setupHappy()
    const r = await atualizarPagamentosAction(fd({
      metodos_aceitos_padrao: ['pix'],
      max_parcelas_padrao: '12',
      pix_expiracao_segundos: '0',
    }))
    expect(r.error).toMatch(/pix/i)
  })

  it('rejeita taxa percentual fora de 0-100 quando taxa_cartao_repassada=true', async () => {
    setupHappy()
    const r = await atualizarPagamentosAction(fd({
      metodos_aceitos_padrao: ['cartao'],
      max_parcelas_padrao: '12',
      pix_expiracao_segundos: '1800',
      taxa_cartao_repassada: 'on',
      taxa_cartao_percentual: '150',
    }))
    expect(r.error).toMatch(/taxa/i)
  })

  it('exige percentual quando taxa_cartao_repassada=true', async () => {
    setupHappy()
    const r = await atualizarPagamentosAction(fd({
      metodos_aceitos_padrao: ['cartao'],
      max_parcelas_padrao: '12',
      pix_expiracao_segundos: '1800',
      taxa_cartao_repassada: 'on',
      taxa_cartao_percentual: '',
    }))
    expect(r.error).toMatch(/percentual|taxa/i)
  })

  it('persiste com sucesso o caminho feliz mínimo', async () => {
    const { update } = setupHappy()
    const r = await atualizarPagamentosAction(fd({
      metodos_aceitos_padrao: ['pix', 'cartao'],
      max_parcelas_padrao: '6',
      pix_expiracao_segundos: '1800',
    }))
    expect(r).toEqual({ success: true })
    expect(update).toHaveBeenCalledWith({
      metodos_aceitos_padrao: ['pix', 'cartao'],
      max_parcelas_padrao: 6,
      pix_expiracao_segundos: 1800,
      taxa_cartao_repassada: false,
      taxa_cartao_percentual: null,
      asaas_webhook_secret: null,
      pix_chave_recebedora: null,
    })
  })

  it('persiste com taxa repassada e percentual', async () => {
    const { update } = setupHappy()
    await atualizarPagamentosAction(fd({
      metodos_aceitos_padrao: ['cartao'],
      max_parcelas_padrao: '12',
      pix_expiracao_segundos: '3600',
      taxa_cartao_repassada: 'on',
      taxa_cartao_percentual: '3.5',
      asaas_webhook_secret: 'secret-abc',
      pix_chave_recebedora: 'chave@email.com',
    }))
    expect(update).toHaveBeenCalledWith({
      metodos_aceitos_padrao: ['cartao'],
      max_parcelas_padrao: 12,
      pix_expiracao_segundos: 3600,
      taxa_cartao_repassada: true,
      taxa_cartao_percentual: 3.5,
      asaas_webhook_secret: 'secret-abc',
      pix_chave_recebedora: 'chave@email.com',
    })
  })

  it('zera taxa_cartao_percentual quando taxa_cartao_repassada=false', async () => {
    const { update } = setupHappy()
    await atualizarPagamentosAction(fd({
      metodos_aceitos_padrao: ['pix'],
      max_parcelas_padrao: '12',
      pix_expiracao_segundos: '1800',
      taxa_cartao_percentual: '5',
    }))
    const payload = (update.mock.calls[0] as unknown[])[0] as any
    expect(payload.taxa_cartao_repassada).toBe(false)
    expect(payload.taxa_cartao_percentual).toBeNull()
  })

  it('retorna erro quando update falha', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    const eq = vi.fn().mockResolvedValue({ error: { message: 'boom' } })
    ;(createClient as any).mockResolvedValue({ from: vi.fn(() => ({ update: () => ({ eq }) })) })
    const r = await atualizarPagamentosAction(fd({
      metodos_aceitos_padrao: ['pix'],
      max_parcelas_padrao: '12',
      pix_expiracao_segundos: '1800',
    }))
    expect(r.error).toMatch(/salvar|erro/i)
  })

  it('retorna erro quando escola não encontrada', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue(null)
    ;(createClient as any).mockResolvedValue({ from: vi.fn() })
    const r = await atualizarPagamentosAction(fd({
      metodos_aceitos_padrao: ['pix'],
      max_parcelas_padrao: '12',
      pix_expiracao_segundos: '1800',
    }))
    expect(r.error).toMatch(/escola/i)
  })
})
