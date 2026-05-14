import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/permissoes', () => ({
  requirePermission: vi.fn(),
  PermissionDeniedError: class extends Error {},
}))
vi.mock('@/lib/escola/getEscolaIdParaAdmin', () => ({ getEscolaIdParaAdmin: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { requirePermission } from '@/lib/permissoes'
import { atualizarLojaOnlineAction } from '@/app/actions/configuracoes/loja-online'

function fd(obj: Record<string, string | string[]>) {
  const formData = new FormData()

  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => formData.append(key, entry))
      continue
    }

    formData.append(key, value)
  }

  return formData
}

function setupHappy() {
  const eq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn(() => ({ eq }))

  ;(requirePermission as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
  ;(getEscolaIdParaAdmin as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('esc-1')
  ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    from: vi.fn(() => ({ update })),
  })

  return { update, eq }
}

describe('atualizarLojaOnlineAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exige permissao configuracoes.editar_identidade', async () => {
    ;(requirePermission as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('denied'))

    const result = await atualizarLojaOnlineAction(fd({}))

    expect(requirePermission).toHaveBeenCalledWith('configuracoes.editar_identidade')
    expect(result.error).toBeDefined()
  })

  it('rejeita layout_home invalido', async () => {
    setupHappy()

    const result = await atualizarLojaOnlineAction(fd({
      layout_home: 'cards',
      loja_funcionamento: '[]',
    }))

    expect(result.error).toMatch(/layout/i)
  })

  it('aceita horario vazio e persiste lista vazia', async () => {
    const { update } = setupHappy()

    const result = await atualizarLojaOnlineAction(fd({
      layout_home: 'grid',
      loja_funcionamento: '[]',
    }))

    expect(result).toEqual({ success: true })
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      loja_funcionamento: [],
    }))
  })

  it('rejeita json invalido em loja_funcionamento', async () => {
    setupHappy()

    const result = await atualizarLojaOnlineAction(fd({
      layout_home: 'grid',
      loja_funcionamento: '{',
    }))

    expect(result.error).toMatch(/hor[áa]rio/i)
  })

  it('rejeita slot com hora invalida', async () => {
    setupHappy()

    const result = await atualizarLojaOnlineAction(fd({
      layout_home: 'grid',
      loja_funcionamento: JSON.stringify([{ dia: 1, inicio: 'ab:cd', fim: '18:00' }]),
    }))

    expect(result.error).toMatch(/hor[áa]rio/i)
  })

  it('rejeita slot com inicio maior ou igual ao fim', async () => {
    setupHappy()

    const result = await atualizarLojaOnlineAction(fd({
      layout_home: 'grid',
      loja_funcionamento: JSON.stringify([{ dia: 1, inicio: '18:00', fim: '18:00' }]),
    }))

    expect(result.error).toMatch(/hor[áa]rio/i)
  })

  it('rejeita mais de 6 produtos em destaque', async () => {
    setupHappy()

    const result = await atualizarLojaOnlineAction(fd({
      layout_home: 'grid',
      loja_funcionamento: '[]',
      produtos_home_destaque: ['1', '2', '3', '4', '5', '6', '7'],
    }))

    expect(result.error).toMatch(/destaque|6/i)
  })

  it('normaliza e remove duplicados de categorias e produtos', async () => {
    const { update } = setupHappy()

    await atualizarLojaOnlineAction(fd({
      layout_home: 'lista',
      loja_funcionamento: '[]',
      categorias_home_visiveis: ['uniforme', 'eventos', 'uniforme', ''],
      produtos_home_destaque: ['prod-2', 'prod-1', 'prod-2'],
    }))

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      categorias_home_visiveis: ['uniforme', 'eventos'],
      produtos_home_destaque: ['prod-2', 'prod-1'],
    }))
  })

  it('persiste payload completo no caminho feliz', async () => {
    const { update, eq } = setupHappy()

    const result = await atualizarLojaOnlineAction(fd({
      modo_manutencao: 'on',
      modo_manutencao_mensagem: 'Loja em manutencao programada',
      layout_home: 'lista',
      mostrar_estoque_baixo: 'on',
      texto_rodape: 'Atendimento: secretaria',
      loja_funcionamento: JSON.stringify([{ dia: 1, inicio: '07:00', fim: '18:00' }]),
      categorias_home_visiveis: ['materiais', 'uniforme'],
      produtos_home_destaque: ['prod-3', 'prod-1'],
    }))

    expect(result).toEqual({ success: true })
    expect(update).toHaveBeenCalledWith({
      modo_manutencao: true,
      modo_manutencao_mensagem: 'Loja em manutencao programada',
      loja_funcionamento: [{ dia: 1, inicio: '07:00', fim: '18:00' }],
      categorias_home_visiveis: ['materiais', 'uniforme'],
      produtos_home_destaque: ['prod-3', 'prod-1'],
      layout_home: 'lista',
      mostrar_estoque_baixo: true,
      texto_rodape: 'Atendimento: secretaria',
    })
    expect(eq).toHaveBeenCalledWith('escola_id', 'esc-1')
  })

  it('retorna erro quando escola nao e encontrada', async () => {
    ;(requirePermission as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ from: vi.fn() })

    const result = await atualizarLojaOnlineAction(fd({
      layout_home: 'grid',
      loja_funcionamento: '[]',
    }))

    expect(result.error).toMatch(/escola/i)
  })

  it('retorna erro quando update falha', async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: 'boom' } })

    ;(requirePermission as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('esc-1')
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: vi.fn(() => ({ update: () => ({ eq }) })),
    })

    const result = await atualizarLojaOnlineAction(fd({
      layout_home: 'grid',
      loja_funcionamento: '[]',
    }))

    expect(result.error).toMatch(/salvar|erro/i)
  })
})
