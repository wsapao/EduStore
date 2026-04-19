// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtBRL(v: number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ── Layout base ───────────────────────────────────────────────────────────────
function base(title: string, content: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 32px;text-align:center;">
            <div style="font-size:28px;margin-bottom:8px;">🏫</div>
            <div style="font-size:20px;font-weight:900;color:#fff;letter-spacing:-.02em;">Loja Escolar</div>
            <div style="font-size:12px;color:rgba(255,255,255,.7);margin-top:2px;">Colégio Inovação</div>
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
              Você recebeu este email porque realizou uma compra na Loja Escolar.<br>
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

// ── Template: Confirmação de pedido ──────────────────────────────────────────
interface ItemEmail {
  nome: string
  aluno: string
  preco: number
}

export interface EmailPedidoParams {
  responsavelNome: string
  numeroPedido: string
  total: number
  metodoPagamento: string
  itens: ItemEmail[]
  pedidoUrl: string
  // PIX
  pixQrCode?: string | null
  pixCopiaCola?: string | null
  pixExpiracao?: string | null
}

export function emailConfirmacaoPedido(p: EmailPedidoParams): { subject: string; html: string } {
  const metodoLabel: Record<string, string> = { pix: 'PIX', cartao: 'Cartão de Crédito', boleto: 'Boleto Bancário' }
  const metodo = metodoLabel[p.metodoPagamento] ?? p.metodoPagamento

  const itensList = p.itens.map(i => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
        <div style="font-size:13px;font-weight:600;color:#0f172a;">${i.nome}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;">Aluno: ${i.aluno}</div>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;text-align:right;font-size:13px;font-weight:700;color:#0f172a;white-space:nowrap;">
        ${fmtBRL(i.preco)}
      </td>
    </tr>`).join('')

  const pixSection = p.pixQrCode ? `
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:20px;margin-top:20px;text-align:center;">
      <div style="font-size:14px;font-weight:700;color:#15803d;margin-bottom:12px;">⚡ Pague com PIX</div>
      ${p.pixExpiracao ? `<div style="font-size:11px;color:#16a34a;margin-bottom:12px;">⏰ Expira em: ${new Date(p.pixExpiracao).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</div>` : ''}
      ${p.pixCopiaCola ? `
        <div style="background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:10px 14px;font-family:monospace;font-size:11px;color:#374151;word-break:break-all;text-align:left;margin-bottom:12px;">
          ${p.pixCopiaCola}
        </div>
        <div style="font-size:11px;color:#6b7280;">Copie o código acima e cole no seu banco para pagar.</div>
      ` : ''}
    </div>` : ''

  const content = `
    <h2 style="margin:0 0 4px;font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-.02em;">
      🛍️ Pedido recebido!
    </h2>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;">
      Olá, <strong>${p.responsavelNome}</strong>! Seu pedido foi registrado com sucesso.
    </p>

    <!-- Info do pedido -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:12px;color:#64748b;font-weight:600;">PEDIDO</span>
        <span style="font-size:12px;font-weight:700;color:#0f172a;font-family:monospace;">${p.numeroPedido}</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="font-size:12px;color:#64748b;font-weight:600;">PAGAMENTO</span>
        <span style="font-size:12px;font-weight:700;color:#0f172a;">${metodo}</span>
      </div>
    </div>

    <!-- Itens -->
    <table width="100%" cellpadding="0" cellspacing="0">
      ${itensList}
      <tr>
        <td style="padding:14px 0 0;font-size:14px;font-weight:700;color:#0f172a;">Total</td>
        <td style="padding:14px 0 0;text-align:right;font-size:18px;font-weight:900;color:#0f172a;">${fmtBRL(p.total)}</td>
      </tr>
    </table>

    ${pixSection}

    <!-- CTA -->
    <div style="margin-top:28px;text-align:center;">
      <a href="${p.pedidoUrl}"
        style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:700;letter-spacing:-.01em;">
        Ver meu pedido
      </a>
    </div>
  `

  return {
    subject: `Pedido ${p.numeroPedido} recebido — Loja Escolar`,
    html: base(`Pedido ${p.numeroPedido}`, content),
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
    <h2 style="margin:0 0 4px;font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-.02em;">
      ⏰ Seu PIX expirou
    </h2>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.6;">
      Olá, <strong>${p.responsavelNome}</strong>! O PIX do pedido <strong>${p.numeroPedido}</strong> venceu.
      Seu pedido continua disponível para você gerar um novo código.
    </p>

    <div style="background:#fff7ed;border:1px solid #fdba74;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:12px;color:#9a3412;font-weight:600;">PEDIDO</span>
        <span style="font-size:12px;font-weight:700;color:#7c2d12;font-family:monospace;">${p.numeroPedido}</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="font-size:12px;color:#9a3412;font-weight:600;">TOTAL</span>
        <span style="font-size:14px;font-weight:800;color:#7c2d12;">${fmtBRL(p.total)}</span>
      </div>
    </div>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 16px;margin-bottom:24px;font-size:13px;color:#1e40af;line-height:1.6;">
      Abra o pedido para gerar um novo PIX e concluir a compra sem precisar montar o carrinho novamente.
    </div>

    <div style="text-align:center;">
      <a href="${p.pedidoUrl}"
        style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:700;">
        Gerar novo PIX
      </a>
    </div>
  `

  return {
    subject: `PIX expirado no pedido ${p.numeroPedido}`,
    html: base(`PIX expirado — ${p.numeroPedido}`, content),
  }
}

export interface EmailResetSenhaAdminParams {
  responsavelNome: string
  resetUrl: string
}

export function emailResetSenhaAdmin(p: EmailResetSenhaAdminParams): { subject: string; html: string } {
  const content = `
    <h2 style="margin:0 0 4px;font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-.02em;">
      🔐 Redefinição de senha
    </h2>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.6;">
      Olá, <strong>${p.responsavelNome}</strong>! A secretaria da escola solicitou o envio de um link para você criar uma nova senha de acesso à Loja Escolar.
    </p>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
      <div style="font-size:13px;color:#1e3a8a;line-height:1.7;">
        Use o botão abaixo para definir uma nova senha com segurança. Se você não solicitou isso, pode simplesmente ignorar este email.
      </div>
    </div>

    <div style="text-align:center;margin-top:8px;">
      <a href="${p.resetUrl}"
        style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:700;">
        Criar nova senha
      </a>
    </div>

    <div style="margin-top:24px;font-size:12px;color:#94a3b8;line-height:1.7;">
      Se o botão não abrir, copie e cole este endereço no navegador:<br>
      <span style="color:#475569;word-break:break-all;">${p.resetUrl}</span>
    </div>
  `

  return {
    subject: 'Redefina sua senha da Loja Escolar',
    html: base('Redefinição de senha', content),
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
    p.dataEvento ? `📅 ${new Date(p.dataEvento).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}` : null,
    p.horaEvento ? `🕐 ${p.horaEvento.slice(0, 5)}h` : null,
    p.localEvento ? `📍 ${p.localEvento}` : null,
  ].filter(Boolean)

  const content = `
    <h2 style="margin:0 0 4px;font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-.02em;">
      🎟️ Ingresso emitido!
    </h2>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;">
      O pagamento do pedido <strong>${p.numeroPedido}</strong> foi confirmado.<br>
      O ingresso de <strong>${p.alunoNome}</strong> está disponível.
    </p>

    <!-- Card do evento -->
    <div style="background:linear-gradient(135deg,#ede9fe,#ddd6fe);border-radius:14px;padding:24px;margin-bottom:24px;text-align:center;">
      <div style="font-size:32px;margin-bottom:8px;">🎉</div>
      <div style="font-size:18px;font-weight:900;color:#4c1d95;margin-bottom:4px;">${p.produtoNome}</div>
      <div style="font-size:13px;color:#6d28d9;font-weight:600;">${p.alunoNome}</div>
    </div>

    ${detalhes.length > 0 ? `
    <!-- Detalhes -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
      ${detalhes.map(d => `<div style="font-size:13px;color:#374151;margin-bottom:6px;">${d}</div>`).join('')}
    </div>
    ` : ''}

    <!-- Instrução -->
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 16px;margin-bottom:24px;font-size:13px;color:#1e40af;line-height:1.6;">
      📱 <strong>Na entrada do evento:</strong> apresente o QR Code do ingresso ao funcionário para validação.
    </div>

    <!-- CTA -->
    <div style="text-align:center;">
      <a href="${p.ingressoUrl}"
        style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:700;">
        Ver ingresso digital →
      </a>
    </div>
  `

  return {
    subject: `🎟️ Seu ingresso para ${p.produtoNome} está pronto!`,
    html: base(`Ingresso — ${p.produtoNome}`, content),
  }
}
