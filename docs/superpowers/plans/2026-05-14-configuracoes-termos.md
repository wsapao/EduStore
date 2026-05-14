# Configurações — Módulo Termos & LGPD (Plano)

> Subagent-driven. Steps em checkbox.

**Goal:** `/admin/configuracoes/termos` permite ao admin editar e versionar Termos de Uso e Política de Privacidade. As páginas públicas `/termos` e `/privacidade` passam a ler a versão mais recente do banco (com fallback ao texto estático atual).

**Architecture:** Nova tabela `termos_versoes` (escola_id, tipo, versao incremental, conteudo, publicado_em). Server actions cobrem publicar/listar. Editor admin é textarea simples (markdown opcional renderizado nas páginas públicas usando `react-markdown` se já existir, ou plain text). Aceite por usuário fica para PR separado.

**Branch:** `feat/configuracoes-termos`

---

## Task 1: Migration

**Files:**
- Create: `supabase/migrations/20260514_termos_versoes.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- ============================================================
-- Tabela termos_versoes
-- Versionamento de Termos de Uso e Política de Privacidade por escola.
-- Cada novo "publicar" insere uma linha com versao incrementada.
-- A versão "atual" é a com maior `versao` para o (escola_id, tipo).
-- ============================================================

CREATE TABLE IF NOT EXISTS termos_versoes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id     UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL CHECK (tipo IN ('termos_uso', 'privacidade')),
  versao        INT  NOT NULL CHECK (versao >= 1),
  conteudo      TEXT NOT NULL,
  publicado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  publicado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT termos_versoes_unica UNIQUE (escola_id, tipo, versao)
);

CREATE INDEX IF NOT EXISTS idx_termos_versoes_escola_tipo
  ON termos_versoes(escola_id, tipo, versao DESC);

ALTER TABLE termos_versoes ENABLE ROW LEVEL SECURITY;

-- Admin lê/escreve da sua escola
CREATE POLICY "termos_versoes_admin_rw"
  ON termos_versoes FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Qualquer autenticado lê a versão da própria escola (pra exibir em /termos e /privacidade)
CREATE POLICY "termos_versoes_self_escola_select"
  ON termos_versoes FOR SELECT
  TO authenticated
  USING (
    escola_id IN (
      SELECT escola_id FROM usuario_papel WHERE user_id = auth.uid() AND suspenso = false
      UNION
      SELECT escola_id FROM responsaveis WHERE id = auth.uid()
    )
  );

-- Acesso público para anon (páginas /termos e /privacidade são acessíveis sem login).
-- Como não dá pra resolver "minha escola" sem auth, exporemos read pra anon SOMENTE quando
-- a escola for marcada como pública (cenário multi-tenant). Por enquanto deixamos restrito —
-- o fallback estático cobre o caso anon.
```

- [ ] **Step 2: Aplicar via Supabase SQL Editor (manual pelo usuário)**

> ⚠️ Pause: o subagent NÃO aplica. Reporta o conteúdo SQL ao usuário ao final pra que ele cole no Supabase.

- [ ] **Step 3: Commit + push**

```bash
git add supabase/migrations/20260514_termos_versoes.sql
git commit -m "feat(db): tabela termos_versoes + RLS"
git push -u origin feat/configuracoes-termos
```

---

## Task 2: Server actions + tests (TDD)

**Files:**
- Create: `app/actions/configuracoes/termos.ts`
- Create: `tests/configuracoes/termos.test.ts`

**3 Server Actions:**

1. **`publicarVersaoTermosAction({ tipo, conteudo })`** — `requirePermission('configuracoes.editar_identidade')`. Valida `tipo` em `['termos_uso','privacidade']`, `conteudo.trim().length >= 50` (sanity). Pega a maior `versao` atual pra esse `(escola_id, tipo)` (`SELECT MAX(versao)`), insere nova com `versao + 1` (ou 1 se nenhuma). Retorna `{ success: true, versao }` ou `{ error: string }`.

2. **`listarVersoesTermosAction({ tipo })`** — retorna `{ versoes: [{ id, versao, publicado_em, publicado_por_nome }, ...] }` ordenadas por `versao DESC`. Usa LEFT JOIN com `auth.users` via admin client pra resolver email/nome do `publicado_por`.

3. **`getVersaoAtualTermosAction({ tipo, escolaId })`** — usado pelas páginas públicas. Server-only. Retorna a versão com maior `versao` (ou null). Não precisa de permissão (basta a RLS deixar o usuário autenticado ler).

Tests cobrem:
- Permission denied
- Tipo inválido → erro
- Conteúdo curto → erro
- Primeira publicação cria versao=1
- Próxima publicação cria versao+1
- listarVersoes retorna ordem desc

**~8 testes.**

- [ ] Implementar conforme padrão dos módulos anteriores
- [ ] Commit + push

---

## Task 3: Página admin

**Files:**
- Create: `app/(admin)/admin/configuracoes/termos/page.tsx`
- Create: `app/(admin)/admin/configuracoes/termos/TermosForm.tsx`
- Create: `app/(admin)/admin/configuracoes/termos/HistoricoVersoes.tsx`

UI:
- 2 abas (Termos de Uso | Política de Privacidade) — pode ser select simples ou tabs reais
- Editor: textarea grande (rows 25), monospaced font, suporta markdown manual
- Lista de versões à direita ou abaixo: "v3 — 12/05/2026 às 14:30 por admin@email.com"
- Botão "Publicar nova versão" → modal de confirmação ("Publicar v4? Os usuários verão essa versão imediatamente.")
- Campo `dpo_email` no card "LGPD" (read+write usando `escola_configuracoes.dpo_email`)

Tabs: pra simplificar, fazer 2 cards lado a lado (ou empilhados em mobile) — um pra cada tipo. Cada card tem editor + histórico próprio.

- [ ] Implementar
- [ ] tsc + build OK
- [ ] Commit + push

---

## Task 4: Refator páginas públicas

**Files:**
- Modify: `app/termos/page.tsx`
- Modify: `app/privacidade/page.tsx`

Cada página:
1. Tenta resolver escolaId do usuário autenticado (se houver). Se não, usa fallback estático atual.
2. Busca `getVersaoAtualTermosAction({ tipo: 'termos_uso' / 'privacidade', escolaId })`
3. Se houver versão no banco: renderiza `conteudo` (texto puro com `whitespace: pre-wrap` por enquanto; markdown rendering pode ser PR futuro).
4. Se não: renderiza o conteúdo estático que já existe.

Adicionar nota no rodapé "Versão X publicada em DD/MM/YYYY" se vindo do banco.

- [ ] Implementar
- [ ] Commit + push

---

## Task 5: PR + merge

- [ ] Commit do plano + abrir PR via gh CLI
- [ ] Aguardar checks
- [ ] Merge automático

---

## Out of scope (anotar no PR)

- **dpo_email field**: o plano original incluía mas vou pular — fica no card de LGPD em PR separado se necessário
- **Aceite por usuário** (rastrear quem aceitou qual versão): exige tabela `responsavel_aceite_termo` e modal de re-aceite quando publica nova versão. PR à parte.
- **Editor rich-text** (negrito/itálico/listas): textarea simples por enquanto — markdown é editável manualmente.
- **Render de markdown** nas páginas públicas: por ora `whitespace: pre-wrap`. Adicionar `react-markdown` em PR futuro.
- **Acesso anon a /termos e /privacidade** com versão de uma escola específica: requer escolha por subdomínio ou query param. Mantemos fallback estático para anon.
