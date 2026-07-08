import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { enviarEmailIngresso, from, rpc, results } = vi.hoisted(() => {
  const enviarEmailIngresso = vi.fn()

  // Resultado por tabela: `single` para .single(), `value` ao aguardar o builder direto
  const results: Record<string, { value: unknown; single?: unknown }> = {}

  // Builder encadeável e "thenable", como o do supabase-js
  function makeBuilder(table: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {}
    for (const m of ['select', 'update', 'eq', 'in']) b[m] = vi.fn(() => b)
    b.single = vi.fn(() => Promise.resolve(results[table]?.single ?? results[table]?.value))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    b.then = (res: any, rej: any) => Promise.resolve(results[table]?.value).then(res, rej)
    return b
  }

  const from = vi.fn((table: string) => makeBuilder(table))
  const rpc = vi.fn(async () => ({ error: null }))
  return { enviarEmailIngresso, from, rpc, results }
})

vi.mock('@/lib/email/send', () => ({
  enviarEmailInscricaoConcurso: vi.fn(),
  enviarEmailIngresso,
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from, rpc }) }))

import { POST } from '@/app/api/webhook/asaas/route'

const INGRESSO = {
  token: 'tok-1',
  produto: { nome: 'Festa Junina', data_evento: '2026-07-20', hora_evento: '18:00', local_evento: 'Quadra', icon: null },
  aluno: { nome: 'João' },
  responsavel: { nome: 'Maria', email: 'm@m.com' },
  pedido: { pedido: { numero: 'PED-0001' } },
}

function setupResults(overrides?: { ingressos?: unknown[] }) {
  results.pagamentos = {
    value: { error: null },
    single: { data: { id: 'pag1', pedido_id: 'ped1', status: 'pendente' }, error: null },
  }
  // A guarda de rowcount em confirmarPagamento exige data com a linha transicionada
  results.pedidos = { value: { data: [{ id: 'ped1' }], error: null } }
  results.itens_pedido = { value: { data: [{ id: 'ip1' }] } }
  results.ingressos = { value: { data: overrides?.ingressos ?? [INGRESSO] } }
}

function makeRequest() {
  return new Request('http://x/api/webhook/asaas', {
    method: 'POST',
    headers: { 'asaas-access-token': 'tok', 'content-type': 'application/json' },
    body: JSON.stringify({
      event: 'PAYMENT_RECEIVED',
      payment: { id: 'pay_1', status: 'RECEIVED', value: 25, netValue: 24.01, billingType: 'PIX' },
    }),
  })
}

describe('POST /api/webhook/asaas — pedido (ingressos)', () => {
  vi.stubEnv('ASAAS_WEBHOOK_TOKEN', 'tok')
  afterAll(() => vi.unstubAllEnvs())
  beforeEach(() => {
    vi.clearAllMocks()
    setupResults()
  })

  it('confirma pedido, gera ingressos e AGUARDA o e-mail antes de responder', async () => {
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(rpc).toHaveBeenCalledWith('gerar_ingressos_pedido', { p_pedido_id: 'ped1' })
    // e-mail enviado dentro do ciclo da request (await), não fire-and-forget
    expect(enviarEmailIngresso).toHaveBeenCalledWith(
      'm@m.com',
      expect.objectContaining({ responsavelNome: 'Maria', alunoNome: 'João', numeroPedido: 'PED-0001', ingressoUrl: 'tok-1' }),
    )
  })

  it('falha no envio de e-mail não derruba o webhook (responde 200)', async () => {
    enviarEmailIngresso.mockRejectedValueOnce(new Error('smtp down'))
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('ingresso sem e-mail do responsável é pulado sem erro', async () => {
    setupResults({ ingressos: [{ ...INGRESSO, responsavel: { nome: 'Maria', email: null } }] })
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    expect(enviarEmailIngresso).not.toHaveBeenCalled()
  })

  it('pagamento já confirmado é idempotente e não reenvia e-mails', async () => {
    results.pagamentos.single = { data: { id: 'pag1', pedido_id: 'ped1', status: 'confirmado' }, error: null }
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, ignored: true, reason: 'Já confirmado.' })
    expect(enviarEmailIngresso).not.toHaveBeenCalled()
  })
})
