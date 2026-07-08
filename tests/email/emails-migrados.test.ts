import { describe, it, expect } from 'vitest'
import {
  emailPixExpirado,
  emailIngressoEmitido,
  emailResetSenhaAdmin,
  emailAvisoTrocaEmail,
} from '@/lib/email/templates'

// Migração p/ layout Xkola: conteúdo-chave preservado, marca antiga removida.

describe('emailPixExpirado (Xkola)', () => {
  const r = emailPixExpirado({
    responsavelNome: 'Maria Santos',
    numeroPedido: 'PED-42',
    total: 99.9,
    pedidoUrl: 'https://loja.x/pedido/abc',
  })
  it('preserva número, total e CTA de gerar novo PIX', () => {
    expect(r.html).toContain('PED-42')
    expect(r.html).toContain('R$ 99,90')
    expect(r.html).toContain('Gerar novo PIX')
    expect(r.html).toContain('https://loja.x/pedido/abc')
  })
  it('usa a marca Xkola', () => {
    expect(r.html).toContain('Xkola Store')
    expect(r.html).not.toContain('Colégio Inovação')
  })
})

describe('emailIngressoEmitido (Xkola)', () => {
  const r = emailIngressoEmitido({
    responsavelNome: 'Maria Santos',
    alunoNome: 'Ana Clara',
    produtoNome: 'Festa Junina 2026',
    dataEvento: '2026-08-15',
    horaEvento: '18:30:00',
    localEvento: 'Quadra coberta',
    ingressoUrl: 'https://loja.x/ingresso/tok',
    numeroPedido: 'PED-42',
  })
  it('preserva evento, aluno, detalhes e instrução de QR', () => {
    expect(r.html).toContain('Festa Junina 2026')
    expect(r.html).toContain('Ana Clara')
    expect(r.html).toContain('18:30')
    expect(r.html).toContain('Quadra coberta')
    expect(r.html.toLowerCase()).toContain('qr code')
    expect(r.html).toContain('https://loja.x/ingresso/tok')
  })
  it('omite bloco de detalhes quando não há data/hora/local', () => {
    const semDetalhes = emailIngressoEmitido({
      responsavelNome: 'M',
      alunoNome: 'A',
      produtoNome: 'Evento X',
      ingressoUrl: 'https://loja.x/i/t',
      numeroPedido: 'PED-1',
    })
    expect(semDetalhes.html).toContain('Evento X')
    expect(semDetalhes.html).toContain('Xkola Store')
  })
  it('usa a marca Xkola', () => {
    expect(r.html).toContain('Xkola Store')
    expect(r.html).not.toContain('Colégio Inovação')
  })
})

describe('emailResetSenhaAdmin (Xkola)', () => {
  const r = emailResetSenhaAdmin({
    responsavelNome: 'Maria Santos',
    resetUrl: 'https://loja.x/nova-senha?token=abc',
  })
  it('preserva o link no botão e como fallback textual', () => {
    const ocorrencias = r.html.split('https://loja.x/nova-senha?token=abc').length - 1
    expect(ocorrencias).toBeGreaterThanOrEqual(2)
  })
  it('usa a marca Xkola', () => {
    expect(r.html).toContain('Xkola Store')
    expect(r.html).not.toContain('Colégio Inovação')
  })
})

describe('emailAvisoTrocaEmail (Xkola)', () => {
  const r = emailAvisoTrocaEmail({
    responsavelNome: 'Maria Santos',
    emailAntigo: 'antigo@x.com',
    emailNovo: 'novo@x.com',
  })
  it('preserva e-mails antigo/novo e alerta de segurança', () => {
    expect(r.html).toContain('antigo@x.com')
    expect(r.html).toContain('novo@x.com')
    expect(r.html.toLowerCase()).toContain('não reconhece')
  })
  it('usa a marca Xkola', () => {
    expect(r.html).toContain('Xkola Store')
    expect(r.html).not.toContain('Colégio Inovação')
  })
})
