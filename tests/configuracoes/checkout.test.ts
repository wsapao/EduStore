import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auditoria/log', () => ({ auditLog: vi.fn() }))
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
import { atualizarCheckoutAction } from '@/app/actions/configuracoes/checkout'

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

describe('atualizarCheckoutAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exige permissão configuracoes.editar_identidade', async () => {
    ;(requirePermission as any).mockRejectedValue(new Error('denied'))
    const r = await atualizarCheckoutAction(fd({ carrinho_expiracao_minutos: '60' }))
    expect(requirePermission).toHaveBeenCalledWith('configuracoes.editar_identidade')
    expect(r.error).toBeDefined()
  })

  it('rejeita carrinho_expiracao_minutos <= 0', async () => {
    setupHappy()
    const r = await atualizarCheckoutAction(fd({ carrinho_expiracao_minutos: '0' }))
    expect(r.error).toMatch(/carrinho|expira/i)
  })

  it('rejeita carrinho_expiracao_minutos não numérico', async () => {
    setupHappy()
    const r = await atualizarCheckoutAction(fd({ carrinho_expiracao_minutos: 'abc' }))
    expect(r.error).toMatch(/carrinho|expira/i)
  })

  it('rejeita termo com mais de 5000 caracteres', async () => {
    setupHappy()
    const r = await atualizarCheckoutAction(fd({
      carrinho_expiracao_minutos: '60',
      termo_padrao_compra: 'x'.repeat(5001),
    }))
    expect(r.error).toMatch(/termo/i)
  })

  it('rejeita mensagem_pos_compra com mais de 1000 caracteres', async () => {
    setupHappy()
    const r = await atualizarCheckoutAction(fd({
      carrinho_expiracao_minutos: '60',
      mensagem_pos_compra: 'x'.repeat(1001),
    }))
    expect(r.error).toMatch(/mensagem/i)
  })

  it('persiste happy path mínimo', async () => {
    const { update, eq } = setupHappy()
    const r = await atualizarCheckoutAction(fd({
      carrinho_expiracao_minutos: '90',
    }))
    expect(r).toEqual({ success: true })
    expect(update).toHaveBeenCalledWith({
      termo_padrao_compra: null,
      permite_multiplos_alunos: false,
      mensagem_pos_compra: null,
      carrinho_expiracao_minutos: 90,
      exige_cpf_responsavel: false,
    })
    expect(eq).toHaveBeenCalledWith('escola_id', 'esc-1')
  })

  it('persiste happy path completo', async () => {
    const { update } = setupHappy()
    await atualizarCheckoutAction(fd({
      termo_padrao_compra: 'Termo de uso para esta loja escolar.',
      permite_multiplos_alunos: 'on',
      mensagem_pos_compra: 'Obrigado pela compra!',
      carrinho_expiracao_minutos: '120',
      exige_cpf_responsavel: 'on',
    }))
    expect(update).toHaveBeenCalledWith({
      termo_padrao_compra: 'Termo de uso para esta loja escolar.',
      permite_multiplos_alunos: true,
      mensagem_pos_compra: 'Obrigado pela compra!',
      carrinho_expiracao_minutos: 120,
      exige_cpf_responsavel: true,
    })
  })

  it('retorna erro quando update falha', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    const eq = vi.fn().mockResolvedValue({ error: { message: 'boom' } })
    ;(createClient as any).mockResolvedValue({ from: vi.fn(() => ({ update: () => ({ eq }) })) })
    const r = await atualizarCheckoutAction(fd({ carrinho_expiracao_minutos: '60' }))
    expect(r.error).toMatch(/salvar|erro/i)
  })

  it('retorna erro quando escola não encontrada', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue(null)
    ;(createClient as any).mockResolvedValue({ from: vi.fn() })
    const r = await atualizarCheckoutAction(fd({ carrinho_expiracao_minutos: '60' }))
    expect(r.error).toMatch(/escola/i)
  })
})
