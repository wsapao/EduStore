# E-mails de confirmação de compra — design

**Data:** 2026-07-06 · **Status:** aprovado pelo Webert (mock em artifact)

## Objetivo

Substituir o e-mail de confirmação de pedido atual (marca hard-coded "Loja Escolar / Colégio Inovação", sem quantidade/foto/aluno correto) por dois e-mails no padrão "grande loja", com a identidade visual **Xkola Store** já usada nos templates de convite de equipe e redefinição de senha (navy `#0a1628` + gradiente âmbar `#f59e0b→#ea580c`, fundo creme `#faf4ea`, Bricolage Grotesque + Plus Jakarta Sans, card 560px).

1. **Pedido recebido** — enviado no checkout, com variante por forma de pagamento.
2. **Pagamento confirmado** — enviado quando o pagamento aprova (webhook Asaas ou cartão aprovado na hora).

## Decisões de escopo (entrevista 2026-07-06)

- Escopo: os dois e-mails acima. Demais e-mails (cancelado, PIX expirado, ingresso, reset) ficam para depois.
- Identidade: a mesma dos templates de convite/reset (Xkola Store), não a marca da escola. O nome da escola aparece no rodapé ("Compra realizada na loja do …").
- Itens mostram: foto do produto, quantidade, tamanho (variante), nome do aluno, preço unitário e subtotal da linha.
- Resumo financeiro: subtotal, desconto (se houver) e total; parcelas no cartão.
- Templates editáveis do admin: o **corpo** editável vira o **texto de abertura** dentro do layout rico; o **assunto** editável segue sendo o assunto do e-mail. Blocos estruturados (itens, resumo, pagamento) são fixos no código.

## Arquitetura

### 1. Layout base Xkola (`lib/email/templates.ts`)

Nova função `baseXkola(opts: { titulo, preheader, content })` que replica a moldura do `convite-equipe.html`: header navy com logomarca "XK / Xkola Store", faixa âmbar de 4px, card branco 560px raio 22px sobre fundo creme, rodapé com escola + aviso. O `base()` antigo permanece para os e-mails fora do escopo (migração futura).

Restrições de e-mail: tabelas com estilo inline, `@import` das fontes com fallback de sistema, sem flexbox em elementos críticos, imagens com dimensão fixa.

### 2. Builder "Pedido recebido" (`emailConfirmacaoPedido`, assinatura nova)

```ts
interface EmailItemPedido {
  nome: string
  imagemUrl: string | null
  alunoNome: string        // "João Pedro Santos · 6º ano B" (serie/turma quando houver)
  variante: string | null  // "Tamanho M"
  quantidade: number
  precoUnitario: number
}

interface EmailPedidoParams {
  assunto: string           // já renderizado do template editável
  aberturaHtml: string      // corpo do admin: escapado + \n→<br>, vars substituídas
  responsavelNome: string
  numeroPedido: string
  dataPedido: string        // ISO
  metodoPagamento: MetodoPagamento
  parcelas: number
  subtotal: number
  desconto: number
  total: number
  itens: EmailItemPedido[]
  pedidoUrl: string         // caminho relativo, prefixado com SITE_URL no send
  escolaNome: string | null
  pix?: { copiaCola: string | null; expiracao: string | null }
  boleto?: { linhaDigitavel: string | null; vencimento: string | null; url: string | null }
}
```

Blocos, em ordem: header → badge "Pedido recebido" + saudação → meta (nº, data, método) → abertura do admin → itens → resumo (subtotal / desconto / total) → **bloco de pagamento por método**:

- **PIX:** aviso âmbar com expiração + copia-e-cola em caixa tracejada monoespaçada.
- **Boleto:** linha digitável + vencimento + link "Baixar boleto (PDF)".
- **Cartão:** "Pagamento em processamento — Cartão de crédito · Nx de R$ …" (sem código).

→ CTA "Acompanhar meu pedido →" → rodapé com nome da escola.

Itens sem `imagemUrl` mostram célula âmbar-claro com a inicial do produto no lugar da foto.

### 3. Builder "Pagamento confirmado" (`emailPedidoPago`, novo)

