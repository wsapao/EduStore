# E-mails fase 2: cancelado, recarga aprovada e migração Xkola — design

**Data:** 2026-07-07 · **Status:** escopo aprovado pelo Webert (itens 1, 2 e 5 da proposta)

## Objetivo

1. **Pedido cancelado:** o template editável existe no admin mas nunca é enviado. Disparar no `cancelarPedidoAction`, com aviso de devolução quando o pedido já estava pago.
2. **Recarga de cantina aprovada:** idem — template sem disparo. Enviar quando o webhook confirma a recarga (`confirmar_recarga`).
3. **Migração visual:** PIX expirado, ingresso emitido, reset de senha e aviso de troca de e-mail saem do layout roxo antigo para o `baseXkola` (mesma identidade dos e-mails de compra).

## Decisões

- **Sem migration:** `email_templates.tipo` tem CHECK constraint; `pedido_cancelado` e `recarga_cantina_aprovada` já constam. Nenhum tipo novo.
- **Estorno de pedido (parcial/total) fica fora** — não há tipo de template para isso no CHECK; exigiria migration. Registrado como possível fase 3.
- **Motivo do cancelamento:** `cancelarPedidoAction(pedidoId)` não recebe motivo da UI. Usar motivo padrão "Cancelamento realizado pela administração da escola" na variável `{{motivo}}`; o motivo aparece em bloco fixo do layout (não duplicar no corpo default).
- **Devolução:** antes de cancelar, ler `pagamentos.status`; se `confirmado`, o e-mail inclui bloco "o valor pago será devolvido — a escola entrará em contato".
- **Recarga:** disparo único no webhook (PIX e cartão hosted confirmam por lá). Buscar `cantina_recargas` → `carteira` (saldo já atualizado pela RPC, aluno, escola) → responsável. CTA aponta para `/cantina/{alunoId}`.
- **Migração preserva assinaturas:** os 4 builders mantêm params e call sites; só o HTML muda. `base()` legado permanece enquanto `emailInscricaoConcurso` (do concurso, recém-mesclado) o usa — não tocar no e-mail do concurso.
- Templates editáveis: `pedido_cancelado` e `recarga_cantina_aprovada` seguem o padrão da fase 1 — assunto editável = subject; corpo editável = abertura (`resolverTemplatePedido`); defaults encurtados. Os 4 e-mails migrados **não** têm template editável (reset/troca/PIX expirado/ingresso — ingresso tem tipo `ingresso_emitido`, mas ligar o editável a ele fica fora do escopo para não mexer em dois fluxos de ingresso ao mesmo tempo).

## Componentes

### Builders novos (`lib/email/templates.ts`)

```ts
interface EmailPedidoCanceladoParams {
  assunto: string; aberturaHtml: string; responsavelNome: string
  numeroPedido: string; total: number; motivo: string; foiPago: boolean
  pedidoUrl: string; escolaNome?: string | null
}
interface EmailRecargaAprovadaParams {
  assunto: string; aberturaHtml: string; responsavelNome: string
  alunoNome: string; valor: number; saldoAtual: number; metodo: string
  dataConfirmacao: string; carteiraUrl: string; escolaNome?: string | null
}
```

- `emailPedidoCancelado`: badge vermelho-suave "Pedido cancelado", número/total, abertura do admin, card neutro com o motivo, bloco âmbar condicional de devolução (`foiPago`), CTA "Ver meu pedido".
- `emailRecargaAprovada`: check verde, recibo (valor recarregado, forma, **saldo atual** em destaque, data em Brasília), aluno, CTA "Ver carteira da cantina".

### Envio (`lib/email/send.ts`)

`enviarEmailPedidoCancelado` e `enviarEmailRecargaAprovada`, padrão dos existentes (skip sem Resend, try/catch, nunca lança).

### Disparos

- `app/actions/admin.ts` / `cancelarPedidoAction`: antes do update, buscar pedido (`numero, total, escola_id, responsavel:responsaveis(nome,email)`) e `pagamentos.status`; após sucesso, `void` envio com `resolverTemplatePedido('pedido_cancelado')` via `createAdminClient()`.
- `app/api/webhook/asaas/route.ts`: no branch `recarga:`, após RPC ok, `void enviarEmailRecargaAprovadaWebhook(adminClient, recargaId)` — busca `cantina_recargas` + `carteira:cantina_carteiras(saldo, aluno_id, escola_id, aluno:alunos(nome))` + `responsavel:responsaveis(nome, email)`; resolve template e envia. Erro só loga.

### Migração dos 4 builders

Reescrever `emailPixExpirado`, `emailIngressoEmitido`, `emailResetSenhaAdmin`, `emailAvisoTrocaEmail` com `baseXkola` + `badge`/`botaoCta`/`rodapePedido`-style, preservando todo o conteúdo informacional atual (número/total/CTA "Gerar novo PIX"; card do evento + instrução de QR; link de reset com fallback textual; e-mails antigo/novo + alerta de segurança).

## Erros e testes

- Envio nunca quebra ação/webhook (padrão fase 1).
- Testes: builders novos (motivo, bloco devolução condicional, saldo/valor formatados), builders migrados (conteúdo-chave preservado), suíte inteira verde (448 baseline).
