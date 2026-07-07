import { describe, it, expect } from 'vitest'
import { resolverTemplatePedido } from '@/lib/email/resolver-template'

describe('resolverTemplatePedido', () => {
  it('sem escola usa o default do manifest, renderiza vars e escapa HTML', async () => {
    const r = await resolverTemplatePedido({
      escolaId: null,
      tipo: 'pedido_pago',
      vars: { nome_responsavel: 'Maria <script>', numero_pedido: 'PED-9' },
    })
    expect(r.assunto).toContain('PED-9')
    expect(r.aberturaHtml).toContain('Maria &lt;script&gt;')
    expect(r.aberturaHtml).not.toContain('<script>')
    expect(r.aberturaHtml).not.toContain('{{')
  })
})
