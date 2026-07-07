# E-mails de Confirmação de Compra — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dois e-mails transacionais ("Pedido recebido" e "Pagamento confirmado") no layout Xkola Store, com itens (foto/qtd/tamanho/aluno), resumo financeiro, bloco por forma de pagamento e texto de abertura editável pelo admin.

**Architecture:** Helpers puros (`pedido-helpers.ts`) + builders de HTML (`templates.ts`) testados por conteúdo; resolução do template editável (`resolver-template.ts`) reaproveitando `getTemplateEmail`/`renderEmailTemplate`; montagem/envio no checkout (`lib/email/checkout.ts` chamado por `orders.ts`) e no webhook Asaas.

**Tech Stack:** Next.js (App Router), Supabase, Resend, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-06-email-confirmacao-compra-design.md`

---

### Task 1: Helpers puros (`pedido-helpers.ts`)

**Files:**
- Create: `lib/email/pedido-helpers.ts`
- Test: `tests/email/pedido-helpers.test.ts`

- [ ] **Step 1: Escrever os testes (falhando)** — `tests/email/pedido-helpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  agruparItensEmail,
  formatarAlunoLabel,
  textoParaHtml,
  escapeHtml,
  fmtBRL,
  fmtDataCurta,
  fmtDataHora,
  type ItemEmailUnitario,
} from '@/lib/email/pedido-helpers'

const unidade = (over: Partial<ItemEmailUnitario> = {}): ItemEmailUnitario => ({
  produtoId: 'p1',
  alunoId: 'a1',
  nome: 'Camiseta Educação Física',
  imagemUrl: null,
  alunoLabel: 'João Pedro · 6º ano B',
  variante: 'Tamanho M',
  precoUnitario: 45,
  ...over,
})

describe('agruparItensEmail', () => {
  it('agrupa unidades iguais somando a quantidade', () => {
    const r = agruparItensEmail([unidade(), unidade()])
    expect(r).toHaveLength(1)
    expect(r[0].quantidade).toBe(2)
    expect(r[0].precoUnitario).toBe(45)
  })

  it('separa por variante', () => {
    const r = agruparItensEmail([unidade(), unidade({ variante: 'Tamanho G' })])
    expect(r).toHaveLength(2)
  })

  it('separa por aluno', () => {
    const r = agruparItensEmail([unidade(), unidade({ alunoId: 'a2', alunoLabel: 'Ana · 3º ano A' })])
    expect(r).toHaveLength(2)
  })

  it('preserva a ordem de aparição', () => {
    const r = agruparItensEmail([
      unidade({ produtoId: 'p2', nome: 'Apostila' }),
      unidade(),
      unidade({ produtoId: 'p2', nome: 'Apostila' }),
    ])
    expect(r.map(i => i.nome)).toEqual(['Apostila', 'Camiseta Educação Física'])
    expect(r[0].quantidade).toBe(2)
  })
})

describe('formatarAlunoLabel', () => {
  it('junta nome, série e turma', () => {
    expect(formatarAlunoLabel('João', '6º ano', 'B')).toBe('João · 6º ano B')
  })
  it('omite detalhe quando não há série nem turma', () => {
    expect(formatarAlunoLabel('João', null, null)).toBe('João')
  })
  it('funciona só com série', () => {
    expect(formatarAlunoLabel('João', '6º ano', null)).toBe('João · 6º ano')
  })
})

describe('textoParaHtml / escapeHtml', () => {
  it('escapa HTML — <script> não sobrevive', () => {
    expect(textoParaHtml('<script>alert(1)</script>')).not.toContain('<script>')
    expect(textoParaHtml('<b>x</b>')).toBe('&lt;b&gt;x&lt;/b&gt;')
  })
  it('converte quebras de linha em <br>', () => {
    expect(textoParaHtml('a\nb\r\nc')).toBe('a<br>b<br>c')
  })
  it('escapeHtml não mexe em quebras de linha', () => {
    expect(escapeHtml('a\nb')).toBe('a\nb')
  })
})