Mesmos params menos os blocos de cobrança, mais `dataPagamento` e `temIngresso`. Blocos: check verde em círculo → "Pagamento confirmado!" → recibo (valor pago, forma — com parcelas no cartão —, pago em) → itens compactos (Nx nome · variante · aluno · preço de linha) → aviso de ingresso (só quando `temIngresso`) → CTA "Ver meu pedido" → rodapé.

### 4. Agrupamento de itens

`itens_pedido` tem uma linha por unidade. Função pura `agruparItensEmail(rows)` agrupa por `produto_id + variante + aluno_id` somando `quantidade`; exportada para teste.

### 5. Texto do admin dentro do layout

- O **tipo** do template segue o método: `confirmacao_pedido_pix|cartao|boleto`; o "pago" usa `pedido_pago`.
- `getTemplateEmail(escolaId, tipo)` resolve custom vs default; `renderEmailTemplate` substitui as `{{vars}}` em assunto e corpo.
- O corpo (texto plano) é **escapado para HTML** e quebras de linha viram `<br>` antes de entrar no layout (`aberturaHtml`).
- Os `defaultCorpo` desses 4 tipos em `templates-config.ts` são **encurtados** para 1–2 frases de boas-vindas, porque a parte estruturada (total, código PIX, link) agora é bloco fixo do layout — evita duplicação. Variáveis continuam disponíveis para o admin que quiser usá-las.
- Falha ao resolver template não pode bloquear o envio: fallback para o default do manifest (já é o comportamento do `getTemplateEmail`).

### 6. Plumbing no checkout (`app/actions/orders.ts`)

- `select` de produtos ganha `imagem_url, gera_ingresso`.
- Buscar `alunos (id, nome, serie, turma)` dos `alunoIds` já validados (client autenticado; RLS já permite — a UI da loja exibe esses nomes).
- Montar params novos: subtotal = `totalCalculado`, desconto = `descontoAplicado`, parcelas, boleto (`resultado.linha_digitavel`, `vencimento`, `url`).
- **Cartão aprovado na hora:** envia só o e-mail de *pagamento confirmado* (o webhook será ignorado pela idempotência e não haveria segundo e-mail). Demais casos: envia *pedido recebido*; o *pago* vem pelo webhook.
- Envio continua `void` (não bloqueia o checkout) e resolve o template editável antes de chamar o send.

### 7. Disparo no webhook (`app/api/webhook/asaas/route.ts`)

Após `confirmarPagamento` bem-sucedido (fluxo de pedido, não recarga), disparar em background `enviarEmailPedidoPago` buscando via admin client: pedido (numero, total, desconto_aplicado, data_pagamento, escola_id) + responsável (nome, email) + pagamento (metodo, parcelas) + itens com produto (nome, imagem_url, gera_ingresso) e aluno (nome, serie, turma). Erro de e-mail é logado e **não** derruba a resposta 200 do webhook (mesmo padrão dos ingressos).

Idempotência: o guard existente (status já `confirmado` → ignora) evita e-mail duplicado em reenvios do Asaas.

## Tratamento de erros

- Envio de e-mail nunca quebra checkout nem webhook (try/catch + log, padrão atual).
- `getResend()` ausente → skip silencioso (padrão atual).
- Dados faltantes degradam: sem foto → inicial; sem aluno → linha omitida; sem escola → rodapé genérico.

## Testes

- `agruparItensEmail`: agrupa iguais, separa por variante/aluno, soma quantidades.
- Builders: snapshot-light por asserções de conteúdo (nº pedido, valores formatados, bloco correto por método, parcelas, desconto omitido quando 0, aviso de ingresso condicional, escape do texto do admin — `<script>` não pode sobreviver).
- Integração do texto do admin: corpo custom aparece renderizado com vars.
- Webhook: pagamento confirmado dispara e-mail de pago com dados corretos (mock supabase/resend, seguindo padrão dos testes existentes).

## Fora de escopo

- Migrar os demais e-mails para o layout Xkola.
- QR Code do PIX como imagem embutida (o e-mail aponta para a página do pedido, que já tem o QR).
- Editor admin de HTML rico.
