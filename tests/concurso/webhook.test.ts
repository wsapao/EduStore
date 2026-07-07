import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { enviarEmail, updateSelectSingle, updateEq2, updateIn, update, from } = vi.hoisted(() => {
  const enviarEmail = vi.fn()
  const updateSelectSingle = vi.fn()
  const updateSelect = vi.fn(() => ({ single: updateSelectSingle }))
  const updateIn = vi.fn(() => ({ select: updateSelect }))
  const updateEq2 = vi.fn(() => ({ select: updateSelect }))
  const updateEq1 = vi.fn(() => ({ eq: updateEq2, in: updateIn }))
  const update = vi.fn(() => ({ eq: updateEq1 }))
  const from = vi.fn(() => ({ update }))
  return { enviarEmail, updateSelectSingle, updateEq2, updateIn, update, from }
})

vi.mock('@/lib/email/send', () => ({
  enviarEmailInscricaoConcurso: enviarEmail,
  enviarEmailIngresso: vi.fn(),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from }) }))

import { confirmarPagamentoConcurso, expirarPagamentoConcurso } from '@/lib/concurso/confirmarPagamento'
import { POST } from '@/app/api/webhook/asaas/route'

const INSCRICAO = {
  id: 'i1', numero: 'CB2027-0001', aluno_nome: 'João', modalidade: 'futsal',
  resp1_nome: 'Maria', resp1_email: 'm@m.com',
}

describe('confirmarPagamentoConcurso', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marca pago (idempotente, aceita pendente ou expirado) e aguarda o e-mail', async () => {
    updateSelectSingle.mockResolvedValue({ data: INSCRICAO, error: null })
    const r = await confirmarPagamentoConcurso('i1', 24.01)
    expect(r.confirmado).toBe(true)
    expect(r.erro).toBeUndefined()
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status_pagamento: 'pago', valor_liquido: 24.01 }))
    // idempotência + pagamento tardio: aceita pendente OU expirado
    expect(updateIn).toHaveBeenCalledWith('status_pagamento', ['pendente', 'expirado'])
    expect(enviarEmail).toHaveBeenCalledWith('m@m.com', expect.objectContaining({ numero: 'CB2027-0001', modalidade: 'Futsal' }))
  })

  it('não reenvia e-mail se já estava pago (PGRST116 = 0 linhas)', async () => {
    updateSelectSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'No rows' } })
    const r = await confirmarPagamentoConcurso('i1')
    expect(r.confirmado).toBe(false)
    expect(r.erro).toBeUndefined()
    expect(enviarEmail).not.toHaveBeenCalled()
  })

  it('sinaliza erro real de banco (código != PGRST116) sem enviar e-mail', async () => {
    updateSelectSingle.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'boom' } })
    const r = await confirmarPagamentoConcurso('i1')
    expect(r.confirmado).toBe(false)
    expect(r.erro).toBe(true)
    expect(enviarEmail).not.toHaveBeenCalled()
  })
})

describe('expirarPagamentoConcurso', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marca expirado apenas se pendente', async () => {
    updateSelectSingle.mockResolvedValue({ data: { id: 'i1' }, error: null })
    await expirarPagamentoConcurso('i1')
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status_pagamento: 'expirado' }))
    expect(updateEq2).toHaveBeenCalledWith('status_pagamento', 'pendente')
  })

  it('não lança em erro real de banco (apenas loga)', async () => {
    updateSelectSingle.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'boom' } })
    await expect(expirarPagamentoConcurso('i1')).resolves.toBeUndefined()
  })
})

describe('POST /api/webhook/asaas — concurso', () => {
  vi.stubEnv('ASAAS_WEBHOOK_TOKEN', 'tok')
  afterAll(() => vi.unstubAllEnvs())
  beforeEach(() => vi.clearAllMocks())

  function makeRequest(event: string, externalReference: string) {
    return new Request('http://x/api/webhook/asaas', {
      method: 'POST',
      headers: { 'asaas-access-token': 'tok', 'content-type': 'application/json' },
      body: JSON.stringify({
        event,
        payment: { id: 'pay_1', status: 'RECEIVED', value: 25, netValue: 24.01, billingType: 'PIX', externalReference },
      }),
    })
  }

  it('PAYMENT_RECEIVED com concurso:<id> confirma inscrição e responde 200', async () => {
    updateSelectSingle.mockResolvedValue({ data: INSCRICAO, error: null })
    const res = await POST(makeRequest('PAYMENT_RECEIVED', 'concurso:i1'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(from).toHaveBeenCalledWith('inscricoes_concurso')
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status_pagamento: 'pago' }))
    expect(enviarEmail).toHaveBeenCalled() // e-mail aguardado antes da resposta
  })

  it('PAYMENT_OVERDUE com concurso:<id> expira a inscrição e responde 200', async () => {
    updateSelectSingle.mockResolvedValue({ data: { id: 'i1' }, error: null })
    const res = await POST(makeRequest('PAYMENT_OVERDUE', 'concurso:i1'))
    expect(res.status).toBe(200)
    expect(from).toHaveBeenCalledWith('inscricoes_concurso')
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status_pagamento: 'expirado' }))
  })

  it('erro real de banco na confirmação responde 500 (Asaas reenvia)', async () => {
    updateSelectSingle.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'boom' } })
    const res = await POST(makeRequest('PAYMENT_RECEIVED', 'concurso:i1'))
    expect(res.status).toBe(500)
    expect(enviarEmail).not.toHaveBeenCalled()
  })

  it('inscrição já paga (PGRST116) responde 200 idempotente', async () => {
    updateSelectSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'No rows' } })
    const res = await POST(makeRequest('PAYMENT_RECEIVED', 'concurso:i1'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(enviarEmail).not.toHaveBeenCalled()
  })
})
