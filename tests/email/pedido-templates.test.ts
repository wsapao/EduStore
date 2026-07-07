import { describe, it, expect } from 'vitest'
import { emailConfirmacaoPedido, emailPedidoPago, type EmailPedidoParams } from '@/lib/email/templates'
import type { ItemEmailAgrupado } from '@/lib/email/pedido-helpers'

const itens: ItemEmailAgrupado[] = [
  { nome: 'Camiseta Educação Física', imagemUrl: 'https://cdn.x/camiseta.png', alunoLabel: 'João Pedro · 6º ano B', variante: 'Tamanho M', quantidade: 2, precoUnitario: 45 },
  { nome: 'Ingresso Festa Junina', imagemUrl: null, alunoLabel: 'Ana Clara · 3º ano A', variante: null, quantidade: 1, precoUnitario: 35 },
]

const base: EmailPedidoParams = {
  assunto: 'Pedido PED-2041 recebido',
  aberturaHtml: 'Olá, Maria! Texto do admin.',
  responsavelNome: 'Maria Santos',
  numeroPedido: 'PED-2041',
  dataPedido: '2026-07-06T15:00:00Z',
  metodoPagamento: 'pix',
  parcelas: 1,
  subtotal: 125,
  desconto: 0,
  total: 125,
  itens,
  pedidoUrl: 'https://loja.esjt.com.br/pedido/abc',
  escolaNome: 'Colégio São Judas Tadeu',
  pixCopiaCola: '00020126PIXCOPIAECOLA6304ABCD',
  pixExpiracao: '2026-07-07T02:59:00Z',
}

describe('emailConfirmacaoPedido', () => {
  it('usa o assunto do template editável como subject', () => {
    expect(emailConfirmacaoPedido(base).subject).toBe('Pedido PED-2041 recebido')
  })

  it('mostra itens com quantidade, aluno, variante e total da linha', () => {
    const { html } = emailConfirmacaoPedido(base)
    expect(html).toContain('Camiseta Educação Física')
    expect(html).toContain('Qtd 2')
    expect(html).toContain('João Pedro · 6º ano B')
    expect(html).toContain('Tamanho M')
    expect(html).toContain('R$ 90,00') // 2 × 45
  })

  it('usa a foto quando existe e a inicial quando não existe', () => {
    const { html } = emailConfirmacaoPedido(base)
    expect(html).toContain('https://cdn.x/camiseta.png')
    expect(html).toContain('>I</td>') // inicial de "Ingresso"
  })

  it('inclui a abertura do admin e o rodapé com a escola', () => {
    const { html } = emailConfirmacaoPedido(base)
    expect(html).toContain('Texto do admin.')
    expect(html).toContain('Colégio São Judas Tadeu')
  })

  it('PIX: mostra copia-e-cola e expiração; não mostra boleto', () => {
    const { html } = emailConfirmacaoPedido(base)
    expect(html).toContain('00020126PIXCOPIAECOLA6304ABCD')
    expect(html).toContain('06/07 às 23:59')
    expect(html.toLowerCase()).not.toContain('boleto')
  })

  it('boleto: linha digitável, vencimento sem shift de fuso e link do PDF', () => {
    const { html } = emailConfirmacaoPedido({
      ...base,
      metodoPagamento: 'boleto',
      pixCopiaCola: null,
      pixExpiracao: null,
      boletoLinhaDigitavel: '34191.79001 01043.510047',
      boletoVencimento: '2026-07-20',
      boletoUrl: 'https://asaas.com/b/x.pdf',
    })
    expect(html).toContain('34191.79001 01043.510047')
    expect(html).toContain('20/07/2026')
    expect(html).toContain('https://asaas.com/b/x.pdf')
  })

  it('cartão: em processamento com parcelas', () => {
    const { html } = emailConfirmacaoPedido({
      ...base,
      metodoPagamento: 'cartao',
      parcelas: 3,
      total: 120,
      subtotal: 120,
      pixCopiaCola: null,
      pixExpiracao: null,
    })
    expect(html).toContain('processamento')
    expect(html).toContain('3× de R$ 40,00')
  })

  it('desconto: linha aparece só quando > 0', () => {
    expect(emailConfirmacaoPedido(base).html).not.toContain('Desconto')
    const { html } = emailConfirmacaoPedido({ ...base, subtotal: 125, desconto: 6.25, total: 118.75 })
    expect(html).toContain('Desconto')
    expect(html).toContain('R$ 6,25')
  })
})

describe('emailPedidoPago', () => {
  const pago = {
    assunto: 'Pagamento confirmado — PED-2041',
    aberturaHtml: 'Obrigado!',
    responsavelNome: 'Maria Santos',
    numeroPedido: 'PED-2041',
    dataPagamento: '2026-07-06T17:32:00Z',
    metodoPagamento: 'pix',
    parcelas: 1,
    total: 125,
    itens,
    pedidoUrl: 'https://loja.esjt.com.br/pedido/abc',
    escolaNome: 'Colégio São Judas Tadeu',
    temIngresso: true,
  }

  it('mostra recibo com valor, forma e data em Brasília', () => {
    const { html, subject } = emailPedidoPago(pago)
    expect(subject).toBe('Pagamento confirmado — PED-2041')
    expect(html).toContain('Pagamento confirmado')
    expect(html).toContain('R$ 125,00')
    expect(html).toContain('PIX')
    expect(html).toContain('06/07/2026 às 14:32')
  })

  it('aviso de ingresso é condicional', () => {
    expect(emailPedidoPago(pago).html).toContain('ingresso')
    expect(emailPedidoPago({ ...pago, temIngresso: false }).html).not.toContain('e-mail separado')
  })

  it('cartão parcelado mostra parcelas no recibo', () => {
    const { html } = emailPedidoPago({ ...pago, metodoPagamento: 'cartao', parcelas: 3 })
    expect(html).toContain('Cartão de Crédito')
    expect(html).toContain('3×')
  })
})