describe('formatadores', () => {
  it('fmtBRL formata em reais', () => {
    expect(fmtBRL(240.35)).toBe('R$ 240,35')
  })
  it('fmtDataCurta não sofre shift de fuso em data pura', () => {
    expect(fmtDataCurta('2026-05-20')).toBe('20/05/2026')
  })
  it('fmtDataHora formata timestamp em horário de Brasília', () => {
    expect(fmtDataHora('2026-07-06T17:32:00Z')).toBe('06/07/2026 às 14:32')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run tests/email/pedido-helpers.test.ts` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar** — `lib/email/pedido-helpers.ts`:

```ts
/**
 * Helpers puros dos e-mails de pedido — sem imports de next/supabase.
 * Testáveis direto no vitest e importáveis de qualquer contexto.
 */

export interface ItemEmailUnitario {
  produtoId: string
  alunoId: string
  nome: string
  imagemUrl: string | null
  alunoLabel: string
  variante: string | null
  precoUnitario: number
}

export interface ItemEmailAgrupado {
  nome: string
  imagemUrl: string | null
  alunoLabel: string
  variante: string | null
  quantidade: number
  precoUnitario: number
}

/** itens_pedido tem uma linha por unidade — agrupa por produto+variante+aluno. */
export function agruparItensEmail(itens: ItemEmailUnitario[]): ItemEmailAgrupado[] {
  const grupos = new Map<string, ItemEmailAgrupado>()
  for (const item of itens) {
    const chave = `${item.produtoId}|${item.variante ?? ''}|${item.alunoId}`
    const existente = grupos.get(chave)
    if (existente) {
      existente.quantidade += 1
    } else {
      grupos.set(chave, {
        nome: item.nome,
        imagemUrl: item.imagemUrl,
        alunoLabel: item.alunoLabel,
        variante: item.variante,
        quantidade: 1,
        precoUnitario: item.precoUnitario,
      })
    }
  }
  return Array.from(grupos.values())
}

export function formatarAlunoLabel(nome: string, serie?: string | null, turma?: string | null): string {
  const detalhe = [serie, turma].filter(Boolean).join(' ')
  return detalhe ? `${nome} · ${detalhe}` : nome
}

export function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Texto plano (ex.: corpo editável do admin) → HTML seguro com <br>. */
export function textoParaHtml(texto: string): string {
  return escapeHtml(texto).replace(/\r?\n/g, '<br>')
}

export function fmtBRL(v: number): string {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Data pura (YYYY-MM-DD) formata sem Date p/ não sofrer shift de fuso. */
export function fmtDataCurta(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

export function fmtDataHora(iso: string): string {
  return new Date(iso)
    .toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
    .replace(', ', ' às ')
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run tests/email/pedido-helpers.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git add lib/email/pedido-helpers.ts tests/email/pedido-helpers.test.ts && git commit -m "feat(email): helpers puros p/ e-mails de pedido (agrupamento, escape, formatação)"`

---

### Task 2: Defaults encurtados dos templates editáveis

**Files:**
- Modify: `lib/email/templates-config.ts` (só os `defaultCorpo` de `confirmacao_pedido_pix|cartao|boleto` e `pedido_pago`)

O corpo editável agora é **texto de abertura** dentro do layout rico — a parte estruturada (total, código PIX, link) virou bloco fixo. Defaults longos duplicariam informação.

- [ ] **Step 1: Substituir os 4 `defaultCorpo`:**

`confirmacao_pedido_pix`:
```ts
    defaultCorpo: `Olá, {{nome_responsavel}}! Recebemos seu pedido {{numero_pedido}}. Ele fica garantido assim que o PIX for pago — o código está logo abaixo.`,
```

`confirmacao_pedido_cartao`:
```ts
    defaultCorpo: `Olá, {{nome_responsavel}}! Recebemos seu pedido {{numero_pedido}} e o pagamento no cartão está em processamento. Você recebe outro e-mail assim que for aprovado.`,
```

`confirmacao_pedido_boleto`:
```ts
    defaultCorpo: `Olá, {{nome_responsavel}}! Recebemos seu pedido {{numero_pedido}}. O boleto está logo abaixo — após o pagamento, a compensação pode levar até 2 dias úteis.`,
```

`pedido_pago`:
```ts
    defaultCorpo: `Olá, {{nome_responsavel}}! O pagamento do pedido {{numero_pedido}} foi confirmado. Agora é com a escola: em breve os itens estarão disponíveis.`,
```

- [ ] **Step 2: Rodar suíte de e-mail/configurações** — `npx vitest run tests/email tests/configuracoes/emails.test.ts` → PASS (nenhum teste asserta o conteúdo dos defaults).

- [ ] **Step 3: Commit** — `git add lib/email/templates-config.ts && git commit -m "feat(email): defaults dos templates viram texto de abertura curto"`

---

### Task 3: Layout Xkola + builders dos dois e-mails

**Files:**
- Modify: `lib/email/templates.ts` (remove `fmtBRL` local e a antiga `emailConfirmacaoPedido`/`EmailPedidoParams`; adiciona `baseXkola`, nova `emailConfirmacaoPedido`, nova `emailPedidoPago`)
- Test: `tests/email/pedido-templates.test.ts`

- [ ] **Step 1: Escrever os testes (falhando)** — `tests/email/pedido-templates.test.ts`:

```ts
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
    expect(html).not.toContain('boleto')
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
      ...base, metodoPagamento: 'cartao', parcelas: 3, total: 120, subtotal: 120,
      pixCopiaCola: null, pixExpiracao: null,
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
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run tests/email/pedido-templates.test.ts` → FAIL.

- [ ] **Step 3: Implementar em `lib/email/templates.ts`:**

Remover a função local `fmtBRL` e importar helpers no topo:

```ts
import {
  fmtBRL,
  fmtDataCurta,
  fmtDataHora,
  escapeHtml,
  type ItemEmailAgrupado,
} from './pedido-helpers'
```

Constantes e moldura Xkola (adicionar após o `base()` legado, que fica para os e-mails ainda não migrados):

```ts
// ── Layout Xkola Store (mesma identidade do convite/reset de senha) ──────────
const FONT_DISPLAY = `'Bricolage Grotesque','Plus Jakarta Sans',Arial,sans-serif`
const FONT_BODY = `'Plus Jakarta Sans',Arial,sans-serif`

const METODO_LABEL: Record<string, string> = {
  pix: 'PIX',
  cartao: 'Cartão de Crédito',
  boleto: 'Boleto Bancário',
}

interface BaseXkolaOpts {
  titulo: string
  preheader: string
  content: string
  rodape: string
}

function baseXkola(o: BaseXkolaOpts): string {
  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(o.titulo)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
    body { margin:0; padding:0; width:100% !important; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table { border-collapse:collapse; }
    img { border:0; line-height:100%; outline:none; text-decoration:none; }
    a { text-decoration:none; }
    .cta:hover { filter:brightness(1.06); }
    @media only screen and (max-width:600px) {
      .card { width:100% !important; border-radius:0 !important; }
      .pad { padding-left:26px !important; padding-right:26px !important; }
      .cta-link { display:block !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background:#faf4ea;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; font-size:1px; line-height:1px; color:#faf4ea;">${escapeHtml(o.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf4ea;">
    <tr>
      <td align="center" style="padding:36px 16px;">
        <table role="presentation" class="card" width="560" cellpadding="0" cellspacing="0" style="width:560px; max-width:560px; background:#ffffff; border-radius:22px; overflow:hidden; box-shadow:0 18px 50px rgba(10,22,40,.12); border:1px solid #efe6d6;">
          <tr>
            <td style="background:#0a1628; background-image:linear-gradient(135deg,#0a1628,#16264a); padding:30px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="46" height="46" align="center" valign="middle" bgcolor="#f59e0b" style="width:46px; height:46px; background:#f59e0b; background-image:linear-gradient(135deg,#f59e0b,#ea580c); border-radius:13px; font-family:${FONT_DISPLAY}; font-size:20px; font-weight:800; color:#ffffff; letter-spacing:-.5px;">XK</td>
                  <td style="vertical-align:middle; padding-left:14px;">
                    <div style="font-family:${FONT_DISPLAY}; font-size:19px; font-weight:800; color:#ffffff; letter-spacing:-.3px; line-height:1;">Xkola Store</div>
                    <div style="font-family:${FONT_BODY}; font-size:12px; font-weight:500; color:#f6b65a; letter-spacing:.04em; padding-top:5px;">A loja digital da sua escola</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="height:4px; background:#f59e0b; background-image:linear-gradient(90deg,#f59e0b,#ea580c); font-size:0; line-height:0;">&nbsp;</td>
          </tr>
          ${o.content}
          <tr>
            <td class="pad" style="padding:28px 44px 34px;">
              <div style="border-top:1px solid #eef1f5; padding-top:16px; font-family:${FONT_BODY}; font-size:12px; line-height:1.6; color:#9aa3b1;">${o.rodape}</div>
            </td>
          </tr>
        </table>
        <div style="font-family:${FONT_BODY}; font-size:11px; color:#b3aa98; padding-top:20px; letter-spacing:.02em;">Xkola Store &middot; Plataforma escolar Xkola</div>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function rodapePedido(escolaNome: string | null | undefined, extra: string): string {
  const escola = escolaNome
    ? `Compra realizada na loja do <strong style="color:#5b6472;">${escapeHtml(escolaNome)}</strong>.`
    : 'Compra realizada na Xkola Store.'
  return `${escola} ${extra} Dúvidas? Fale com a secretaria da escola.`
}

function badge(texto: string): string {
  return `<div style="display:inline-block; font-family:${FONT_BODY}; font-size:11px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#b45309; background:#fef9ec; border:1px solid #fbe3b3; padding:6px 12px; border-radius:999px;">${texto}</div>`
}

function botaoCta(url: string, rotulo: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center">
    <tr>
      <td align="center" bgcolor="#ea580c" style="border-radius:14px; background:#ea580c; background-image:linear-gradient(135deg,#f59e0b,#ea580c); box-shadow:0 8px 20px rgba(234,88,12,.32);">
        <a class="cta cta-link" href="${url}" target="_blank" style="display:inline-block; font-family:${FONT_BODY}; font-size:15px; font-weight:700; color:#ffffff; padding:15px 40px; border-radius:14px; letter-spacing:.01em;">${rotulo}&nbsp;&rarr;</a>
      </td>
    </tr>
  </table>`
}

function thumbItem(i: ItemEmailAgrupado): string {
  if (i.imagemUrl) {
    return `<img src="${i.imagemUrl}" width="56" height="56" alt="" style="display:block; width:56px; height:56px; border-radius:12px; border:1px solid #efe6d6; object-fit:cover;">`
  }
  const inicial = escapeHtml((i.nome.trim().charAt(0) || '•').toUpperCase())
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="56" height="56" align="center" valign="middle" bgcolor="#fef3e2" style="width:56px; height:56px; background:#fef3e2; border:1px solid #fbe3b3; border-radius:12px; font-family:${FONT_DISPLAY}; font-size:20px; font-weight:800; color:#ea580c;">${inicial}</td></tr></table>`
}

function linhaItem(i: ItemEmailAgrupado, ultima: boolean): string {
  const borda = ultima ? '' : ' border-bottom:1px solid #f2ede3;'
  const detalhes = [i.variante, `Qtd ${i.quantidade} × ${fmtBRL(i.precoUnitario)}`]
    .filter(Boolean)
    .map(escapeHtml)
    .join(' &nbsp;·&nbsp; ')
  const aluno = i.alunoLabel
    ? `<div style="font-family:${FONT_BODY}; font-size:12.5px; color:#8a93a1; padding-top:3px;">Aluno: ${escapeHtml(i.alunoLabel)}</div>`
    : ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="56" style="padding:14px 0; vertical-align:top;">${thumbItem(i)}</td>
    <td style="padding:14px 0 14px 16px; vertical-align:top;${borda}">
      <div style="font-family:${FONT_BODY}; font-size:14px; font-weight:700; color:#0a1628;">${escapeHtml(i.nome)}</div>
      ${aluno}
      <div style="font-family:${FONT_BODY}; font-size:12.5px; color:#8a93a1; padding-top:2px;">${detalhes}</div>
    </td>
    <td align="right" style="padding:14px 0; vertical-align:top;${borda} font-family:${FONT_BODY}; font-size:14px; font-weight:700; color:#0a1628; white-space:nowrap;">${fmtBRL(i.quantidade * i.precoUnitario)}</td>
  </tr></table>`
}

function blocoItens(itens: ItemEmailAgrupado[]): string {
  return `<div style="font-family:${FONT_BODY}; font-size:11px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#9aa3b1; padding-bottom:12px; border-bottom:2px solid #0a1628;">Itens do pedido</div>
  ${itens.map((i, idx) => linhaItem(i, idx === itens.length - 1)).join('')}`
}

function blocoResumo(subtotal: number, desconto: number, total: number): string {
  const linhaDesconto = desconto > 0
    ? `<tr>
        <td style="padding:6px 20px 0; font-family:${FONT_BODY}; font-size:13.5px; color:#15803d;">Desconto</td>
        <td align="right" style="padding:6px 20px 0; font-family:${FONT_BODY}; font-size:13.5px; color:#15803d;">&minus; ${fmtBRL(desconto)}</td>
      </tr>`
    : ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc; border:1px solid #eef1f5; border-radius:14px;">
    <tr>
      <td style="padding:16px 20px 0; font-family:${FONT_BODY}; font-size:13.5px; color:#5b6472;">Subtotal</td>
      <td align="right" style="padding:16px 20px 0; font-family:${FONT_BODY}; font-size:13.5px; color:#5b6472;">${fmtBRL(subtotal)}</td>
    </tr>
    ${linhaDesconto}
    <tr>
      <td style="padding:12px 20px 16px; font-family:${FONT_DISPLAY}; font-size:16px; font-weight:800; color:#0a1628;">Total</td>
      <td align="right" style="padding:12px 20px 16px; font-family:${FONT_DISPLAY}; font-size:19px; font-weight:800; color:#0a1628;">${fmtBRL(total)}</td>
    </tr>
  </table>`
}
```

Bloco de pagamento por método + builder do e-mail de pedido recebido (substitui a antiga `emailConfirmacaoPedido` e a interface `EmailPedidoParams`; a interface `ItemEmail` antiga é removida):

```ts
export interface EmailPedidoParams {
  assunto: string
  aberturaHtml: string
  responsavelNome: string
  numeroPedido: string
  dataPedido: string
  metodoPagamento: string
  parcelas: number
  subtotal: number
  desconto: number
  total: number
  itens: ItemEmailAgrupado[]
  pedidoUrl: string
  escolaNome?: string | null
  pixCopiaCola?: string | null
  pixExpiracao?: string | null
  boletoLinhaDigitavel?: string | null
  boletoVencimento?: string | null
  boletoUrl?: string | null
}

function blocoPagamento(p: EmailPedidoParams): string {
  if (p.metodoPagamento === 'pix') {
    const expira = p.pixExpiracao
      ? `<div style="font-family:${FONT_BODY}; font-size:12.5px; color:#8a6a2f; padding-top:4px;">O código expira em <strong>${fmtDataHora(p.pixExpiracao).replace(`/${new Date(p.pixExpiracao).getFullYear()}`, '')}</strong>. Depois disso é preciso gerar um novo.</div>`
      : ''
    const codigo = p.pixCopiaCola
      ? `<tr><td style="padding:14px 20px 0;">
          <div style="background:#ffffff; border:1px dashed #e3c78a; border-radius:10px; padding:12px 14px; font-family:ui-monospace,Menlo,Consolas,monospace; font-size:11px; color:#46505f; word-break:break-all; line-height:1.5;">${escapeHtml(p.pixCopiaCola)}</div>
        </td></tr>
        <tr><td style="padding:10px 20px 18px; font-family:${FONT_BODY}; font-size:12px; color:#8a6a2f;">Copie o código e cole na opção <strong>PIX copia e cola</strong> do app do seu banco — ou abra o pedido para escanear o QR Code.</td></tr>`
      : `<tr><td style="padding:0 20px 18px;"></td></tr>`
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fef9ec; border:1px solid #fbe3b3; border-radius:14px;">
      <tr><td style="padding:18px 20px 0;">
        <span style="font-family:${FONT_BODY}; font-size:14px; font-weight:800; color:#b45309;">Pague com PIX para garantir o pedido</span>
        ${expira}
      </td></tr>
      ${codigo}
    </table>`
  }

  if (p.metodoPagamento === 'boleto') {
    const vencimento = p.boletoVencimento
      ? `<div style="font-family:${FONT_BODY}; font-size:12.5px; color:#8a6a2f; padding-top:4px;">Vencimento: <strong>${fmtDataCurta(p.boletoVencimento)}</strong>. Após o pagamento, a compensação pode levar até 2 dias úteis.</div>`
      : ''
    const linha = p.boletoLinhaDigitavel
      ? `<tr><td style="padding:14px 20px 0;">
          <div style="background:#ffffff; border:1px dashed #e3c78a; border-radius:10px; padding:12px 14px; font-family:ui-monospace,Menlo,Consolas,monospace; font-size:12px; color:#46505f; word-break:break-all; line-height:1.5;">${escapeHtml(p.boletoLinhaDigitavel)}</div>
        </td></tr>`
      : ''
    const link = p.boletoUrl
      ? `<tr><td style="padding:12px 20px 18px; font-family:${FONT_BODY}; font-size:13px;"><a href="${p.boletoUrl}" target="_blank" style="color:#c2410c; font-weight:700;">Baixar boleto (PDF) &rarr;</a></td></tr>`
      : `<tr><td style="padding:0 20px 18px;"></td></tr>`
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fef9ec; border:1px solid #fbe3b3; border-radius:14px;">
      <tr><td style="padding:18px 20px 0;">
        <span style="font-family:${FONT_BODY}; font-size:14px; font-weight:800; color:#b45309;">Pague o boleto para garantir o pedido</span>
        ${vencimento}
      </td></tr>
      ${linha}
      ${link}
    </table>`
  }

  // cartão
  const parcelasLabel = p.parcelas > 1
    ? `${p.parcelas}× de ${fmtBRL(p.total / p.parcelas)}`
    : `à vista (${fmtBRL(p.total)})`
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc; border:1px solid #eef1f5; border-radius:14px;">
    <tr><td style="padding:16px 20px; font-family:${FONT_BODY}; font-size:13px; line-height:1.6; color:#5b6472;">
      <span style="color:#0a1628; font-weight:700;">Pagamento em processamento</span> — Cartão de Crédito · ${parcelasLabel}.<br>
      Você recebe outro e-mail assim que o pagamento for aprovado.
    </td></tr>
  </table>`
}

export function emailConfirmacaoPedido(p: EmailPedidoParams): { subject: string; html: string } {
  const metodo = METODO_LABEL[p.metodoPagamento] ?? p.metodoPagamento
  const content = `
    <tr>
      <td class="pad" style="padding:36px 44px 0;">
        ${badge('Pedido recebido')}
        <h1 style="margin:18px 0 0; font-family:${FONT_DISPLAY}; font-size:26px; line-height:1.2; font-weight:800; color:#0a1628; letter-spacing:-.02em;">Recebemos seu pedido, ${escapeHtml(p.responsavelNome.split(' ')[0])}!</h1>
        <div style="padding-top:10px; font-family:${FONT_BODY}; font-size:13px; color:#8a93a1;">
          Pedido <strong style="color:#0a1628; font-weight:700;">${escapeHtml(p.numeroPedido)}</strong>
          &nbsp;·&nbsp; ${fmtDataCurta(p.dataPedido)} &nbsp;·&nbsp; Pagamento via <strong style="color:#0a1628; font-weight:700;">${metodo}</strong>
        </div>
        <p style="margin:16px 0 0; font-family:${FONT_BODY}; font-size:14.5px; line-height:1.65; color:#46505f;">${p.aberturaHtml}</p>
      </td>
    </tr>
    <tr><td class="pad" style="padding:26px 44px 0;">${blocoItens(p.itens)}</td></tr>
    <tr><td class="pad" style="padding:8px 44px 0;">${blocoResumo(p.subtotal, p.desconto, p.total)}</td></tr>
    <tr><td class="pad" style="padding:20px 44px 0;">${blocoPagamento(p)}</td></tr>
    <tr>
      <td class="pad" align="center" style="padding:26px 44px 8px;">
        ${botaoCta(p.pedidoUrl, 'Acompanhar meu pedido')}
        <div style="font-family:${FONT_BODY}; font-size:12.5px; color:#9aa3b1; padding-top:12px;">Lá você encontra o status do pedido em tempo real.</div>
      </td>
    </tr>`

  return {
    subject: p.assunto,
    html: baseXkola({
      titulo: `Pedido ${p.numeroPedido}`,
      preheader: `Pedido ${p.numeroPedido} recebido — total ${fmtBRL(p.total)}.`,
      content,
      rodape: rodapePedido(p.escolaNome, `Este e-mail se refere ao pedido ${escapeHtml(p.numeroPedido)}.`),
    }),
  }
}
```

Builder do e-mail de pagamento confirmado (novo):

```ts
export interface EmailPedidoPagoParams {
  assunto: string
  aberturaHtml: string
  responsavelNome: string
  numeroPedido: string
  dataPagamento: string
  metodoPagamento: string
  parcelas: number
  total: number
  itens: ItemEmailAgrupado[]
  pedidoUrl: string
  escolaNome?: string | null
  temIngresso: boolean
}

export function emailPedidoPago(p: EmailPedidoPagoParams): { subject: string; html: string } {
  const metodo = METODO_LABEL[p.metodoPagamento] ?? p.metodoPagamento
  const formaLabel = p.metodoPagamento === 'cartao' && p.parcelas > 1 ? `${metodo} · ${p.parcelas}×` : metodo

  const linhasItens = p.itens.map((i, idx) => {
    const borda = idx === p.itens.length - 1 ? '' : ' border-bottom:1px solid #f2ede3;'
    const detalhe = [i.variante, i.alunoLabel ? i.alunoLabel.split(' · ')[0] : null].filter(Boolean).map(escapeHtml).join(' · ')
    return `<tr>
      <td style="padding:11px 0; font-family:${FONT_BODY}; font-size:13.5px; color:#46505f;${borda}">${i.quantidade}× ${escapeHtml(i.nome)}${detalhe ? ` <span style="color:#9aa3b1;">· ${detalhe}</span>` : ''}</td>
      <td align="right" style="padding:11px 0; font-family:${FONT_BODY}; font-size:13.5px; font-weight:700; color:#0a1628; white-space:nowrap;${borda}">${fmtBRL(i.quantidade * i.precoUnitario)}</td>
    </tr>`
  }).join('')

  const avisoIngresso = p.temIngresso
    ? `<tr><td class="pad" style="padding:20px 44px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fef9ec; border:1px solid #fbe3b3; border-radius:14px;">
          <tr><td style="padding:14px 18px; font-family:${FONT_BODY}; font-size:13px; line-height:1.55; color:#5b6472;">
            <span style="color:#b45309; font-weight:700;">&#127903; Seu pedido inclui ingresso:</span> o ingresso digital chega em um e-mail separado, com QR Code para a entrada do evento.
          </td></tr>
        </table>
      </td></tr>`
    : ''

  const content = `
    <tr>
      <td class="pad" align="center" style="padding:38px 44px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>
          <td width="64" height="64" align="center" valign="middle" bgcolor="#ecfdf3" style="width:64px; height:64px; background:#ecfdf3; border:1px solid #bbe7c9; border-radius:50%; font-family:${FONT_BODY}; font-size:30px; font-weight:700; color:#15803d; line-height:1;">&#10003;</td>
        </tr></table>
        <h1 style="margin:18px 0 0; font-family:${FONT_DISPLAY}; font-size:26px; line-height:1.2; font-weight:800; color:#0a1628; letter-spacing:-.02em;">Pagamento confirmado!</h1>
        <p style="margin:12px 0 0; font-family:${FONT_BODY}; font-size:14.5px; line-height:1.65; color:#46505f;">${p.aberturaHtml}</p>
      </td>
    </tr>
    <tr>
      <td class="pad" style="padding:28px 44px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc; border:1px solid #eef1f5; border-radius:14px;">
          <tr>
            <td style="padding:16px 20px 0; font-family:${FONT_BODY}; font-size:13px; color:#8a93a1;">Valor pago</td>
            <td align="right" style="padding:16px 20px 0; font-family:${FONT_DISPLAY}; font-size:17px; font-weight:800; color:#0a1628;">${fmtBRL(p.total)}</td>
          </tr>
          <tr>
            <td style="padding:8px 20px 0; font-family:${FONT_BODY}; font-size:13px; color:#8a93a1;">Forma de pagamento</td>
            <td align="right" style="padding:8px 20px 0; font-family:${FONT_BODY}; font-size:13.5px; font-weight:700; color:#0a1628;">${formaLabel}</td>
          </tr>
          <tr>
            <td style="padding:8px 20px 16px; font-family:${FONT_BODY}; font-size:13px; color:#8a93a1;">Pago em</td>
            <td align="right" style="padding:8px 20px 16px; font-family:${FONT_BODY}; font-size:13.5px; font-weight:700; color:#0a1628;">${fmtDataHora(p.dataPagamento)}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td class="pad" style="padding:22px 44px 0;">
        <div style="font-family:${FONT_BODY}; font-size:11px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#9aa3b1; padding-bottom:10px; border-bottom:2px solid #0a1628;">Pedido ${escapeHtml(p.numeroPedido)}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${linhasItens}</table>
      </td>
    </tr>
    ${avisoIngresso}
    <tr><td class="pad" align="center" style="padding:26px 44px 8px;">${botaoCta(p.pedidoUrl, 'Ver meu pedido')}</td></tr>`

  return {
    subject: p.assunto,
    html: baseXkola({
      titulo: `Pagamento confirmado — ${p.numeroPedido}`,
      preheader: `Pagamento de ${fmtBRL(p.total)} confirmado no pedido ${p.numeroPedido}.`,
      content,
      rodape: rodapePedido(p.escolaNome, 'Guarde este e-mail como comprovante.'),
    }),
  }
}
```

Nota: `send.ts` ainda referencia a antiga assinatura — ajuste mínimo nesta task para compilar (a reescrita real é a Task 5): em `send.ts`, remover o prefixo `SITE_URL` de `enviarEmailPedido` (`pedidoUrl: params.pedidoUrl`). O e-mail antigo `emailPixExpirado` continua usando `base()` e `fmtBRL` importado.

- [ ] **Step 4: Rodar** — `npx vitest run tests/email` → PASS. `npx tsc --noEmit` limpo nos arquivos tocados (orders.ts vai acusar params antigos — aceito até a Task 6; se acusar, comentar não: ver ordem — Tasks 5 e 6 corrigem os call sites; rodar `tsc` completo só na Task 8).

- [ ] **Step 5: Commit** — `git add lib/email/templates.ts lib/email/send.ts tests/email/pedido-templates.test.ts && git commit -m "feat(email): layout Xkola Store + builders de pedido recebido e pago"`

---

### Task 4: Resolver do template editável

**Files:**
- Modify: `lib/email/get-template.ts` (param opcional `client`)
- Create: `lib/email/resolver-template.ts`
- Test: `tests/email/resolver-template.test.ts`

- [ ] **Step 1: Teste (falhando)** — `tests/email/resolver-template.test.ts`:

```ts
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
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar.** Em `get-template.ts`, aceitar client externo (webhook usa admin client; sem cookies o client de servidor não enxerga `email_templates` por RLS):

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export async function getTemplateEmail(
  escolaId: string,
  tipo: EmailTemplateTipo,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client?: SupabaseClient<any, any, any>,
): Promise<{ assunto: string; corpo: string; origem: 'banco' | 'padrao' }> {
  const meta = EMAIL_TEMPLATE_META[tipo]

  try {
    const supabase = client ?? (await createClient())
    // ... (restante idêntico)
```

`lib/email/resolver-template.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { getTemplateEmail } from './get-template'
import { renderEmailTemplate } from './render'
import { textoParaHtml } from './pedido-helpers'
import { EMAIL_TEMPLATE_META, type EmailTemplateTipo } from './templates-config'

/**
 * Resolve assunto + texto de abertura de um e-mail de pedido a partir do
 * template editável (banco ou default), com {{vars}} substituídas e o corpo
 * convertido em HTML seguro (escape + <br>).
 */
export async function resolverTemplatePedido(opts: {
  escolaId: string | null
  tipo: EmailTemplateTipo
  vars: Record<string, string | number | undefined | null>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client?: SupabaseClient<any, any, any>
}): Promise<{ assunto: string; aberturaHtml: string }> {
  const meta = EMAIL_TEMPLATE_META[opts.tipo]
  const tpl = opts.escolaId
    ? await getTemplateEmail(opts.escolaId, opts.tipo, opts.client)
    : { assunto: meta.defaultAssunto, corpo: meta.defaultCorpo }

  const r = renderEmailTemplate(opts.tipo, { assunto: tpl.assunto, corpo: tpl.corpo }, opts.vars)
  return { assunto: r.assunto, aberturaHtml: textoParaHtml(r.corpo) }
}
```

- [ ] **Step 4: Rodar** — `npx vitest run tests/email` → PASS.

- [ ] **Step 5: Commit** — `git add lib/email/get-template.ts lib/email/resolver-template.ts tests/email/resolver-template.test.ts && git commit -m "feat(email): resolver de assunto+abertura a partir do template editável"`

---

### Task 5: `send.ts` — envios novos

**Files:**
- Modify: `lib/email/send.ts`

- [ ] **Step 1: Reescrever `enviarEmailPedido` e adicionar `enviarEmailPedidoPago`.** As URLs já chegam absolutas (montadas pelo chamador); imports novos:

```ts
import {
  emailConfirmacaoPedido,
  emailPedidoPago,
  emailPixExpirado,
  emailIngressoEmitido,
  emailResetSenhaAdmin,
  emailAvisoTrocaEmail,
  type EmailPedidoParams,
  type EmailPedidoPagoParams,
  type EmailPixExpiradoParams,
  type EmailIngressoParams,
  type EmailResetSenhaAdminParams,
  type EmailAvisoTrocaEmailParams,
} from './templates'

// ── Enviar confirmação de pedido ──────────────────────────────────────────────
export async function enviarEmailPedido(to: string, params: EmailPedidoParams) {
  const resend = getResend()
  if (!resend) return // silenciosamente ignora se RESEND_API_KEY não configurado

  const { subject, html } = emailConfirmacaoPedido(params)

  try {
    await resend.emails.send({ from: EMAIL_FROM, to, subject, html })
  } catch (err) {
    // Não quebra o fluxo por falha de email
    console.error('[Email] Erro ao enviar confirmação de pedido:', err)
  }
}

// ── Enviar pagamento confirmado ───────────────────────────────────────────────
export async function enviarEmailPedidoPago(to: string, params: EmailPedidoPagoParams) {
  const resend = getResend()
  if (!resend) return

  const { subject, html } = emailPedidoPago(params)

  try {
    await resend.emails.send({ from: EMAIL_FROM, to, subject, html })
  } catch (err) {
    console.error('[Email] Erro ao enviar pagamento confirmado:', err)
  }
}
```

- [ ] **Step 2: Rodar suíte de e-mail** — `npx vitest run tests/email` → PASS.

- [ ] **Step 3: Commit** — `git add lib/email/send.ts && git commit -m "feat(email): envio do e-mail de pagamento confirmado"`

---

### Task 6: Checkout — montagem e disparo

**Files:**
- Create: `lib/email/checkout.ts`
- Modify: `app/actions/orders.ts` (select de produtos; bloco de envio no passo 6)

- [ ] **Step 1: Criar `lib/email/checkout.ts`:**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { MetodoPagamento } from '@/types/database'
import { SITE_URL } from './resend'
import { enviarEmailPedido, enviarEmailPedidoPago } from './send'
import { resolverTemplatePedido } from './resolver-template'
import type { EmailTemplateTipo } from './templates-config'
import {
  agruparItensEmail,
  formatarAlunoLabel,
  fmtBRL,
  fmtDataCurta,
  fmtDataHora,
  type ItemEmailUnitario,
} from './pedido-helpers'

const TIPO_POR_METODO: Record<MetodoPagamento, EmailTemplateTipo> = {
  pix: 'confirmacao_pedido_pix',
  cartao: 'confirmacao_pedido_cartao',
  boleto: 'confirmacao_pedido_boleto',
}

export interface ProdutoEmailInfo {
  nome?: string | null
  imagem_url?: string | null
  gera_ingresso?: boolean | null
}

export interface EnviarEmailCheckoutInput {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any, any, any>
  responsavel: { nome: string; email: string }
  escolaId: string | null
  pedidoId: string
  numeroPedido: string
  metodo: MetodoPagamento
  parcelas: number
  subtotal: number
  desconto: number
  total: number
  itens: { produto_id: string; aluno_id: string; variante: string | null; preco_unitario: number; nome: string }[]
  produtos: Map<string, ProdutoEmailInfo>
  cartaoAprovado: boolean
  pix?: { copiaCola: string | null; expiracao: string | null }
  boleto?: { linhaDigitavel: string | null; vencimento: string | null; url: string | null }
}

/**
 * Prepara e envia o e-mail do checkout em background. Cartão aprovado na hora
 * recebe direto o e-mail de pagamento confirmado (o webhook, idempotente,
 * não gera segundo e-mail); os demais recebem "pedido recebido".
 * Nunca lança — falha de e-mail não pode quebrar o checkout.
 */
export async function enviarEmailCheckout(input: EnviarEmailCheckoutInput): Promise<void> {
  try {
    const alunoIds = Array.from(new Set(input.itens.map(i => i.aluno_id).filter(Boolean)))
    const { data: alunos } = alunoIds.length > 0
      ? await input.client.from('alunos').select('id, nome, serie, turma').in('id', alunoIds)
      : { data: [] }
    const alunosMap = new Map(
      (alunos ?? []).map((a: { id: string; nome: string; serie: string | null; turma: string | null }) => [a.id, a]),
    )

    let escolaNome: string | null = null
    if (input.escolaId) {
      const { data: escola } = await input.client
        .from('escolas').select('nome').eq('id', input.escolaId).maybeSingle()
      escolaNome = (escola as { nome: string } | null)?.nome ?? null
    }

    const unitarios: ItemEmailUnitario[] = input.itens.map(i => {
      const produto = input.produtos.get(i.produto_id)
      const aluno = alunosMap.get(i.aluno_id)
      return {
        produtoId: i.produto_id,
        alunoId: i.aluno_id,
        nome: produto?.nome ?? i.nome,
        imagemUrl: produto?.imagem_url ?? null,
        alunoLabel: aluno ? formatarAlunoLabel(aluno.nome, aluno.serie, aluno.turma) : '',
        variante: i.variante ? `Tamanho ${i.variante}` : null,
        precoUnitario: i.preco_unitario,
      }
    })
    const itens = agruparItensEmail(unitarios)
    const pedidoUrl = `${SITE_URL}/pedido/${input.pedidoId}`
    const agora = new Date().toISOString()

    const varsBase = {
      nome_responsavel: input.responsavel.nome,
      numero_pedido: input.numeroPedido,
      total: fmtBRL(input.total),
      link_pedido: pedidoUrl,
      nome_escola: escolaNome ?? '',
    }

    if (input.cartaoAprovado) {
      const { assunto, aberturaHtml } = await resolverTemplatePedido({
        escolaId: input.escolaId, tipo: 'pedido_pago', vars: varsBase, client: input.client,
      })
      await enviarEmailPedidoPago(input.responsavel.email, {
        assunto, aberturaHtml,
        responsavelNome: input.responsavel.nome,
        numeroPedido: input.numeroPedido,
        dataPagamento: agora,
        metodoPagamento: input.metodo,
        parcelas: input.parcelas,
        total: input.total,
        itens, pedidoUrl, escolaNome,
        temIngresso: input.itens.some(i => input.produtos.get(i.produto_id)?.gera_ingresso === true),
      })
      return
    }

    const tipo = TIPO_POR_METODO[input.metodo]
    const { assunto, aberturaHtml } = await resolverTemplatePedido({
      escolaId: input.escolaId,
      tipo,
      vars: {
        ...varsBase,
        pix_qr_code: input.pix?.copiaCola ?? '',
        pix_expiracao: input.pix?.expiracao ? fmtDataHora(input.pix.expiracao) : '',
        boleto_url: input.boleto?.url ?? '',
        boleto_vencimento: input.boleto?.vencimento ? fmtDataCurta(input.boleto.vencimento) : '',
      },
      client: input.client,
    })

    await enviarEmailPedido(input.responsavel.email, {
      assunto, aberturaHtml,
      responsavelNome: input.responsavel.nome,
      numeroPedido: input.numeroPedido,
      dataPedido: agora,
      metodoPagamento: input.metodo,
      parcelas: input.parcelas,
      subtotal: input.subtotal,
      desconto: input.desconto,
      total: input.total,
      itens, pedidoUrl, escolaNome,
      pixCopiaCola: input.pix?.copiaCola ?? null,
      pixExpiracao: input.pix?.expiracao ?? null,
      boletoLinhaDigitavel: input.boleto?.linhaDigitavel ?? null,
      boletoVencimento: input.boleto?.vencimento ?? null,
      boletoUrl: input.boleto?.url ?? null,
    })
  } catch (err) {
    console.error('[Email] Erro ao preparar e-mail do pedido:', err)
  }
}
```

- [ ] **Step 2: Ajustar `app/actions/orders.ts`:**

Import: trocar `import { enviarEmailPedido } from '@/lib/email/send'` por `import { enviarEmailCheckout } from '@/lib/email/checkout'`.

Select de produtos (linha ~92) ganha os campos do e-mail:

```ts
  const { data: dbProdutos } = await supabase.from('produtos').select('id, nome, preco, preco_promocional, aceita_vouchers, imagem_url, gera_ingresso').in('id', productIds)
```

Substituir o bloco `// 6. Envia email...` inteiro (o `void enviarEmailPedido(...)` atual) por:

```ts
  // 6. Envia email de confirmação do pedido (em background — não bloqueia)
  void enviarEmailCheckout({
    client: supabase,
    responsavel: { nome: responsavel.nome, email: responsavel.email },
    escolaId: responsavel.escola_id,
    pedidoId: pedido.id,
    numeroPedido: pedido.numero,
    metodo: input.metodo,
    parcelas: input.parcelas ?? 1,
    subtotal: totalCalculado,
    desconto: descontoAplicado,
    total: finalTotal,
    itens: safeItems.map(i => ({
      produto_id: i.produto_id,
      aluno_id: i.aluno_id,
      variante: i.variante ?? null,
      preco_unitario: i.preco_unitario,
      nome: i.nome,
    })),
    produtos: produtosMap,
    cartaoAprovado: resultado.metodo === 'cartao' && resultado.status === 'confirmado',
    pix: resultado.metodo === 'pix'
      ? { copiaCola: resultado.qr_code, expiracao: resultado.expiracao }
      : undefined,
    boleto: resultado.metodo === 'boleto'
      ? { linhaDigitavel: resultado.linha_digitavel, vencimento: resultado.vencimento, url: resultado.url }
      : undefined,
  })
```

- [ ] **Step 3: Typecheck + suíte** — `npx tsc --noEmit` e `npx vitest run` → PASS.

- [ ] **Step 4: Commit** — `git add lib/email/checkout.ts app/actions/orders.ts && git commit -m "feat(checkout): e-mail rico com itens, aluno, foto e resumo; cartão aprovado recebe e-mail de pago"`

---

### Task 7: Webhook Asaas — e-mail de pedido pago

**Files:**
- Modify: `app/api/webhook/asaas/route.ts`

- [ ] **Step 1: Imports novos no topo:**

```ts
import { enviarEmailIngresso, enviarEmailPedidoPago } from '@/lib/email/send'
import { resolverTemplatePedido } from '@/lib/email/resolver-template'
import { SITE_URL } from '@/lib/email/resend'
import { agruparItensEmail, formatarAlunoLabel, fmtBRL, type ItemEmailUnitario } from '@/lib/email/pedido-helpers'
```

- [ ] **Step 2: Em `confirmarPagamento`, após o passo 4 (envio de ingressos), disparar também:**

```ts
  // 5. Envia e-mail de pagamento confirmado em background
  void enviarEmailPedidoPagoWebhook(supabase, pedidoId)
```

- [ ] **Step 3: Adicionar a função (abaixo de `enviarEmailsIngressos`):**

```ts
async function enviarEmailPedidoPagoWebhook(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  pedidoId: string,
): Promise<void> {
  try {
    const { data: pedido } = await supabase
      .from('pedidos')
      .select('id, numero, total, data_pagamento, escola_id, responsavel:responsaveis(nome, email)')
      .eq('id', pedidoId)
      .single()
    if (!pedido?.responsavel?.email) return

    const { data: pagamento } = await supabase
      .from('pagamentos')
      .select('metodo, parcelas')
      .eq('pedido_id', pedidoId)
      .maybeSingle()

    const { data: itens } = await supabase
      .from('itens_pedido')
      .select('produto_id, aluno_id, variante, preco_unitario, produto:produtos(nome, imagem_url, gera_ingresso), aluno:alunos(nome, serie, turma)')
      .eq('pedido_id', pedidoId)

    let escolaNome: string | null = null
    if (pedido.escola_id) {
      const { data: escola } = await supabase
        .from('escolas').select('nome').eq('id', pedido.escola_id).maybeSingle()
      escolaNome = escola?.nome ?? null
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unitarios: ItemEmailUnitario[] = (itens ?? []).map((i: any) => ({
      produtoId: i.produto_id,
      alunoId: i.aluno_id,
      nome: i.produto?.nome ?? '',
      imagemUrl: i.produto?.imagem_url ?? null,
      alunoLabel: i.aluno ? formatarAlunoLabel(i.aluno.nome, i.aluno.serie, i.aluno.turma) : '',
      variante: i.variante ? `Tamanho ${i.variante}` : null,
      precoUnitario: i.preco_unitario,
    }))

    const pedidoUrl = `${SITE_URL}/pedido/${pedido.id}`
    const { assunto, aberturaHtml } = await resolverTemplatePedido({
      escolaId: pedido.escola_id,
      tipo: 'pedido_pago',
      vars: {
        nome_responsavel: pedido.responsavel.nome,
        numero_pedido: pedido.numero,
        total: fmtBRL(pedido.total),
        link_pedido: pedidoUrl,
        nome_escola: escolaNome ?? '',
      },
      client: supabase,
    })

    await enviarEmailPedidoPago(pedido.responsavel.email, {
      assunto,
      aberturaHtml,
      responsavelNome: pedido.responsavel.nome,
      numeroPedido: pedido.numero,
      dataPagamento: pedido.data_pagamento ?? new Date().toISOString(),
      metodoPagamento: pagamento?.metodo ?? 'pix',
      parcelas: pagamento?.parcelas ?? 1,
      total: pedido.total,
      itens: agruparItensEmail(unitarios),
      pedidoUrl,
      escolaNome,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      temIngresso: (itens ?? []).some((i: any) => i.produto?.gera_ingresso === true),
    })
  } catch (err) {
    console.error('[webhook/asaas] Erro ao enviar e-mail de pedido pago:', err)
  }
}
```

- [ ] **Step 4: Typecheck + suíte** — `npx tsc --noEmit` e `npx vitest run` → PASS.

- [ ] **Step 5: Commit** — `git add app/api/webhook/asaas/route.ts && git commit -m "feat(webhook): e-mail de pagamento confirmado ao aprovar pedido"`

---

### Task 8: Verificação final e entrega

- [ ] **Step 1: Suíte completa** — `npx vitest run` → todos passam (350 pré-existentes + novos).
- [ ] **Step 2: Typecheck e lint** — `npx tsc --noEmit` e `npx eslint lib/email app/actions/orders.ts app/api/webhook/asaas/route.ts` limpos.
- [ ] **Step 3: Build** — `npx next build` (prova de compilação; **não** subir dev server local).
- [ ] **Step 4: Push + PR** — `git push -u origin feat/email-confirmacao-compra` e abrir PR com `gh pr create` descrevendo escopo + spec.

## Self-review

- **Cobertura da spec:** layout Xkola (T3), agrupamento (T1), abertura do admin + defaults (T2/T4), plumbing checkout com cartão-aprovado→pago (T6), webhook (T7), erros nunca quebram fluxo (try/catch em checkout.ts e webhook), testes (T1/T3/T4). ✓
- **Consistência de tipos:** `ItemEmailUnitario/ItemEmailAgrupado` definidos em T1 e usados em T3/T6/T7; `EmailPedidoParams`/`EmailPedidoPagoParams` de T3 usados em T5/T6/T7. ✓
- **Sem placeholders.** ✓
