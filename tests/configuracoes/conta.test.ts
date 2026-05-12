import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { atualizarPerfilContaAction } from '@/app/actions/configuracoes/conta'

function fd(obj: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(obj)) f.append(k, v)
  return f
}

describe('atualizarPerfilContaAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejeita se não autenticado', async () => {
    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })
    const r = await atualizarPerfilContaAction(fd({ nome: 'João' }))
    expect(r).toEqual({ error: 'Não autenticado.' })
  })

  it('rejeita nome com menos de 3 caracteres', async () => {
    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
    })
    const r = await atualizarPerfilContaAction(fd({ nome: 'Jo' }))
    expect(r.error).toMatch(/3 caracteres/)
  })

  it('atualiza user_metadata.nome via auth.updateUser', async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null })
    ;(createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
        updateUser,
      },
    })
    const r = await atualizarPerfilContaAction(fd({ nome: 'João Silva' }))
    expect(r).toEqual({ success: true })
    expect(updateUser).toHaveBeenCalledWith({ data: { nome: 'João Silva' } })
  })

  it('retorna erro se updateUser falhar', async () => {
    ;(createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
        updateUser: vi.fn().mockResolvedValue({ error: { message: 'boom' } }),
      },
    })
    const r = await atualizarPerfilContaAction(fd({ nome: 'João' }))
    expect(r.error).toMatch(/atualizar/i)
  })
})
