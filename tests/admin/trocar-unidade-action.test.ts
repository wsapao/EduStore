import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { trocarUnidade } from '@/app/actions/trocar-unidade'

function makeSupabaseStub(user: { id: string } | null, upsertError: { message: string } | null = null) {
  const upsert = vi.fn().mockResolvedValue({ data: null, error: upsertError })
  return {
    client: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user } }),
      },
      from: vi.fn((table: string) => {
        if (table !== 'saas_unidade_ativa') throw new Error('unexpected table ' + table)
        return { upsert }
      }),
    } as any,
    upsert,
  }
}

describe('trocarUnidade', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejeita usuário não autenticado sem tocar a tabela', async () => {
    const { client } = makeSupabaseStub(null)
    ;(createClient as any).mockResolvedValue(client)

    const res = await trocarUnidade('esc-1')

    expect(res).toEqual({ ok: false })
    expect(client.from).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('faz upsert de user_id/escola_id em saas_unidade_ativa e revalida o layout', async () => {
    const { client, upsert } = makeSupabaseStub({ id: 'u1' })
    ;(createClient as any).mockResolvedValue(client)

    const res = await trocarUnidade('esc-2')

    expect(res).toEqual({ ok: true })
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', escola_id: 'esc-2' }),
      { onConflict: 'user_id' }
    )
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('retorna ok:false quando o upsert falha (ex.: RLS rejeita escola sem vínculo)', async () => {
    const { client } = makeSupabaseStub({ id: 'u1' }, { message: 'new row violates row-level security policy' })
    ;(createClient as any).mockResolvedValue(client)

    const res = await trocarUnidade('esc-sem-vinculo')

    expect(res).toEqual({ ok: false })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
