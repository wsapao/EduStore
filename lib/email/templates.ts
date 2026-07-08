// ── Helpers ───────────────────────────────────────────────────────────────────
import {
  fmtBRL,
  fmtDataCurta,
  fmtDataHora,
  escapeHtml,
  type ItemEmailAgrupado,
} from './pedido-helpers'

// ── Layout base ───────────────────────────────────────────────────────────────
function base(title: string, content: string, escolaNome?: string | null) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 32px;text-align:center;">
            <div style="font-size:28px;margin-bottom:8px;">🏫</div>
            <div style="font-size:20px;font-weight:900;color:#fff;letter-spacing:-.02em;">${escolaNome ? escapeHtml(escolaNome) : 'Loja da sua escola'}</div>
            <div style="font-size:12px;color:rgba(255,255,255,.7);margin-top:2px;">Xkola Store</div>
          </td>
        </tr>

        <!-- Content -->
        <tr><td style="padding:32px;">
          ${content}
        </td></tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">
              Você recebeu este email porque realizou uma compra na loja da sua escola.<br>
              Em caso de dúvidas, entre em contato com a secretaria do colégio.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

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
        <a class="cta cta-link" href="${escapeHtml(url)}" target="_blank" style="display:inline-block; font-family:${FONT_BODY}; font-size:15px; font-weight:700; color:#ffffff; padding:15px 40px; border-radius:14px; letter-spacing:.01em;">${rotulo}&nbsp;&rarr;</a>
      </td>
    </tr>
  </table>`
}

function thumbItem(i: ItemEmailAgrupado): string {
  if (i.imagemUrl) {
    return `<img src="${escapeHtml(i.imagemUrl)}" width="56" height="56" alt="" style="display:block; width:56px; height:56px; border-radius:12px; border:1px solid #efe6d6; object-fit:cover;">`
  }
  const inicial = escapeHtml((i.nome.trim().charAt(0) || '•').toUpperCase())
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="56" height="56" align="center" valign="middle" bgcolor="#fef3e2" style="width:56px; height:56px; background:#fef3e2; border:1px solid #fbe3b3; border-radius:12px; font-family:${FONT_DISPLAY}; font-size:20px; font-weight:800; color:#ea580c;">${inicial}</td></tr></table>`
}

