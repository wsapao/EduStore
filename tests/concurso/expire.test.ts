import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => ({ state: { vencidas: [] as {id:string}[], orfas: [] as {id:string}[] } }))

// Mock encadeável: duas queries de SELECT diferentes (vencidas: eq→lt→limit; órfãs: eq→is→lt→limit)
const single = vi.fn(() => Promise.resolve({ data: { id: 'x' }, error: null }))
const updateSelect = vi.fn(() => ({ single }))
const updEq2 = vi.fn(() => ({ select: updateSelect }))
const updEq1 = vi.fn(() => ({ eq: updEq2 }))
const update = vi.fn(() => ({ eq: updEq1 }))

const limitVencidas = vi.fn(() => Promise.resolve({ data: state.vencidas, error: null }))
const ltVencidas = vi.fn(() => ({ limit: limitVencidas }))
const limitOrfas = vi.fn(() => Promise.resolve({ data: state.orfas, error: null }))
const ltOrfas = vi.fn(() => ({ limit: limitOrfas }))
const isNull = vi.fn(() => ({ lt: ltOrfas }))
const eq = vi.fn(() => ({ lt: ltVencidas, is: isNull }))
const select = vi.fn(() => ({ eq }))
const from = vi.fn(() => ({ select, update }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from }) }))

import { expirarPixInscricoesConcurso } from '@/lib/concurso/expirePix'

describe('expirarPixInscricoesConcurso', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.vencidas = []
    state.orfas = []
  })

  it('expira inscrições pendentes com pix vencido', async () => {
    state.vencidas = [{ id: 'a' }, { id: 'b' }]
    const r = await expirarPixInscricoesConcurso()
    expect(r.expiradas).toBe(2)
    expect(update).toHaveBeenCalledTimes(2)
  })

  it('expira órfãs (sem gateway_id) com mais de 1h', async () => {
    state.orfas = [{ id: 'o1' }]
    const r = await expirarPixInscricoesConcurso()
    expect(r.orfasExpiradas).toBe(1)
    expect(isNull).toHaveBeenCalledWith('gateway_id', null)
  })

  it('retorna zeros quando não há nada a expirar', async () => {
    const r = await expirarPixInscricoesConcurso()
    expect(r.expiradas).toBe(0)
    expect(r.orfasExpiradas).toBe(0)
    expect(update).not.toHaveBeenCalled()
  })
})
