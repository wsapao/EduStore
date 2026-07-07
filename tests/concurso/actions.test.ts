import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const criarPagamento = vi.fn()
vi.mock('@/lib/pagamentos/gateway', () => ({ getGateway: () => ({ criarPagamento }) }))

// Mock encadeável mínimo do supabase-js (padrão da suíte: sempre incluir .select)
const single = vi.fn()
const insertSelect = vi.fn(() => ({ single }))
const insert = vi.fn(() => ({ select: insertSelect }))
const updateEq = vi.fn(() => Promise.resolve({ error: null }))
const update = vi.fn(() => ({ eq: updateEq }))
const maybeSingle = vi.fn()
const selectEq = vi.fn(() => ({ maybeSingle, single: maybeSingle }))
const select = vi.fn(() => ({ eq: selectEq }))
const from = vi.fn(() => ({ insert, update, select }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from }) }))

import {
  criarInscricaoConcurso,
  consultarStatusInscricao,
  gerarNovoPixInscricao,
} from '@/app/actions/concurso'

const INPUT = {
  aluno_nome: 'João', aluno_nascimento: '2015-03-10', serie_2026: '5º ano EF',
  modalidade: 'futsal', instituicao_atual: 'Escola ABC',
  resp1_nome: 'Maria Silva', resp1_cpf: '529.982.247-25', resp1_email: 'maria@email.com',
  resp1_telefone: '', resp1_endereco: '', resp1_profissao: '', resp1_parentesco: 'Mãe',
  resp2_nome: '', resp2_endereco: '', resp2_telefone: '', resp2_profissao: '', resp2_parentesco: '',
  tem_irmaos: false, irmaos_series_2026: '', consentimento: true,
}

const PIX_GATEWAY = {
  metodo: 'pix', gateway_id: 'pay_1', qr_code: 'copiaecola', qr_code_imagem: 'data:image/png;base64,x',
  tx_id: 'tx1', expiracao: '2026-07-15T16:00:00.000Z', status: 'aguardando',
}

describe('criarInscricaoConcurso', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-15T12:00:00-03:00')) // dentro da janela
    single.mockResolvedValue({ data: { id: 'insc-1', numero: 'CB2027-0001' }, error: null })
    criarPagamento.mockResolvedValue({ ...PIX_GATEWAY })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('grava inscrição, cria Pix com referencia concurso:<id> e persiste dados do Pix', async () => {
    const r = await criarInscricaoConcurso(INPUT)
    expect(r.success).toBe(true)
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      modalidade: 'futsal', resp1_cpf: '52998224725', valor: 25, status_pagamento: 'pendente',
    }))
    expect(criarPagamento).toHaveBeenCalledWith(expect.objectContaining({
      metodo: 'pix', total: 25, referencia: 'concurso:insc-1',
      responsavel: { nome: 'Maria Silva', email: 'maria@email.com', cpf: '52998224725' },
    }))
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ gateway_id: 'pay_1' }))
    if (r.success) expect(r.pix.qr_code).toBe('copiaecola')
  })

  it('rejeita fora da janela de inscrições', async () => {
    vi.setSystemTime(new Date('2026-09-01T12:00:00-03:00'))
    const r = await criarInscricaoConcurso(INPUT)
    expect(r.success).toBe(false)
    expect(insert).not.toHaveBeenCalled()
  })

  it('rejeita input inválido sem tocar o banco', async () => {
    const r = await criarInscricaoConcurso({ ...INPUT, resp1_cpf: '111.111.111-11' })
    expect(r.success).toBe(false)
    expect(insert).not.toHaveBeenCalled()
    expect(criarPagamento).not.toHaveBeenCalled()
  })

  it('retorna erro amigável se o gateway falhar (inscrição já gravada)', async () => {
    criarPagamento.mockRejectedValue(new Error('Asaas fora do ar'))
    const r = await criarInscricaoConcurso(INPUT)
    expect(r.success).toBe(false)
    expect(insert).toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })
})

describe('consultarStatusInscricao', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna o status atual', async () => {
    maybeSingle.mockResolvedValue({ data: { status_pagamento: 'pago' }, error: null })
    const r = await consultarStatusInscricao('insc-1')
    expect(r).toEqual({ status: 'pago' })
  })

  it('retorna erro quando a inscrição não existe', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null })
    const r = await consultarStatusInscricao('nao-existe')
    expect(r).toEqual({ error: 'Inscrição não encontrada.' })
  })
})

describe('gerarNovoPixInscricao', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    criarPagamento.mockResolvedValue({ ...PIX_GATEWAY, gateway_id: 'pay_2', tx_id: 'tx2' })
    maybeSingle.mockResolvedValue({
      data: {
        id: 'insc-1', aluno_nome: 'João', modalidade: 'futsal',
        resp1_nome: 'Maria Silva', resp1_email: 'maria@email.com', resp1_cpf: '52998224725',
        status_pagamento: 'expirado', valor: 25,
      },
      error: null,
    })
  })

  it('gera novo Pix e volta status para pendente', async () => {
    const r = await gerarNovoPixInscricao('insc-1')
    expect(r.success).toBe(true)
    expect(criarPagamento).toHaveBeenCalledWith(expect.objectContaining({
      metodo: 'pix', total: 25, referencia: 'concurso:insc-1',
      responsavel: { nome: 'Maria Silva', email: 'maria@email.com', cpf: '52998224725' },
    }))
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status_pagamento: 'pendente', gateway_id: 'pay_2',
    }))
    if (r.success) expect(r.pix.qr_code).toBe('copiaecola')
  })

  it('recusa quando a inscrição já está paga', async () => {
    maybeSingle.mockResolvedValue({
      data: {
        id: 'insc-1', aluno_nome: 'João', modalidade: 'futsal',
        resp1_nome: 'Maria Silva', resp1_email: 'maria@email.com', resp1_cpf: '52998224725',
        status_pagamento: 'pago', valor: 25,
      },
      error: null,
    })
    const r = await gerarNovoPixInscricao('insc-1')
    expect(r).toEqual({ success: false, error: 'Esta inscrição já está paga.' })
    expect(criarPagamento).not.toHaveBeenCalled()
  })

  it('retorna erro quando a inscrição não existe', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null })
    const r = await gerarNovoPixInscricao('nao-existe')
    expect(r).toEqual({ success: false, error: 'Inscrição não encontrada.' })
    expect(criarPagamento).not.toHaveBeenCalled()
  })
})
