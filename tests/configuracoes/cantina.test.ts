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
import { atualizarCantinaAction } from '@/app/actions/configuracoes/cantina'

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

describe('atualizarCantinaAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exige permissão configuracoes.editar_identidade', async () => {
    ;(requirePermission as any).mockRejectedValue(new Error('denied'))
    const r = await atualizarCantinaAction(fd({}))
    expect(requirePermission).toHaveBeenCalledWith('configuracoes.editar_identidade')
    expect(r.error).toBeDefined()
  })

  it('rejeita quando nenhum método de recarga é selecionado', async () => {
    setupHappy()
    const r = await atualizarCantinaAction(fd({
      cantina_metodos_recarga: [],
      cantina_recarga_min: '10',
      cantina_recarga_max: '500',
    }))
    expect(r.error).toMatch(/m[ée]todo/i)
  })

  it('rejeita método de recarga inválido', async () => {
    setupHappy()
    const r = await atualizarCantinaAction(fd({
      cantina_metodos_recarga: ['crypto'],
      cantina_recarga_min: '10',
      cantina_recarga_max: '500',
    }))
    expect(r.error).toMatch(/m[ée]todo/i)
  })

  it('rejeita recarga_min negativo', async () => {
    setupHappy()
    const r = await atualizarCantinaAction(fd({
      cantina_metodos_recarga: ['pix'],
      cantina_recarga_min: '-5',
      cantina_recarga_max: '500',
    }))
    expect(r.error).toMatch(/m[íi]nimo/i)
  })

  it('rejeita recarga_max menor que recarga_min', async () => {
    setupHappy()
    const r = await atualizarCantinaAction(fd({
      cantina_metodos_recarga: ['pix'],
      cantina_recarga_min: '100',
      cantina_recarga_max: '50',
    }))
    expect(r.error).toMatch(/m[áa]ximo/i)
  })

  it('rejeita pin_tamanho < 4 quando exige_pin=true', async () => {
    setupHappy()
    const r = await atualizarCantinaAction(fd({
      cantina_metodos_recarga: ['pix'],
      cantina_recarga_min: '10',
      cantina_recarga_max: '500',
      cantina_exige_pin: 'on',
      cantina_pin_tamanho: '3',
    }))
    expect(r.error).toMatch(/pin/i)
  })

  it('rejeita pin_tamanho > 6 quando exige_pin=true', async () => {
    setupHappy()
    const r = await atualizarCantinaAction(fd({
      cantina_metodos_recarga: ['pix'],
      cantina_recarga_min: '10',
      cantina_recarga_max: '500',
      cantina_exige_pin: 'on',
      cantina_pin_tamanho: '7',
    }))
    expect(r.error).toMatch(/pin/i)
  })

  it('persiste com sucesso o caminho feliz mínimo (defaults)', async () => {
    const { update } = setupHappy()
    const r = await atualizarCantinaAction(fd({
      cantina_metodos_recarga: ['pix', 'cartao'],
      cantina_recarga_min: '10',
      cantina_recarga_max: '500',
      cantina_exige_pin: 'on',
      cantina_pin_tamanho: '4',
    }))
    expect(r).toEqual({ success: true })
    expect(update).toHaveBeenCalledWith({
      cantina_recarga_min: 10,
      cantina_recarga_max: 500,
      cantina_metodos_recarga: ['pix', 'cartao'],
      cantina_exige_pin: true,
      cantina_pin_tamanho: 4,
      cantina_saldo_negativo: false,
    })
  })

  it('persiste happy path completo: saldo negativo + sem PIN (mantém pin_tamanho fallback)', async () => {
    const { update } = setupHappy()
    await atualizarCantinaAction(fd({
      cantina_metodos_recarga: ['pix', 'cartao', 'boleto'],
      cantina_recarga_min: '20',
      cantina_recarga_max: '1000',
      cantina_saldo_negativo: 'on',
    }))
    const payload = (update.mock.calls[0] as unknown[])[0] as any
    expect(payload.cantina_metodos_recarga).toEqual(['pix', 'cartao', 'boleto'])
    expect(payload.cantina_recarga_min).toBe(20)
    expect(payload.cantina_recarga_max).toBe(1000)
    expect(payload.cantina_exige_pin).toBe(false)
    expect(payload.cantina_saldo_negativo).toBe(true)
    expect(payload.cantina_pin_tamanho).toBe(4)
  })

  it('retorna erro quando update falha', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    const eq = vi.fn().mockResolvedValue({ error: { message: 'boom' } })
    ;(createClient as any).mockResolvedValue({ from: vi.fn(() => ({ update: () => ({ eq }) })) })
    const r = await atualizarCantinaAction(fd({
      cantina_metodos_recarga: ['pix'],
      cantina_recarga_min: '10',
      cantina_recarga_max: '500',
      cantina_exige_pin: 'on',
      cantina_pin_tamanho: '4',
    }))
    expect(r.error).toMatch(/salvar|erro/i)
  })

  it('retorna erro quando escola não encontrada', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue(null)
    ;(createClient as any).mockResolvedValue({ from: vi.fn() })
    const r = await atualizarCantinaAction(fd({
      cantina_metodos_recarga: ['pix'],
      cantina_recarga_min: '10',
      cantina_recarga_max: '500',
    }))
    expect(r.error).toMatch(/escola/i)
  })
})
