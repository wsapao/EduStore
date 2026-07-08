import { describe, it, expect } from 'vitest'
import {
  emailPedidoCancelado,
  emailRecargaAprovada,
  type EmailPedidoCanceladoParams,
  type EmailRecargaAprovadaParams,
} from '@/lib/email/templates'

const NBSP = ' '

describe('emailPedidoCancelado', () => {
  const base: EmailPedidoCanceladoParams = {
    assunto: 'Pedido PED-77 cancelado',
    aberturaHtml: 'Olá, Maria. Abertura do admin.',
    responsavelNome: 'Maria Santos',
    numeroPedido: 'PED-77',
    total: 150,
    motivo: 'Cancelamento realizado pela administração da escola',
    foiPago: false,
    pedidoUrl: 'https://loja.esjt.com.br/pedido/xyz',
    escolaNome: 'Colégio São Judas Tadeu',
  }

  it('usa o assunto do template e mostra número, motivo, abertura e escola', () => {
    const { subject, html } = emailPedidoCancelado(base)
    expect(subject).toBe('Pedido PED-77 cancelado')
    expect(html).toContain('PED-77')
    expect(html).toContain('Cancelamento realizado pela administração da escola')
    expect(html).toContain('Abertura do admin.')
    expect(html).toContain('Colégio São Judas Tadeu')
    expect(html).toContain(`R$${NBSP}150,00`)
    expect(html).toContain('Xkola Store')
  })

  it('bloco de devolução aparece só quando foiPago', () => {
    expect(emailPedidoCancelado(base).html).not.toContain('devolvido')
    expect(emailPedidoCancelado({ ...base, foiPago: true }).html).toContain('devolvido')
  })
})

describe('emailRecargaAprovada', () => {
  const base: EmailRecargaAprovadaParams = {
    assunto: 'Recarga aprovada para João',
    aberturaHtml: 'Olá! Abertura da recarga.',
    responsavelNome: 'Maria Santos',
    alunoNome: 'João Pedro Santos',
    valor: 50,
    saldoAtual: 124.5,
    metodo: 'pix',
    dataConfirmacao: '2026-07-07T17:32:00Z',
    carteiraUrl: 'https://loja.esjt.com.br/cantina/abc',
    escolaNome: 'Colégio São Judas Tadeu',
  }

  it('mostra valor, saldo atual, aluno, forma e data em Brasília', () => {
    const { subject, html } = emailRecargaAprovada(base)
    expect(subject).toBe('Recarga aprovada para João')
    expect(html).toContain(`R$${NBSP}50,00`)
    expect(html).toContain(`R$${NBSP}124,50`)
    expect(html).toContain('João Pedro Santos')
    expect(html).toContain('PIX')
    expect(html).toContain('07/07/2026 às 14:32')
    expect(html).toContain('https://loja.esjt.com.br/cantina/abc')
    expect(html).toContain('Abertura da recarga.')
  })
})
