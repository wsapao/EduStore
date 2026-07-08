import { describe, it, expect } from 'vitest'
import { renderEmailTemplate } from '@/lib/email/render'
import { EMAIL_TEMPLATE_META, EMAIL_TEMPLATE_TYPES } from '@/lib/email/templates-config'

describe('renderEmailTemplate', () => {
  it('substitui variáveis whitelisted pelos valores fornecidos', () => {
    const r = renderEmailTemplate(
      'pedido_pago',
      {
        assunto: 'Pedido {{numero_pedido}} pago',
        corpo: 'Olá, {{nome_responsavel}}! Total: {{total}}.',
      },
      {
        numero_pedido: 'PED-1234',
        nome_responsavel: 'Maria Silva',
        total: 'R$ 89,90',
      },
    )

    expect(r.assunto).toBe('Pedido PED-1234 pago')
    expect(r.corpo).toBe('Olá, Maria Silva! Total: R$ 89,90.')
  })

  it('aceita espaços extras dentro das chaves: {{ nome_responsavel }}', () => {
    const r = renderEmailTemplate(
      'pedido_pago',
      { assunto: 'A', corpo: 'Olá, {{ nome_responsavel }}!' },
      { nome_responsavel: 'João' },
    )
    expect(r.corpo).toBe('Olá, João!')
  })

  it('mantém placeholder se a chave não estiver no whitelist do tipo', () => {
    // tipo 'pedido_pago' não conhece a chave 'aluno'
    const r = renderEmailTemplate(
      'pedido_pago',
      { assunto: 'X', corpo: 'Aluno: {{aluno}}' },
      { aluno: 'Pedro' as any },
    )
    expect(r.corpo).toBe('Aluno: {{aluno}}')
  })

  it('variável whitelisted mas não fornecida vira string vazia', () => {
    const r = renderEmailTemplate(
      'pedido_pago',
      { assunto: 'X', corpo: 'Olá, {{nome_responsavel}}! Total {{total}}.' },
      { nome_responsavel: 'Ana' }, // total não fornecido
    )
    expect(r.corpo).toBe('Olá, Ana! Total .')
  })

  it('variável null/undefined vira string vazia', () => {
    const r = renderEmailTemplate(
      'pedido_pago',
      { assunto: 'X', corpo: '{{nome_responsavel}}-{{total}}' },
      { nome_responsavel: null, total: undefined },
    )
    expect(r.corpo).toBe('-')
  })

  it('aceita number e converte para string', () => {
    const r = renderEmailTemplate(
      'pedido_pago',
      { assunto: '{{numero_pedido}}', corpo: '' },
      { numero_pedido: 4321 },
    )
    expect(r.assunto).toBe('4321')
  })

  // Contrato text/plain: o output NÃO é HTML-escapado de propósito — ele só
  // pode ser consumido como texto puro (Resend `text:` ou JSX auto-escapado).
  // Se este teste te incomodar porque você quer enviar o corpo como HTML,
  // escape os valores com escapeHtml (lib/email/templates.ts) no ponto de uso.
  it('contrato text/plain: valores com HTML passam verbatim, sem escapar', () => {
    const r = renderEmailTemplate(
      'pedido_pago',
      { assunto: '{{nome_responsavel}}', corpo: 'Olá, {{nome_responsavel}} & cia' },
      { nome_responsavel: '<b>Maria</b> <img src=x onerror=alert(1)>' },
    )
    // Verbatim (não "&lt;b&gt;..."): o e-mail é texto puro e escapar aqui
    // mostraria entidades HTML cruas para o leitor.
    expect(r.corpo).toBe('Olá, <b>Maria</b> <img src=x onerror=alert(1)> & cia')
    expect(r.assunto).toBe('<b>Maria</b> <img src=x onerror=alert(1)>')
  })
})

describe('EMAIL_TEMPLATE_META manifest', () => {
  it('cobre exatamente os 8 tipos válidos', () => {
    expect(EMAIL_TEMPLATE_TYPES).toHaveLength(8)
    for (const tipo of EMAIL_TEMPLATE_TYPES) {
      expect(EMAIL_TEMPLATE_META[tipo]).toBeDefined()
      expect(EMAIL_TEMPLATE_META[tipo].tipo).toBe(tipo)
    }
  })

  it('todos os defaults usam apenas variáveis declaradas no whitelist', () => {
    for (const tipo of EMAIL_TEMPLATE_TYPES) {
      const meta = EMAIL_TEMPLATE_META[tipo]
      const chavesValidas = new Set(meta.variaveis.map((v) => v.chave))
      const usadas = new Set<string>()
      const re = /\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi
      for (const texto of [meta.defaultAssunto, meta.defaultCorpo]) {
        let m: RegExpExecArray | null
        while ((m = re.exec(texto)) !== null) usadas.add(m[1])
      }
      for (const chave of usadas) {
        expect(chavesValidas, `tipo=${tipo} usa {{${chave}}} fora do whitelist`).toContain(chave)
      }
    }
  })

  it('cada variável declarada tem chave, descricao e exemplo', () => {
    for (const tipo of EMAIL_TEMPLATE_TYPES) {
      for (const v of EMAIL_TEMPLATE_META[tipo].variaveis) {
        expect(v.chave).toMatch(/^[a-z_][a-z0-9_]*$/)
        expect(v.descricao).toBeTruthy()
        expect(v.exemplo).toBeTruthy()
      }
    }
  })
})
