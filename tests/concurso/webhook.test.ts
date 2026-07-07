import { beforeEach, describe, expect, it, vi } from 'vitest'

const { enviarEmail, updateSelectSingle, updateEq2, update, from } = vi.hoisted(() => {
  const enviarEmail = vi.fn()
  const updateSelectSingle = vi.fn()
  const updateSelect = vi.fn(() => ({ single: updateSelectSingle }))
  const updateEq2 = vi.fn(() => ({ select: updateSelect }))
  const updateEq1 = vi.fn(() => ({ eq: updateEq2 }))
  const update = vi.fn(() => ({ eq: updateEq1 }))
  const from = vi.fn(() => ({ update }))
  return { enviarEmail, updateSelectSingle, updateEq2, update, from }
})

vi.mock('@/lib/email/send', () => ({
  enviarEmailInscricaoConcurso: enviarEmail,
  enviarEmailIngresso: vi.fn(),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from }) }))

import { confirmarPagamentoConcurso, expirarPagamentoConcurso } from '@/lib/concurso/confirmarPagamento'

describe('confirmarPagamentoConcurso', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marca pago (idempotente) e dispara e-mail', async () => {
    updateSelectSingle.mockResolvedValue({
      data: { id: 'i1', numero: 'CB2027-0001', aluno_nome: 'João', modalidade: 'futsal',
              resp1_nome: 'Maria', resp1_email: 'm@m.com' },
      error: null,
    })
    const r = await confirmarPagamentoConcurso('i1', 24.01)
    expect(r.confirmado).toBe(true)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status_pagamento: 'pago', valor_liquido: 24.01 }))
    expect(updateEq2).toHaveBeenCalledWith('status_pagamento', 'pendente') // idempotência
    expect(enviarEmail).toHaveBeenCalledWith('m@m.com', expect.objectContaining({ numero: 'CB2027-0001', modalidade: 'Futsal' }))
  })

  it('não reenvia e-mail se já estava pago (update não afeta linha)', async () => {
    updateSelectSingle.mockResolvedValue({ data: null, error: { message: 'No rows' } })
    const r = await confirmarPagamentoConcurso('i1')
    expect(r.confirmado).toBe(false)
    expect(enviarEmail).not.toHaveBeenCalled()
  })
})

describe('expirarPagamentoConcurso', () => {
  it('marca expirado apenas se pendente', async () => {
    vi.clearAllMocks()
    updateSelectSingle.mockResolvedValue({ data: { id: 'i1' }, error: null })
    await expirarPagamentoConcurso('i1')
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status_pagamento: 'expirado' }))
    expect(updateEq2).toHaveBeenCalledWith('status_pagamento', 'pendente')
  })
})