function linhaItem(i: ItemEmailAgrupado, ultima: boolean): string {
  const borda = ultima ? '' : ' border-bottom:1px solid #f2ede3;'
  const detalhes = [i.variante, `Qtd ${i.quantidade} × ${fmtBRL(i.precoUnitario)}`]
    .filter((d): d is string => Boolean(d))
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

// ── Template: Confirmação de pedido (pedido recebido) ────────────────────────
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
      ? `<tr><td style="padding:12px 20px 18px; font-family:${FONT_BODY}; font-size:13px;"><a href="${escapeHtml(p.boletoUrl)}" target="_blank" style="color:#c2410c; font-weight:700;">Baixar boleto (PDF) &rarr;</a></td></tr>`
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

// ── Template: Pagamento confirmado ────────────────────────────────────────────
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
    const detalhe = [i.variante, i.alunoLabel ? i.alunoLabel.split(' · ')[0] : null]
      .filter((d): d is string => Boolean(d))
      .map(escapeHtml)
      .join(' · ')
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

// ── Template: Pedido cancelado ────────────────────────────────────────────────
export interface EmailPedidoCanceladoParams {
  assunto: string
  aberturaHtml: string
  responsavelNome: string
  numeroPedido: string
  total: number
  motivo: string
  foiPago: boolean
  pedidoUrl: string
  escolaNome?: string | null
}

export function emailPedidoCancelado(p: EmailPedidoCanceladoParams): { subject: string; html: string } {
  const badgeCancelado = `<div style="display:inline-block; font-family:${FONT_BODY}; font-size:11px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#b91c1c; background:#fef2f2; border:1px solid #fecaca; padding:6px 12px; border-radius:999px;">Pedido cancelado</div>`

  const blocoDevolucao = p.foiPago
    ? `<tr><td class="pad" style="padding:20px 44px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fef9ec; border:1px solid #fbe3b3; border-radius:14px;">
          <tr><td style="padding:14px 18px; font-family:${FONT_BODY}; font-size:13px; line-height:1.6; color:#5b6472;">
            <span style="color:#b45309; font-weight:700;">Sobre o valor pago:</span> o pagamento deste pedido já tinha sido confirmado, então o valor de <strong style="color:#0a1628;">${fmtBRL(p.total)}</strong> será devolvido. A escola entrará em contato com os detalhes da devolução.
          </td></tr>
        </table>
      </td></tr>`
    : ''

  const content = `
    <tr>
      <td class="pad" style="padding:36px 44px 0;">
        ${badgeCancelado}
        <h1 style="margin:18px 0 0; font-family:${FONT_DISPLAY}; font-size:26px; line-height:1.2; font-weight:800; color:#0a1628; letter-spacing:-.02em;">Seu pedido foi cancelado</h1>
        <div style="padding-top:10px; font-family:${FONT_BODY}; font-size:13px; color:#8a93a1;">
          Pedido <strong style="color:#0a1628; font-weight:700;">${escapeHtml(p.numeroPedido)}</strong>
          &nbsp;·&nbsp; Total <strong style="color:#0a1628; font-weight:700;">${fmtBRL(p.total)}</strong>
        </div>
        <p style="margin:16px 0 0; font-family:${FONT_BODY}; font-size:14.5px; line-height:1.65; color:#46505f;">${p.aberturaHtml}</p>
      </td>
    </tr>
    <tr>
      <td class="pad" style="padding:24px 44px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc; border:1px solid #eef1f5; border-radius:14px;">
          <tr><td style="padding:14px 18px; font-family:${FONT_BODY}; font-size:13px; line-height:1.6; color:#5b6472;">
            <span style="color:#0a1628; font-weight:700;">Motivo:</span> ${escapeHtml(p.motivo)}
          </td></tr>
        </table>
      </td>
    </tr>
    ${blocoDevolucao}
    <tr>
      <td class="pad" align="center" style="padding:26px 44px 8px;">
        ${botaoCta(p.pedidoUrl, 'Ver meu pedido')}
        <div style="font-family:${FONT_BODY}; font-size:12.5px; color:#9aa3b1; padding-top:12px;">Se quiser comprar novamente, é só voltar à loja.</div>
      </td>
    </tr>`

  return {
    subject: p.assunto,
    html: baseXkola({
      titulo: `Pedido cancelado — ${p.numeroPedido}`,
      preheader: `O pedido ${p.numeroPedido} foi cancelado.`,
      content,
      rodape: rodapePedido(p.escolaNome, `Este e-mail se refere ao pedido ${escapeHtml(p.numeroPedido)}.`),
    }),
  }
}

// ── Template: Recarga de cantina aprovada ─────────────────────────────────────
export interface EmailRecargaAprovadaParams {
  assunto: string
  aberturaHtml: string
  responsavelNome: string
  alunoNome: string
  valor: number
  saldoAtual: number
  metodo: string
  dataConfirmacao: string
  carteiraUrl: string
  escolaNome?: string | null
}

export function emailRecargaAprovada(p: EmailRecargaAprovadaParams): { subject: string; html: string } {
  const metodo = METODO_LABEL[p.metodo] ?? p.metodo

  const content = `
    <tr>
      <td class="pad" align="center" style="padding:38px 44px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>
          <td width="64" height="64" align="center" valign="middle" bgcolor="#ecfdf3" style="width:64px; height:64px; background:#ecfdf3; border:1px solid #bbe7c9; border-radius:50%; font-family:${FONT_BODY}; font-size:30px; font-weight:700; color:#15803d; line-height:1;">&#10003;</td>
        </tr></table>
        <h1 style="margin:18px 0 0; font-family:${FONT_DISPLAY}; font-size:26px; line-height:1.2; font-weight:800; color:#0a1628; letter-spacing:-.02em;">Recarga aprovada!</h1>
        <p style="margin:12px 0 0; font-family:${FONT_BODY}; font-size:14.5px; line-height:1.65; color:#46505f;">${p.aberturaHtml}</p>
      </td>
    </tr>
    <tr>
      <td class="pad" style="padding:28px 44px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc; border:1px solid #eef1f5; border-radius:14px;">
          <tr>
            <td style="padding:16px 20px 0; font-family:${FONT_BODY}; font-size:13px; color:#8a93a1;">Valor recarregado</td>
            <td align="right" style="padding:16px 20px 0; font-family:${FONT_DISPLAY}; font-size:17px; font-weight:800; color:#15803d;">+ ${fmtBRL(p.valor)}</td>
          </tr>
          <tr>
            <td style="padding:8px 20px 0; font-family:${FONT_BODY}; font-size:13px; color:#8a93a1;">Cartão da cantina de</td>
            <td align="right" style="padding:8px 20px 0; font-family:${FONT_BODY}; font-size:13.5px; font-weight:700; color:#0a1628;">${escapeHtml(p.alunoNome)}</td>
          </tr>
          <tr>
            <td style="padding:8px 20px 0; font-family:${FONT_BODY}; font-size:13px; color:#8a93a1;">Forma de pagamento</td>
            <td align="right" style="padding:8px 20px 0; font-family:${FONT_BODY}; font-size:13.5px; font-weight:700; color:#0a1628;">${escapeHtml(metodo)}</td>
          </tr>
          <tr>
            <td style="padding:8px 20px 0; font-family:${FONT_BODY}; font-size:13px; color:#8a93a1;">Aprovada em</td>
            <td align="right" style="padding:8px 20px 0; font-family:${FONT_BODY}; font-size:13.5px; font-weight:700; color:#0a1628;">${fmtDataHora(p.dataConfirmacao)}</td>
          </tr>
          <tr>
            <td style="padding:14px 20px 16px; font-family:${FONT_DISPLAY}; font-size:15px; font-weight:800; color:#0a1628; border-top:1px solid #eef1f5;">Saldo atual</td>
            <td align="right" style="padding:14px 20px 16px; font-family:${FONT_DISPLAY}; font-size:19px; font-weight:800; color:#0a1628; border-top:1px solid #eef1f5;">${fmtBRL(p.saldoAtual)}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr><td class="pad" align="center" style="padding:26px 44px 8px;">${botaoCta(p.carteiraUrl, 'Ver carteira da cantina')}</td></tr>`

  return {
    subject: p.assunto,
    html: baseXkola({
      titulo: `Recarga aprovada — ${p.alunoNome}`,
      preheader: `Recarga de ${fmtBRL(p.valor)} aprovada. Saldo atual: ${fmtBRL(p.saldoAtual)}.`,
      content,
      rodape: rodapePedido(p.escolaNome, 'Guarde este e-mail como comprovante.'),
    }),
  }
}

export interface EmailPixExpiradoParams {
  responsavelNome: string
  numeroPedido: string
  total: number
  pedidoUrl: string
}

export function emailPixExpirado(p: EmailPixExpiradoParams): { subject: string; html: string } {
  const content = `
    <tr>
      <td class="pad" style="padding:36px 44px 0;">
        ${badge('PIX expirado')}
        <h1 style="margin:18px 0 0; font-family:${FONT_DISPLAY}; font-size:26px; line-height:1.2; font-weight:800; color:#0a1628; letter-spacing:-.02em;">Seu PIX expirou</h1>
        <p style="margin:16px 0 0; font-family:${FONT_BODY}; font-size:14.5px; line-height:1.65; color:#46505f;">
          Olá, <strong style="color:#0a1628;">${escapeHtml(p.responsavelNome)}</strong>! O PIX do pedido <strong style="color:#0a1628;">${escapeHtml(p.numeroPedido)}</strong> venceu, mas o pedido continua disponível — é só gerar um novo código.
        </p>
      </td>
    </tr>
    <tr>
      <td class="pad" style="padding:24px 44px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc; border:1px solid #eef1f5; border-radius:14px;">
          <tr>
            <td style="padding:16px 20px 0; font-family:${FONT_BODY}; font-size:13px; color:#8a93a1;">Pedido</td>
            <td align="right" style="padding:16px 20px 0; font-family:${FONT_BODY}; font-size:13.5px; font-weight:700; color:#0a1628;">${escapeHtml(p.numeroPedido)}</td>
          </tr>
          <tr>
            <td style="padding:8px 20px 16px; font-family:${FONT_BODY}; font-size:13px; color:#8a93a1;">Total</td>
            <td align="right" style="padding:8px 20px 16px; font-family:${FONT_DISPLAY}; font-size:17px; font-weight:800; color:#0a1628;">${fmtBRL(p.total)}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td class="pad" style="padding:20px 44px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fef9ec; border:1px solid #fbe3b3; border-radius:14px;">
          <tr><td style="padding:14px 18px; font-family:${FONT_BODY}; font-size:13px; line-height:1.6; color:#5b6472;">
            Abra o pedido para gerar um novo PIX e concluir a compra <strong style="color:#b45309;">sem montar o carrinho de novo</strong>.
          </td></tr>
        </table>
      </td>
    </tr>
    <tr><td class="pad" align="center" style="padding:26px 44px 8px;">${botaoCta(p.pedidoUrl, 'Gerar novo PIX')}</td></tr>`

  return {
    subject: `PIX expirado no pedido ${p.numeroPedido}`,
    html: baseXkola({
      titulo: `PIX expirado — ${p.numeroPedido}`,
      preheader: `O PIX do pedido ${p.numeroPedido} venceu — gere um novo código.`,
      content,
      rodape: `Este e-mail se refere ao pedido ${escapeHtml(p.numeroPedido)}. Dúvidas? Fale com a secretaria da escola.`,
    }),
  }
}

export interface EmailResetSenhaAdminParams {
  responsavelNome: string
  resetUrl: string
}

export function emailResetSenhaAdmin(p: EmailResetSenhaAdminParams): { subject: string; html: string } {
  const content = `
    <tr>
      <td class="pad" style="padding:36px 44px 0;">
        ${badge('Segurança')}
        <h1 style="margin:18px 0 0; font-family:${FONT_DISPLAY}; font-size:26px; line-height:1.2; font-weight:800; color:#0a1628; letter-spacing:-.02em;">Redefinição de senha</h1>
        <p style="margin:16px 0 0; font-family:${FONT_BODY}; font-size:14.5px; line-height:1.65; color:#46505f;">
          Olá, <strong style="color:#0a1628;">${escapeHtml(p.responsavelNome)}</strong>! A secretaria da escola solicitou o envio de um link para você criar uma nova senha de acesso à Xkola Store.
        </p>
      </td>
    </tr>
    <tr><td class="pad" align="center" style="padding:28px 44px 4px;">${botaoCta(p.resetUrl, 'Criar nova senha')}</td></tr>
    <tr>
      <td class="pad" style="padding:24px 44px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc; border:1px solid #eef1f5; border-radius:14px;">
          <tr><td style="padding:14px 18px; font-family:${FONT_BODY}; font-size:13px; line-height:1.55; color:#5b6472;">
            Se você não solicitou isso, pode ignorar este e-mail com segurança — nenhuma ação será tomada.
          </td></tr>
        </table>
      </td>
    </tr>
    <tr>
      <td class="pad" style="padding:20px 44px 0;">
        <div style="font-family:${FONT_BODY}; font-size:12px; color:#9aa3b1; line-height:1.5;">Se o botão não funcionar, copie e cole este endereço no navegador:</div>
        <div style="font-family:${FONT_BODY}; font-size:12px; line-height:1.5; word-break:break-all; padding-top:6px;">
          <a href="${escapeHtml(p.resetUrl)}" target="_blank" style="color:#c2410c;">${escapeHtml(p.resetUrl)}</a>
        </div>
      </td>
    </tr>`

  return {
    subject: 'Redefina sua senha da Xkola Store',
    html: baseXkola({
      titulo: 'Redefinição de senha',
      preheader: 'Crie uma nova senha de acesso à loja da sua escola.',
      content,
      rodape: 'Você recebeu este e-mail porque a secretaria da escola solicitou a redefinição da sua senha.',
    }),
  }
}

// ── Template: Aviso de troca de e-mail de acesso ─────────────────────────────
export interface EmailAvisoTrocaEmailParams {
  responsavelNome: string
  emailAntigo: string
  emailNovo: string
}

export function emailAvisoTrocaEmail(
  p: EmailAvisoTrocaEmailParams,
): { subject: string; html: string } {
  const content = `
    <tr>
      <td class="pad" style="padding:36px 44px 0;">
        ${badge('Segurança')}
        <h1 style="margin:18px 0 0; font-family:${FONT_DISPLAY}; font-size:26px; line-height:1.2; font-weight:800; color:#0a1628; letter-spacing:-.02em;">Seu e-mail de acesso foi alterado</h1>
        <p style="margin:16px 0 0; font-family:${FONT_BODY}; font-size:14.5px; line-height:1.65; color:#46505f;">
          Olá, <strong style="color:#0a1628;">${escapeHtml(p.responsavelNome)}</strong>! O e-mail de acesso da sua conta na Xkola Store foi atualizado pela administração da escola.
        </p>
      </td>
    </tr>
    <tr>
      <td class="pad" style="padding:24px 44px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc; border:1px solid #eef1f5; border-radius:14px;">
          <tr>
            <td style="padding:16px 20px 0; font-family:${FONT_BODY}; font-size:13px; color:#8a93a1;">E-mail anterior</td>
            <td align="right" style="padding:16px 20px 0; font-family:${FONT_BODY}; font-size:13.5px; font-weight:700; color:#0a1628;">${escapeHtml(p.emailAntigo)}</td>
          </tr>
          <tr>
            <td style="padding:8px 20px 16px; font-family:${FONT_BODY}; font-size:13px; color:#8a93a1;">Novo e-mail de acesso</td>
            <td align="right" style="padding:8px 20px 16px; font-family:${FONT_BODY}; font-size:13.5px; font-weight:700; color:#0a1628;">${escapeHtml(p.emailNovo)}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td class="pad" style="padding:20px 44px 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fef9ec; border:1px solid #fbe3b3; border-radius:14px;">
          <tr><td style="padding:14px 18px; font-family:${FONT_BODY}; font-size:13px; line-height:1.6; color:#5b6472;">
            <span style="color:#b45309; font-weight:700;">Não reconhece esta alteração?</span> Entre em contato imediatamente com a secretaria da escola.
          </td></tr>
        </table>
      </td>
    </tr>`

  return {
    subject: 'Seu e-mail de acesso à Xkola Store foi alterado',
    html: baseXkola({
      titulo: 'E-mail de acesso alterado',
      preheader: 'O e-mail de acesso da sua conta foi atualizado.',
      content,
      rodape: 'Aviso de segurança da sua conta na Xkola Store.',
    }),
  }
}

// ── Template: Ingresso emitido ────────────────────────────────────────────────
export interface EmailIngressoParams {
  responsavelNome: string
  alunoNome: string
  produtoNome: string
  dataEvento?: string | null
  horaEvento?: string | null
  localEvento?: string | null
  ingressoUrl: string
  numeroPedido: string
}

export function emailIngressoEmitido(p: EmailIngressoParams): { subject: string; html: string } {
  const detalhes = [
    p.dataEvento ? `&#128197; ${new Date(p.dataEvento).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}` : null,
    p.horaEvento ? `&#128336; ${escapeHtml(p.horaEvento.slice(0, 5))}h` : null,
    p.localEvento ? `&#128205; ${escapeHtml(p.localEvento)}` : null,
  ].filter(Boolean)

  const blocoDetalhes = detalhes.length > 0
    ? `<tr>
        <td class="pad" style="padding:20px 44px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc; border:1px solid #eef1f5; border-radius:14px;">
            <tr><td style="padding:14px 18px; font-family:${FONT_BODY}; font-size:13px; line-height:1.9; color:#46505f;">
              ${detalhes.join('<br>')}
            </td></tr>
          </table>
        </td>
      </tr>`
    : ''

  const content = `
    <tr>
      <td class="pad" style="padding:36px 44px 0;">
        ${badge('Ingresso emitido')}
        <h1 style="margin:18px 0 0; font-family:${FONT_DISPLAY}; font-size:26px; line-height:1.2; font-weight:800; color:#0a1628; letter-spacing:-.02em;">Ingresso emitido!</h1>
        <p style="margin:16px 0 0; font-family:${FONT_BODY}; font-size:14.5px; line-height:1.65; color:#46505f;">
          O pagamento do pedido <strong style="color:#0a1628;">${escapeHtml(p.numeroPedido)}</strong> foi confirmado e o ingresso de <strong style="color:#0a1628;">${escapeHtml(p.alunoNome)}</strong> está disponível.
        </p>
      </td>
    </tr>
    <tr>
      <td class="pad" style="padding:24px 44px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fef3e2; border:1px solid #fbe3b3; border-radius:14px;">
          <tr><td align="center" style="padding:24px 20px;">
            <div style="font-family:${FONT_DISPLAY}; font-size:19px; font-weight:800; color:#7c2d12;">${escapeHtml(p.produtoNome)}</div>
            <div style="font-family:${FONT_BODY}; font-size:13px; font-weight:600; color:#b45309; padding-top:6px;">${escapeHtml(p.alunoNome)}</div>
          </td></tr>
        </table>
      </td>
    </tr>
    ${blocoDetalhes}
    <tr>
      <td class="pad" style="padding:20px 44px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc; border:1px solid #eef1f5; border-radius:14px;">
          <tr><td style="padding:14px 18px; font-family:${FONT_BODY}; font-size:13px; line-height:1.6; color:#5b6472;">
            <span style="color:#0a1628; font-weight:700;">Na entrada do evento:</span> apresente o QR Code do ingresso ao funcionário para validação.
          </td></tr>
        </table>
      </td>
    </tr>
    <tr><td class="pad" align="center" style="padding:26px 44px 8px;">${botaoCta(p.ingressoUrl, 'Ver ingresso digital')}</td></tr>`

  return {
    subject: `🎟️ Seu ingresso para ${p.produtoNome} está pronto!`,
    html: baseXkola({
      titulo: `Ingresso — ${p.produtoNome}`,
      preheader: `O ingresso de ${p.alunoNome} para ${p.produtoNome} está disponível.`,
      content,
      rodape: `Este e-mail se refere ao pedido ${escapeHtml(p.numeroPedido)}. O ingresso digital fica sempre disponível no link acima.`,
    }),
  }
}

// ── Template: Inscrição no Concurso de Bolsas confirmada ─────────────────────
export interface EmailInscricaoConcursoParams {
  responsavelNome: string
  alunoNome: string
  numero: string
  modalidade: string
}

export function emailInscricaoConcurso(p: EmailInscricaoConcursoParams): { subject: string; html: string } {
  const content = `
    <h2 style="margin:0 0 4px;font-size:22px;font-weight:900;color:#34436B;letter-spacing:-.02em;">
      ✅ Inscrição confirmada!
    </h2>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.6;">
      Olá, <strong>${escapeHtml(p.responsavelNome)}</strong>! Recebemos o pagamento da inscrição de
      <strong>${escapeHtml(p.alunoNome)}</strong> no Concurso de Bolsas – Seletivas Esportivas 2027
      (modalidade <strong>${escapeHtml(p.modalidade)}</strong>).
    </p>
    <div style="background:#EDF3FF;border:1px solid #C0CEEA;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
      <div style="font-size:12px;color:#34436B;font-weight:600;">INSCRIÇÃO</div>
      <div style="font-size:16px;font-weight:800;color:#34436B;font-family:monospace;">${escapeHtml(p.numero)}</div>
    </div>
    <div style="background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:14px 16px;margin-bottom:16px;font-size:13px;color:#7c2d12;line-height:1.7;">
      <strong>Próximos passos:</strong><br>
      • Prova pedagógica: <strong>30/08/2026 (domingo), 08h30–11h30</strong>, na sede do Educandário São Judas Tadeu.<br>
      • Seletiva técnica: 09 a 19/09/2026 (calendário divulgado dia 31/08 nas redes oficiais).<br>
      • No dia da seletiva, levar <strong>declaração de saúde</strong> (apto à prática esportiva) e o <strong>boletim escolar</strong> do ano vigente.
    </div>
    <p style="font-size:12px;color:#94a3b8;">Guarde este e-mail — o número da inscrição será solicitado no dia da prova.</p>
  `
  return {
    subject: `Inscrição ${p.numero} confirmada — Concurso de Bolsas 2027`,
    html: base(`Inscrição confirmada — ${p.numero}`, content),
  }
}
