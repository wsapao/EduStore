import { describe, it, expect } from 'vitest'
import {
  escapeHtml,
  emailConfirmacaoPedido,
  emailPixExpirado,
  emailResetSenhaAdmin,
  emailAvisoTrocaEmail,
  emailIngressoEmitido,
  emailInscricaoConcurso,
} from '@/lib/email/templates'

const SCRIPT = '<script>alert(1)</script>'
const IMG = '<img src=x onerror=alert(1)>'

function expectSemInjecao(html: string) {
  expect(html).not.toContain('<script')
  expect(html).not.toContain('<img src=x')
  // "onerror=" só é perigoso dentro de uma tag real (após "<" não escapado)
  expect(html).not.toMatch(/<[^>]*\bonerror=/)
}

describe('escapeHtml', () => {
  it('escapa os 5 caracteres especiais de HTML', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;')
  })

  it('mantém texto comum intacto (acentos incluídos)', () => {
    expect(escapeHtml('Maria José da Silva — Futsal')).toBe('Maria José da Silva — Futsal')
  })

  it('escapa & antes dos demais (sem duplo escape)', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;')
  })
})

describe('templates escapam dados de usuário', () => {
  it('emailConfirmacaoPedido: nome, pedido, itens, método e pix copia-e-cola', () => {
    const { html } = emailConfirmacaoPedido({
      responsavelNome: SCRIPT,
      numeroPedido: `PED-${IMG}`,
      total: 100,
      metodoPagamento: SCRIPT, // fora do map de labels → interpola direto
      itens: [{ nome: SCRIPT, aluno: IMG, preco: 50 }],
      pedidoUrl: 'https://loja.exemplo/pedido/1"><script>alert(1)</script>',
      pixQrCode: 'data:image/png;base64,abc',
      pixCopiaCola: SCRIPT,
      pixExpiracao: null,
    })
    expectSemInjecao(html)
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('emailConfirmacaoPedido: escapa o título do <head> (via numeroPedido)', () => {
    const { html } = emailConfirmacaoPedido({
      responsavelNome: 'Maria',
      numeroPedido: '</title><script>alert(1)</script>',
      total: 10,
      metodoPagamento: 'pix',
      itens: [],
      pedidoUrl: 'https://loja.exemplo/p/1',
    })
    expectSemInjecao(html)
  })

  it('emailPixExpirado: nome e número do pedido', () => {
    const { html } = emailPixExpirado({
      responsavelNome: SCRIPT,
      numeroPedido: IMG,
      total: 10,
      pedidoUrl: 'https://loja.exemplo/p/1',
    })
    expectSemInjecao(html)
  })

  it('emailResetSenhaAdmin: nome e URL', () => {
    const { html } = emailResetSenhaAdmin({
      responsavelNome: SCRIPT,
      resetUrl: 'https://loja.exemplo/reset?t=1"><script>alert(1)</script>',
    })
    expectSemInjecao(html)
  })

  it('emailAvisoTrocaEmail: nome e e-mails', () => {
    const { html } = emailAvisoTrocaEmail({
      responsavelNome: SCRIPT,
      emailAntigo: `a${IMG}@x.com`,
      emailNovo: `b${SCRIPT}@x.com`,
    })
    expectSemInjecao(html)
  })

  it('emailIngressoEmitido: nomes, produto, local e horário', () => {
    const { html } = emailIngressoEmitido({
      responsavelNome: SCRIPT,
      alunoNome: SCRIPT,
      produtoNome: IMG,
      dataEvento: '2026-08-30',
      horaEvento: `<b>19:00`,
      localEvento: SCRIPT,
      ingressoUrl: 'https://loja.exemplo/i/1',
      numeroPedido: IMG,
    })
    expectSemInjecao(html)
    expect(html).not.toContain('<b>19')
  })

  it('emailInscricaoConcurso: nomes, número e modalidade', () => {
    const { html } = emailInscricaoConcurso({
      responsavelNome: SCRIPT,
      alunoNome: IMG,
      numero: SCRIPT,
      modalidade: IMG,
    })
    expectSemInjecao(html)
  })

  it('não corrompe dados legítimos (regressão)', () => {
    const { html, subject } = emailInscricaoConcurso({
      responsavelNome: 'Maria', alunoNome: 'João', numero: 'CB2027-0001', modalidade: 'Futsal',
    })
    expect(subject).toContain('CB2027-0001')
    expect(html).toContain('João')
    expect(html).toContain('Futsal')
  })
})
