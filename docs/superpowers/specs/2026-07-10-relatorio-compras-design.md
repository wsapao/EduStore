# Relatório de Compras por Produto — Design

**Data:** 2026-07-10 · **Status:** aprovado pelo usuário (conversa Claude)

## Problema

A página `/admin/relatorio` só cobre produtos com `gera_ingresso = true` (relatório de
presença via `ingressos`). Produtos de evento vendidos sem ingresso (ex.: Copa Tadeu 2026)
não aparecem em relatório nenhum, apesar de as vendas estarem em `pedidos`/`itens_pedido`.
O admin também não permite escolher colunas nem filtrar por série/turma antes de exportar.

## Solução

A página `/admin/relatorio` passa a ter duas abas:

- **Presença** — comportamento atual, intacto (RPC `get_relatorio_presenca`).
- **Compras** (nova) — relatório de compradores de **qualquer** produto.

### Aba Compras

- **Seletor de produto:** todos os produtos, mais recentes primeiro (`created_at desc`),
  com data do evento no rótulo quando houver.
- **Filtros client-side:** série, turma, status do pedido (padrão: só `pago`;
  opções para incluir `pendente`/`cancelado`). Itens estornados
  (`itens_pedido.estornado_em IS NOT NULL`) ficam fora por padrão, com toggle para incluir.
- **Seletor de colunas (checkboxes):** Aluno, Série, Turma, Responsável, E-mail, Telefone,
  Variante, Nº do Pedido, Data do pagamento, Valor. Vale para a tabela e para o CSV.
- **Resumo:** nº de compras e valor total, respeitando os filtros ativos.
- **Exportar CSV:** UTF-8 com BOM (padrão do export de presença), só com as colunas marcadas.

### Dados

Nova RPC `get_relatorio_compras(p_produto_id uuid)`:
`itens_pedido` ⋈ `pedidos` ⋈ `alunos` (left) ⋈ `responsaveis` (left), retornando
aluno (nome/série/turma), responsável (nome/e-mail/telefone), variante, nº e status do
pedido, `data_pagamento`, `preco_unitario` e flag `estornado`. Todos os status são
retornados; o filtro é client-side (volume: dezenas de linhas por produto).

### Segurança

- A nova RPC é `SECURITY DEFINER` com `REVOKE ... FROM PUBLIC, anon, authenticated` e
  `GRANT EXECUTE ... TO service_role`, seguindo `20260519_revoke_rpc_execute.sql`.
- O caller é a página server-side do grupo `(admin)` (já guardada por `currentPermissions`)
  usando `createAdminClient()` (service role).
- **Correção incluída:** `get_relatorio_presenca` hoje é executável por `authenticated`
  (expõe PII de alunos a qualquer usuário logado via `/rest/v1/rpc/...`). Entra no mesmo
  lockdown e seu caller migra para o admin client.

### Fora de escopo

- Ingressos retroativos para a Copa Tadeu (decisão pendente do usuário).
- Relatórios de produtos agregados/gerais (multi-produto).

## Testes

Lógica de filtro e montagem de CSV extraída para módulo puro (`lib/relatorio-compras.ts`)
com testes vitest (filtros por série/turma/status/estorno, seleção de colunas, escaping do
CSV). Suíte existente continua verde; prova por testes + build (sem dev server local).

## Entrega

Branch `feat/relatorio-compras` → PR no GitHub (wsapao/EduStore) → merge → Vercel.
Migration versionada em `supabase/migrations/` e aplicada em prod via MCP do Supabase.
