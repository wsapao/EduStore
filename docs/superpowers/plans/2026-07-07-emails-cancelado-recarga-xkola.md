# E-mails fase 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Disparar os e-mails de pedido cancelado e recarga de cantina aprovada (templates editáveis que hoje nunca são enviados) e migrar os 4 e-mails antigos para o layout Xkola.

**Architecture:** Builders novos em `templates.ts` reutilizando `baseXkola`/`badge`/`botaoCta` da fase 1; envio em `send.ts`; disparos em `cancelarPedidoAction` (admin) e no branch de recarga do webhook Asaas via `resolverTemplatePedido`. Migração visual preserva assinaturas dos builders antigos.

**Tech Stack:** Next.js, Supabase, Resend, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-07-emails-cancelado-recarga-xkola-design.md`

Convenção de testes: valores monetários usam NBSP (`R$ …`), padrão da Intl pt-BR (aprendido na fase 1).

---

### Task 1: Builders novos + testes (cancelado e recarga)

**Files:** Modify `lib/email/templates.ts` · Test `tests/email/pedido-cancelado-recarga.test.ts`

- [ ] Teste falhando: builders inexistentes. Casos: (a) cancelado mostra número, motivo, abertura, escola; (b) bloco de devolução só quando `foiPago`; (c) recarga mostra valor, saldo atual, aluno, data em Brasília, forma; (d) assuntos = params.
- [ ] Implementar `EmailPedidoCanceladoParams`/`emailPedidoCancelado` e `EmailRecargaAprovadaParams`/`emailRecargaAprovada` com `baseXkola` (badge vermelho-suave p/ cancelado: `color:#b91c1c; background:#fef2f2; border:#fecaca`; check verde p/ recarga como no `emailPedidoPago`).
- [ ] `npx vitest run tests/email` PASS · commit `feat(email): builders de pedido cancelado e recarga aprovada`

### Task 2: Envio + defaults encurtados

**Files:** Modify `lib/email/send.ts`, `lib/email/templates-config.ts`

- [ ] `enviarEmailPedidoCancelado` / `enviarEmailRecargaAprovada` (padrão: skip sem Resend, try/catch).
- [ ] Defaults: `pedido_cancelado` → "Olá, {{nome_responsavel}}. Infelizmente seu pedido {{numero_pedido}} foi cancelado — os detalhes estão logo abaixo."; `recarga_cantina_aprovada` → "Olá, {{nome_responsavel}}! A recarga na carteira da cantina de {{nome_aluno}} foi aprovada. Os detalhes estão logo abaixo."
- [ ] Suíte de e-mail PASS · commit `feat(email): envio de pedido cancelado e recarga aprovada`

### Task 3: Disparo no cancelamento (admin)

**Files:** Modify `app/actions/admin.ts` (`cancelarPedidoAction`)

- [ ] Antes do update: buscar `pedidos.select('numero, total, escola_id, responsavel:responsaveis(nome, email)')` e `pagamentos.select('status')` (maybeSingle). Após cancelar com sucesso, `void` IIFE async: `resolverTemplatePedido({escolaId, tipo:'pedido_cancelado', vars:{nome_responsavel, numero_pedido, link_pedido, nome_escola, motivo: MOTIVO_PADRAO}, client: adminClient})` + `enviarEmailPedidoCancelado` com `foiPago = pagamento?.status === 'confirmado'`, `total`, `pedidoUrl` absoluto, `escolaNome` (fetch `escolas.nome`). Tudo em try/catch com log.
- [ ] `npx tsc --noEmit` sem erros novos · commit `feat(admin): e-mail ao cancelar pedido, com aviso de devolução se pago`

### Task 4: Disparo da recarga no webhook

**Files:** Modify `app/api/webhook/asaas/route.ts`

- [ ] Após `confirmar_recarga` ok: `void enviarEmailRecargaAprovadaWebhook(supabase, recargaId)`. Função: busca `cantina_recargas.select('id, valor, metodo, carteira:cantina_carteiras!carteira_id(saldo, aluno_id, escola_id, aluno:alunos(nome)), responsavel:responsaveis(nome, email)')`; sem e-mail → return; resolve template `recarga_cantina_aprovada` (vars: nome_responsavel, nome_aluno, valor/saldo_atual via `fmtBRL`, nome_escola via fetch `escolas.nome`); envia com `carteiraUrl = SITE_URL + '/cantina/' + alunoId`, `dataConfirmacao = new Date().toISOString()`. try/catch com log.
- [ ] `tsc` + suíte PASS · commit `feat(webhook): e-mail de recarga de cantina aprovada`

### Task 5: Migração visual dos 4 e-mails antigos

**Files:** Modify `lib/email/templates.ts` · Test `tests/email/emails-migrados.test.ts`

- [ ] Teste primeiro (conteúdo-chave que deve sobreviver): PIX expirado → numeroPedido, total, "Gerar novo PIX", pedidoUrl; ingresso → produtoNome, alunoNome, data/local quando presentes, instrução de QR, ingressoUrl; reset → resetUrl no botão e como texto de fallback; troca de e-mail → emailAntigo, emailNovo, alerta "não reconhece". Todos devem conter "Xkola Store" e não conter "Colégio Inovação".
- [ ] Reescrever os 4 builders com `baseXkola` (badges: "PIX expirado" âmbar, "Ingresso" âmbar, "Segurança" p/ reset e troca), preservando params e call sites. `base()` legado permanece (usado pelo e-mail do concurso).
- [ ] Suíte inteira PASS (inclui `tests/responsaveis/email-aviso-troca.test.ts` existente) · commit `refactor(email): migra PIX expirado, ingresso, reset e troca de e-mail p/ layout Xkola`

### Task 6: Verificação final e entrega

- [ ] `npx vitest run` (448 baseline + novos) · `npx tsc --noEmit` (só o erro pré-existente de login.test.ts) · `npx eslint lib/email app/actions/admin.ts app/api/webhook/asaas/route.ts` · `npx next build`
- [ ] Render de amostras (cancelado, recarga, migrados) p/ artifact · push + PR

## Self-review

Cobertura: item 1 (T1–T3), item 2 (T1, T2, T4), item 5 (T5); erros nunca quebram fluxo (T3/T4 try/catch); sem tipos novos no CHECK; concurso intocado. Tipos consistentes entre T1/T2/T3/T4. Sem placeholders.
