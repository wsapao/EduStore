# Configurações — Fundação (Plano de Implementação)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a base que sustenta todos os módulos de Configurações: schema do banco, sistema de papéis customizáveis, helpers de permissão, e a casca (layout + sidebar + página index) da rota `/admin/configuracoes`.

**Architecture:** Migrations Supabase criam 4 tabelas novas (`escola_configuracoes`, `papeis`, `papel_permissoes`, `usuario_papel`) e estendem `escolas`. Um trigger mantém `auth.users.raw_app_meta_data.role` espelhado a partir de `usuario_papel` para preservar todas as RLS existentes. Helpers TypeScript (`requirePermission`, `hasPermission`) são chamados em Server Actions e layouts. A rota `/admin/configuracoes` é introduzida com layout próprio, sidebar agrupada por área, e página index.

**Tech Stack:** Next.js 15 App Router · Supabase (Postgres + Auth + RLS) · TypeScript · Vitest (novo) · Zod

**Spec:** [2026-05-11-configuracoes-loja-design.md](../specs/2026-05-11-configuracoes-loja-design.md)

**Convenção do projeto (memória):** Após cada commit local, fazer `git push` para que o Vercel publique. Cada tarefa termina com commit + push.

**Convenção SQL:** Migrations vão em `supabase/migrations/YYYYMMDD_<nome>.sql`. Aplicar via Supabase SQL Editor (não há CLI configurada no projeto).

---

## Task 1: Setup Vitest

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `tests/sanity.test.ts`
- Modify: `package.json` (adicionar deps e scripts)
- Modify: `.gitignore` (já cobre `node_modules`; nada a fazer se já tiver)

- [ ] **Step 1: Instalar Vitest**

```bash
cd "Loja virtual/app"
npm install --save-dev vitest@^2 @vitest/coverage-v8@^2
```

Expected: `package.json` ganha as duas devDependencies.

- [ ] **Step 2: Criar `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
```

- [ ] **Step 3: Criar `tests/setup.ts` vazio**

```typescript
// Reservado para mocks globais futuros (Supabase, etc).
export {}
```

- [ ] **Step 4: Escrever teste de sanidade**

`tests/sanity.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

describe('vitest sanity', () => {
  it('roda', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Adicionar scripts no `package.json`**

Em `"scripts"`, acrescentar:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Rodar o teste**

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 7: Commit + push**

```bash
git add vitest.config.ts tests/ package.json package-lock.json
git commit -m "chore(test): setup vitest com teste de sanidade"
git push
```

---

## Task 2: Migration — estender tabela `escolas`

**Files:**
- Create: `supabase/migrations/20260511_extend_escolas_identidade.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- ============================================================
-- Estende a tabela escolas com campos de identidade fiscal e
-- personalização da loja online.
-- Faz parte da Fundação do Menu de Configurações.
-- ============================================================

ALTER TABLE escolas
  ADD COLUMN IF NOT EXISTS razao_social         TEXT,
  ADD COLUMN IF NOT EXISTS banner_url           TEXT,
  ADD COLUMN IF NOT EXISTS slogan               TEXT,
  ADD COLUMN IF NOT EXISTS texto_boas_vindas    TEXT,
  ADD COLUMN IF NOT EXISTS favicon_url          TEXT,
  ADD COLUMN IF NOT EXISTS endereco_logradouro  TEXT,
  ADD COLUMN IF NOT EXISTS endereco_numero      TEXT,
  ADD COLUMN IF NOT EXISTS endereco_bairro      TEXT,
  ADD COLUMN IF NOT EXISTS endereco_cidade      TEXT,
  ADD COLUMN IF NOT EXISTS endereco_uf          CHAR(2),
  ADD COLUMN IF NOT EXISTS endereco_cep         TEXT;

-- Constraint de tamanho conforme spec
ALTER TABLE escolas
  ADD CONSTRAINT escolas_slogan_len            CHECK (slogan IS NULL OR char_length(slogan) <= 120),
  ADD CONSTRAINT escolas_texto_boas_vindas_len CHECK (texto_boas_vindas IS NULL OR char_length(texto_boas_vindas) <= 500);
```

- [ ] **Step 2: Aplicar no Supabase**

Abrir Supabase Dashboard → SQL Editor → colar conteúdo → Run.
Expected: "Success. No rows returned".

- [ ] **Step 3: Verificar no banco**

No SQL Editor:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'escolas' AND column_name IN ('razao_social','banner_url','slogan','endereco_uf');
```

Expected: 4 rows.

- [ ] **Step 4: Commit + push**

```bash
git add supabase/migrations/20260511_extend_escolas_identidade.sql
git commit -m "feat(db): estende escolas com campos de identidade e endereço fiscal"
git push
```

---

## Task 3: Migration — `escola_configuracoes`

**Files:**
- Create: `supabase/migrations/20260511_create_escola_configuracoes.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- ============================================================
-- Tabela escola_configuracoes
-- 1:1 com escolas, guarda todas as configurações operacionais
-- não-sensíveis (pagamentos, cantina, checkout, loja online).
-- ============================================================

CREATE TABLE IF NOT EXISTS escola_configuracoes (
  escola_id                       UUID PRIMARY KEY REFERENCES escolas(id) ON DELETE CASCADE,

  -- Pagamentos
  metodos_aceitos_padrao          TEXT[]  NOT NULL DEFAULT ARRAY['pix','cartao','boleto'],
  max_parcelas_padrao             INT     NOT NULL DEFAULT 12 CHECK (max_parcelas_padrao BETWEEN 1 AND 12),
  pix_expiracao_segundos          INT     NOT NULL DEFAULT 1800 CHECK (pix_expiracao_segundos > 0),
  taxa_cartao_repassada           BOOLEAN NOT NULL DEFAULT false,
  taxa_cartao_percentual          NUMERIC(5,2) CHECK (taxa_cartao_percentual IS NULL OR (taxa_cartao_percentual >= 0 AND taxa_cartao_percentual <= 100)),
  asaas_webhook_secret            TEXT,
  pix_chave_recebedora            TEXT,

  -- Cantina (Fase 2)
  cantina_recarga_min             NUMERIC(10,2) NOT NULL DEFAULT 10 CHECK (cantina_recarga_min >= 0),
  cantina_recarga_max             NUMERIC(10,2) NOT NULL DEFAULT 500 CHECK (cantina_recarga_max >= cantina_recarga_min),
  cantina_metodos_recarga         TEXT[]  NOT NULL DEFAULT ARRAY['pix','cartao'],
  cantina_exige_pin               BOOLEAN NOT NULL DEFAULT true,
  cantina_pin_tamanho             INT     NOT NULL DEFAULT 4 CHECK (cantina_pin_tamanho BETWEEN 4 AND 6),
  cantina_saldo_negativo          BOOLEAN NOT NULL DEFAULT false,

  -- Checkout (Fase 2)
  termo_padrao_compra             TEXT,
  permite_multiplos_alunos        BOOLEAN NOT NULL DEFAULT true,
  mensagem_pos_compra             TEXT,
  carrinho_expiracao_minutos      INT     NOT NULL DEFAULT 60 CHECK (carrinho_expiracao_minutos > 0),
  exige_cpf_responsavel           BOOLEAN NOT NULL DEFAULT true,

  -- Loja Online (Fase 2)
  modo_manutencao                 BOOLEAN NOT NULL DEFAULT false,
  modo_manutencao_mensagem        TEXT,
  layout_home                     TEXT    NOT NULL DEFAULT 'grid' CHECK (layout_home IN ('grid','lista')),
  mostrar_estoque_baixo           BOOLEAN NOT NULL DEFAULT true,
  texto_rodape                    TEXT,

  -- E-mail (Fase 2)
  email_remetente_nome            TEXT,
  email_remetente_endereco        TEXT,
  email_logo_url                  TEXT,

  -- LGPD (Fase 2)
  dpo_email                       TEXT,

  -- Integrações (Fase 2 — flags simples; credenciais ainda em env)
  activesoft_ativo                BOOLEAN NOT NULL DEFAULT false,
  crm_ativo                       BOOLEAN NOT NULL DEFAULT false,
  ga4_id                          TEXT,
  meta_pixel_id                   TEXT,

  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS escola_configuracoes_set_updated_at ON escola_configuracoes;
CREATE TRIGGER escola_configuracoes_set_updated_at
  BEFORE UPDATE ON escola_configuracoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed: cria linha em escola_configuracoes para cada escola existente
INSERT INTO escola_configuracoes (escola_id)
SELECT id FROM escolas
ON CONFLICT (escola_id) DO NOTHING;

-- Trigger para criar configuração automaticamente quando uma escola é criada
CREATE OR REPLACE FUNCTION criar_escola_configuracoes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO escola_configuracoes (escola_id) VALUES (NEW.id)
  ON CONFLICT (escola_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS escolas_criar_configuracoes ON escolas;
CREATE TRIGGER escolas_criar_configuracoes
  AFTER INSERT ON escolas
  FOR EACH ROW EXECUTE FUNCTION criar_escola_configuracoes();
```

- [ ] **Step 2: Aplicar no Supabase SQL Editor**

Cole o conteúdo da migration e clique em Run.
Expected: "Success. No rows returned".

- [ ] **Step 3: Verificar seed**

```sql
SELECT COUNT(*) AS total_escolas, (SELECT COUNT(*) FROM escola_configuracoes) AS total_config;
```

Expected: ambos os números iguais.

- [ ] **Step 4: Commit + push**

```bash
git add supabase/migrations/20260511_create_escola_configuracoes.sql
git commit -m "feat(db): tabela escola_configuracoes + seed e trigger automáticos"
git push
```

---

## Task 4: Migration — `papeis`

**Files:**
- Create: `supabase/migrations/20260511_create_papeis.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- ============================================================
-- Tabela papeis
-- Cada escola tem seus próprios papéis. 6 presets de fábrica
-- (preset = true, chave_preset = 'admin' | 'gerente' | ...).
-- Papéis customizados têm preset = false.
-- ============================================================

CREATE TABLE IF NOT EXISTS papeis (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id    UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  nome         TEXT NOT NULL,
  descricao    TEXT,
  preset       BOOLEAN NOT NULL DEFAULT false,
  chave_preset TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT papeis_chave_preset_valida CHECK (
    chave_preset IS NULL
    OR chave_preset IN ('admin','gerente','financeiro','cantineiro','operador','visualizador')
  ),
  CONSTRAINT papeis_preset_coerencia CHECK (
    (preset = true AND chave_preset IS NOT NULL)
    OR (preset = false AND chave_preset IS NULL)
  ),
  CONSTRAINT papeis_chave_preset_unica UNIQUE (escola_id, chave_preset)
);

CREATE INDEX IF NOT EXISTS idx_papeis_escola ON papeis(escola_id);

DROP TRIGGER IF EXISTS papeis_set_updated_at ON papeis;
CREATE TRIGGER papeis_set_updated_at
  BEFORE UPDATE ON papeis
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

- [ ] **Step 2: Aplicar e verificar**

Aplicar via SQL Editor. Depois:

```sql
SELECT table_name FROM information_schema.tables WHERE table_name = 'papeis';
```

Expected: 1 row.

- [ ] **Step 3: Commit + push**

```bash
git add supabase/migrations/20260511_create_papeis.sql
git commit -m "feat(db): tabela papeis (presets + customizados por escola)"
git push
```

---

## Task 5: Migration — `papel_permissoes`

**Files:**
- Create: `supabase/migrations/20260511_create_papel_permissoes.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- ============================================================
-- Tabela papel_permissoes
-- Lista de chaves de permissão concedidas a um papel.
-- A lista canônica de chaves vive no código (lib/permissoes/keys.ts);
-- aqui não há FK para uma tabela "permissoes" — chaves são strings
-- validadas pela aplicação.
-- ============================================================

CREATE TABLE IF NOT EXISTS papel_permissoes (
  papel_id     UUID NOT NULL REFERENCES papeis(id) ON DELETE CASCADE,
  chave        TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (papel_id, chave)
);

CREATE INDEX IF NOT EXISTS idx_papel_permissoes_papel ON papel_permissoes(papel_id);
```

- [ ] **Step 2: Aplicar e verificar**

```sql
SELECT table_name FROM information_schema.tables WHERE table_name = 'papel_permissoes';
```

Expected: 1 row.

- [ ] **Step 3: Commit + push**

```bash
git add supabase/migrations/20260511_create_papel_permissoes.sql
git commit -m "feat(db): tabela papel_permissoes"
git push
```

---

## Task 6: Migration — `usuario_papel`

**Files:**
- Create: `supabase/migrations/20260511_create_usuario_papel.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- ============================================================
-- Tabela usuario_papel
-- Associa um auth.users (admin/operador/etc) a um papel de uma escola.
-- Um usuário tem APENAS UM papel por escola (UNIQUE).
-- Suspensão é registrada aqui (em vez de tocar em auth.users).
-- ============================================================

CREATE TABLE IF NOT EXISTS usuario_papel (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  escola_id      UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  papel_id       UUID NOT NULL REFERENCES papeis(id) ON DELETE RESTRICT,
  suspenso       BOOLEAN NOT NULL DEFAULT false,
  suspenso_em    TIMESTAMPTZ,
  suspenso_por   UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT usuario_papel_unico_por_escola UNIQUE (user_id, escola_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_papel_user   ON usuario_papel(user_id);
CREATE INDEX IF NOT EXISTS idx_usuario_papel_escola ON usuario_papel(escola_id);
CREATE INDEX IF NOT EXISTS idx_usuario_papel_papel  ON usuario_papel(papel_id);

DROP TRIGGER IF EXISTS usuario_papel_set_updated_at ON usuario_papel;
CREATE TRIGGER usuario_papel_set_updated_at
  BEFORE UPDATE ON usuario_papel
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

- [ ] **Step 2: Aplicar e verificar**

```sql
SELECT table_name FROM information_schema.tables WHERE table_name = 'usuario_papel';
```

Expected: 1 row.

- [ ] **Step 3: Commit + push**

```bash
git add supabase/migrations/20260511_create_usuario_papel.sql
git commit -m "feat(db): tabela usuario_papel"
git push
```

---

## Task 7: Migration — RLS das novas tabelas

**Files:**
- Create: `supabase/migrations/20260511_rls_configuracoes.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- ============================================================
-- RLS para escola_configuracoes, papeis, papel_permissoes, usuario_papel.
--
-- Política temporária baseada em app_metadata.role enquanto a migração
-- de usuários para usuario_papel está sendo aplicada — a Task 10 vai
-- introduzir um trigger que mantém app_metadata.role espelhando o papel
-- preset associado, mantendo todas as RLS existentes funcionando.
-- ============================================================

ALTER TABLE escola_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE papeis               ENABLE ROW LEVEL SECURITY;
ALTER TABLE papel_permissoes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_papel        ENABLE ROW LEVEL SECURITY;

-- escola_configuracoes: admin lê/escreve da sua escola
CREATE POLICY "escola_configuracoes_admin_rw"
  ON escola_configuracoes FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- papeis: admin lê/escreve
CREATE POLICY "papeis_admin_rw"
  ON papeis FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- papel_permissoes: admin lê/escreve
CREATE POLICY "papel_permissoes_admin_rw"
  ON papel_permissoes FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- usuario_papel: admin lê/escreve; usuário lê o próprio
CREATE POLICY "usuario_papel_self_select"
  ON usuario_papel FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "usuario_papel_admin_all"
  ON usuario_papel FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
```

- [ ] **Step 2: Aplicar e verificar**

```sql
SELECT tablename, policyname FROM pg_policies
WHERE tablename IN ('escola_configuracoes','papeis','papel_permissoes','usuario_papel')
ORDER BY tablename, policyname;
```

Expected: 6 rows (1+1+1+2 + a self-select da usuario_papel).

- [ ] **Step 3: Commit + push**

```bash
git add supabase/migrations/20260511_rls_configuracoes.sql
git commit -m "feat(db): RLS para tabelas de configurações e papéis"
git push
```

---

## Task 8: Migration — seed dos 6 presets para cada escola

**Files:**
- Create: `supabase/migrations/20260511_seed_papeis_presets.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- ============================================================
-- Cria a função seed_papeis_presets(escola_id) que insere os 6
-- papéis de fábrica e suas permissões para uma escola.
-- Roda automaticamente para escolas existentes e fica conectada
-- a um trigger AFTER INSERT em escolas.
--
-- Mapa de permissões reflete o spec (seção 3.5).
-- ============================================================

CREATE OR REPLACE FUNCTION seed_papeis_presets(p_escola_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_admin_id        UUID;
  v_gerente_id      UUID;
  v_financeiro_id   UUID;
  v_cantineiro_id   UUID;
  v_operador_id     UUID;
  v_visualizador_id UUID;

  -- Lista completa de chaves de permissão (espelha lib/permissoes/keys.ts)
  c_all TEXT[] := ARRAY[
    'produtos.ver','produtos.criar','produtos.editar','produtos.excluir',
    'categorias.ver','categorias.gerenciar',
    'pedidos.ver','pedidos.estornar','pedidos.cancelar',
    'pagamentos.ver','pagamentos.estornar',
    'vouchers.ver','vouchers.gerenciar',
    'alunos.ver','alunos.editar',
    'responsaveis.ver','responsaveis.editar',
    'checkin.usar',
    'pdv.usar',
    'cantina.ver','cantina.operar','cantina.gerenciar',
    'relatorios.ver',
    'receita.ver',
    'configuracoes.ver','configuracoes.editar_identidade','configuracoes.editar_pagamentos','configuracoes.gerenciar_usuarios','configuracoes.gerenciar_papeis'
  ];

  c_visualizador TEXT[] := ARRAY[
    'produtos.ver','categorias.ver','pedidos.ver','pagamentos.ver','vouchers.ver',
    'alunos.ver','responsaveis.ver','cantina.ver','relatorios.ver','receita.ver',
    'configuracoes.ver'
  ];
BEGIN
  -- Admin: todas
  INSERT INTO papeis (escola_id, nome, descricao, preset, chave_preset)
    VALUES (p_escola_id, 'Admin', 'Acesso total ao sistema', true, 'admin')
  ON CONFLICT (escola_id, chave_preset) DO NOTHING
  RETURNING id INTO v_admin_id;
  IF v_admin_id IS NULL THEN
    SELECT id INTO v_admin_id FROM papeis WHERE escola_id = p_escola_id AND chave_preset = 'admin';
  END IF;
  INSERT INTO papel_permissoes (papel_id, chave)
    SELECT v_admin_id, unnest(c_all)
  ON CONFLICT DO NOTHING;

  -- Gerente: todas exceto gerenciar usuários e gerenciar papéis
  INSERT INTO papeis (escola_id, nome, descricao, preset, chave_preset)
    VALUES (p_escola_id, 'Gerente', 'Acesso operacional completo, sem gestão de usuários/papéis', true, 'gerente')
  ON CONFLICT (escola_id, chave_preset) DO NOTHING
  RETURNING id INTO v_gerente_id;
  IF v_gerente_id IS NULL THEN
    SELECT id INTO v_gerente_id FROM papeis WHERE escola_id = p_escola_id AND chave_preset = 'gerente';
  END IF;
  INSERT INTO papel_permissoes (papel_id, chave)
    SELECT v_gerente_id, c FROM unnest(c_all) AS c
    WHERE c NOT IN ('configuracoes.gerenciar_usuarios','configuracoes.gerenciar_papeis')
  ON CONFLICT DO NOTHING;

  -- Financeiro: visualizações + estornos + relatórios + receita
  INSERT INTO papeis (escola_id, nome, descricao, preset, chave_preset)
    VALUES (p_escola_id, 'Financeiro', 'Visualização ampla + estornos e relatórios', true, 'financeiro')
  ON CONFLICT (escola_id, chave_preset) DO NOTHING
  RETURNING id INTO v_financeiro_id;
  IF v_financeiro_id IS NULL THEN
    SELECT id INTO v_financeiro_id FROM papeis WHERE escola_id = p_escola_id AND chave_preset = 'financeiro';
  END IF;
  INSERT INTO papel_permissoes (papel_id, chave) VALUES
    (v_financeiro_id, 'produtos.ver'),
    (v_financeiro_id, 'categorias.ver'),
    (v_financeiro_id, 'pedidos.ver'),
    (v_financeiro_id, 'pedidos.estornar'),
    (v_financeiro_id, 'pagamentos.ver'),
    (v_financeiro_id, 'pagamentos.estornar'),
    (v_financeiro_id, 'vouchers.ver'),
    (v_financeiro_id, 'alunos.ver'),
    (v_financeiro_id, 'responsaveis.ver'),
    (v_financeiro_id, 'cantina.ver'),
    (v_financeiro_id, 'relatorios.ver'),
    (v_financeiro_id, 'receita.ver'),
    (v_financeiro_id, 'configuracoes.ver')
  ON CONFLICT DO NOTHING;

  -- Cantineiro: cantina.* + alunos.ver + pdv.usar
  INSERT INTO papeis (escola_id, nome, descricao, preset, chave_preset)
    VALUES (p_escola_id, 'Cantineiro', 'Operação de cantina e PDV', true, 'cantineiro')
  ON CONFLICT (escola_id, chave_preset) DO NOTHING
  RETURNING id INTO v_cantineiro_id;
  IF v_cantineiro_id IS NULL THEN
    SELECT id INTO v_cantineiro_id FROM papeis WHERE escola_id = p_escola_id AND chave_preset = 'cantineiro';
  END IF;
  INSERT INTO papel_permissoes (papel_id, chave) VALUES
    (v_cantineiro_id, 'cantina.ver'),
    (v_cantineiro_id, 'cantina.operar'),
    (v_cantineiro_id, 'cantina.gerenciar'),
    (v_cantineiro_id, 'alunos.ver'),
    (v_cantineiro_id, 'pdv.usar')
  ON CONFLICT DO NOTHING;

  -- Operador: pdv.usar + checkin.usar + pedidos.ver
  INSERT INTO papeis (escola_id, nome, descricao, preset, chave_preset)
    VALUES (p_escola_id, 'Operador', 'PDV e check-in de pedidos', true, 'operador')
  ON CONFLICT (escola_id, chave_preset) DO NOTHING
  RETURNING id INTO v_operador_id;
  IF v_operador_id IS NULL THEN
    SELECT id INTO v_operador_id FROM papeis WHERE escola_id = p_escola_id AND chave_preset = 'operador';
  END IF;
  INSERT INTO papel_permissoes (papel_id, chave) VALUES
    (v_operador_id, 'pdv.usar'),
    (v_operador_id, 'checkin.usar'),
    (v_operador_id, 'pedidos.ver')
  ON CONFLICT DO NOTHING;

  -- Visualizador: somente leituras
  INSERT INTO papeis (escola_id, nome, descricao, preset, chave_preset)
    VALUES (p_escola_id, 'Visualizador', 'Somente leitura', true, 'visualizador')
  ON CONFLICT (escola_id, chave_preset) DO NOTHING
  RETURNING id INTO v_visualizador_id;
  IF v_visualizador_id IS NULL THEN
    SELECT id INTO v_visualizador_id FROM papeis WHERE escola_id = p_escola_id AND chave_preset = 'visualizador';
  END IF;
  INSERT INTO papel_permissoes (papel_id, chave)
    SELECT v_visualizador_id, unnest(c_visualizador)
  ON CONFLICT DO NOTHING;
END;
$$;

-- Seed para escolas existentes
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM escolas LOOP
    PERFORM seed_papeis_presets(r.id);
  END LOOP;
END;
$$;

-- Trigger pra novas escolas
CREATE OR REPLACE FUNCTION trg_seed_papeis_nova_escola()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM seed_papeis_presets(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS escolas_seed_papeis ON escolas;
CREATE TRIGGER escolas_seed_papeis
  AFTER INSERT ON escolas
  FOR EACH ROW EXECUTE FUNCTION trg_seed_papeis_nova_escola();
```

- [ ] **Step 2: Aplicar e verificar**

```sql
SELECT chave_preset, COUNT(*) FROM papeis WHERE preset = true GROUP BY chave_preset ORDER BY chave_preset;
```

Expected: 6 linhas (admin, cantineiro, financeiro, gerente, operador, visualizador), cada uma com `COUNT = nº de escolas`.

```sql
SELECT p.chave_preset, COUNT(pp.chave) AS perms
FROM papeis p LEFT JOIN papel_permissoes pp ON pp.papel_id = p.id
WHERE p.preset = true
GROUP BY p.chave_preset ORDER BY p.chave_preset;
```

Expected: admin=29, gerente=27, financeiro=13, cantineiro=5, operador=3, visualizador=11 (somando todas as escolas — divida pela contagem de escolas para conferir por escola).

- [ ] **Step 3: Commit + push**

```bash
git add supabase/migrations/20260511_seed_papeis_presets.sql
git commit -m "feat(db): seed dos 6 presets de papéis + permissões para cada escola"
git push
```

---

## Task 9: Migration — converter `app_metadata.role` existente em `usuario_papel`

**Files:**
- Create: `supabase/migrations/20260511_migrate_roles_to_usuario_papel.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- ============================================================
-- Migra usuários existentes:
--   auth.users.raw_app_meta_data->>'role' = 'admin'    → preset Admin
--   auth.users.raw_app_meta_data->>'role' = 'operador' → preset Operador
--
-- Vincula à escola do usuário quando possível (via responsaveis.escola_id);
-- quando o usuário não está em responsaveis (admin "técnico"), pega
-- a primeira escola ativa como fallback.
-- ============================================================

DO $$
DECLARE
  u RECORD;
  v_escola_id UUID;
  v_papel_id  UUID;
BEGIN
  FOR u IN
    SELECT id, raw_app_meta_data->>'role' AS role
    FROM auth.users
    WHERE raw_app_meta_data->>'role' IN ('admin','operador')
  LOOP
    SELECT escola_id INTO v_escola_id FROM responsaveis WHERE id = u.id;
    IF v_escola_id IS NULL THEN
      SELECT id INTO v_escola_id FROM escolas WHERE ativo = true ORDER BY created_at LIMIT 1;
    END IF;
    IF v_escola_id IS NULL THEN
      RAISE NOTICE 'Sem escola para usuário %, pulando', u.id;
      CONTINUE;
    END IF;

    SELECT id INTO v_papel_id FROM papeis
      WHERE escola_id = v_escola_id AND chave_preset = u.role;

    IF v_papel_id IS NULL THEN
      RAISE NOTICE 'Preset % não encontrado para escola %, pulando user %', u.role, v_escola_id, u.id;
      CONTINUE;
    END IF;

    INSERT INTO usuario_papel (user_id, escola_id, papel_id)
      VALUES (u.id, v_escola_id, v_papel_id)
    ON CONFLICT (user_id, escola_id) DO UPDATE SET papel_id = EXCLUDED.papel_id;
  END LOOP;
END;
$$;
```

- [ ] **Step 2: Aplicar e verificar**

```sql
SELECT
  (SELECT COUNT(*) FROM auth.users WHERE raw_app_meta_data->>'role' IN ('admin','operador')) AS roles_legados,
  (SELECT COUNT(*) FROM usuario_papel) AS migrados;
```

Expected: os dois números iguais (ou `migrados` pelo menos próximo; se houver `RAISE NOTICE` no log, investigue).

- [ ] **Step 3: Commit + push**

```bash
git add supabase/migrations/20260511_migrate_roles_to_usuario_papel.sql
git commit -m "feat(db): migra usuários existentes (app_metadata.role) para usuario_papel"
git push
```

---

## Task 10: Migration — trigger que espelha `usuario_papel` em `app_metadata.role`

**Files:**
- Create: `supabase/migrations/20260511_sync_app_metadata_role.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- ============================================================
-- Mantém auth.users.raw_app_meta_data->>'role' espelhando o
-- chave_preset do papel atual em usuario_papel.
--
-- Motivo: todas as RLS atuais checam app_metadata.role. Em vez de
-- reescrever todas as policies, espelhamos. Papéis customizados
-- (preset = false) ficam com role = 'custom' (sem privilégio nas RLS
-- antigas — admin custom precisa ter chave_preset = 'admin' OU as
-- RLS antigas serem migradas em fase futura).
--
-- Para papel preset = false, gravamos role = 'custom' (RLS antigas
-- não reconhecem — esses usuários só funcionam via novo sistema de
-- permissões, o que é o objetivo).
-- ============================================================

CREATE OR REPLACE FUNCTION sync_app_metadata_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_chave TEXT;
  v_user  UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user := OLD.user_id;
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) - 'role'
    WHERE id = v_user;
    RETURN OLD;
  END IF;

  v_user := NEW.user_id;
  IF NEW.suspenso THEN
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'suspenso')
    WHERE id = v_user;
    RETURN NEW;
  END IF;

  SELECT COALESCE(chave_preset, 'custom') INTO v_chave
    FROM papeis WHERE id = NEW.papel_id;

  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', v_chave)
  WHERE id = v_user;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS usuario_papel_sync_app_metadata ON usuario_papel;
CREATE TRIGGER usuario_papel_sync_app_metadata
  AFTER INSERT OR UPDATE OR DELETE ON usuario_papel
  FOR EACH ROW EXECUTE FUNCTION sync_app_metadata_role();

-- Roda uma vez para sincronizar registros já existentes
UPDATE usuario_papel SET updated_at = updated_at;
```

- [ ] **Step 2: Aplicar e verificar**

```sql
SELECT u.email, u.raw_app_meta_data->>'role' AS role_jwt, p.chave_preset
FROM auth.users u
JOIN usuario_papel up ON up.user_id = u.id
JOIN papeis p ON p.id = up.papel_id
ORDER BY u.email;
```

Expected: `role_jwt` igual a `chave_preset` (ou 'custom' se papel customizado).

- [ ] **Step 3: Commit + push**

```bash
git add supabase/migrations/20260511_sync_app_metadata_role.sql
git commit -m "feat(db): trigger espelha usuario_papel em app_metadata.role"
git push
```

---

## Task 11: Atualizar `types/database.ts`

**Files:**
- Modify: `types/database.ts`

- [ ] **Step 1: Adicionar tipos ao final do arquivo**

Abrir `types/database.ts` e acrescentar no final:

```typescript
// ─────────────────────────────────────────────────────────
// Configurações
// ─────────────────────────────────────────────────────────

export type ChavePresetPapel =
  | 'admin' | 'gerente' | 'financeiro' | 'cantineiro' | 'operador' | 'visualizador'

export interface Papel {
  id: string
  escola_id: string
  nome: string
  descricao: string | null
  preset: boolean
  chave_preset: ChavePresetPapel | null
  created_at: string
  updated_at: string
}

export interface PapelPermissao {
  papel_id: string
  chave: string
  created_at: string
}

export interface UsuarioPapel {
  id: string
  user_id: string
  escola_id: string
  papel_id: string
  suspenso: boolean
  suspenso_em: string | null
  suspenso_por: string | null
  created_at: string
  updated_at: string
}

export interface EscolaConfiguracoes {
  escola_id: string

  // Pagamentos
  metodos_aceitos_padrao: MetodoPagamento[]
  max_parcelas_padrao: number
  pix_expiracao_segundos: number
  taxa_cartao_repassada: boolean
  taxa_cartao_percentual: number | null
  asaas_webhook_secret: string | null
  pix_chave_recebedora: string | null

  // Cantina
  cantina_recarga_min: number
  cantina_recarga_max: number
  cantina_metodos_recarga: MetodoPagamento[]
  cantina_exige_pin: boolean
  cantina_pin_tamanho: number
  cantina_saldo_negativo: boolean

  // Checkout
  termo_padrao_compra: string | null
  permite_multiplos_alunos: boolean
  mensagem_pos_compra: string | null
  carrinho_expiracao_minutos: number
  exige_cpf_responsavel: boolean

  // Loja Online
  modo_manutencao: boolean
  modo_manutencao_mensagem: string | null
  layout_home: 'grid' | 'lista'
  mostrar_estoque_baixo: boolean
  texto_rodape: string | null

  // E-mail
  email_remetente_nome: string | null
  email_remetente_endereco: string | null
  email_logo_url: string | null

  // LGPD
  dpo_email: string | null

  // Integrações
  activesoft_ativo: boolean
  crm_ativo: boolean
  ga4_id: string | null
  meta_pixel_id: string | null

  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Estender `Escola` com os novos campos**

Localizar a interface `Escola` no mesmo arquivo e substituir por:

```typescript
export interface Escola {
  id: string
  nome: string
  cnpj: string | null
  cor_primaria: string
  logo_url: string | null
  dominio: string | null
  ativo: boolean
  created_at: string

  // Identidade estendida (2026-05-11)
  razao_social: string | null
  banner_url: string | null
  slogan: string | null
  texto_boas_vindas: string | null
  favicon_url: string | null
  endereco_logradouro: string | null
  endereco_numero: string | null
  endereco_bairro: string | null
  endereco_cidade: string | null
  endereco_uf: string | null
  endereco_cep: string | null
}
```

- [ ] **Step 3: Atualizar `ESCOLA_FALLBACK`**

Abrir `lib/escola/getEscola.ts` e substituir `ESCOLA_FALLBACK` por:

```typescript
export const ESCOLA_FALLBACK: Escola = {
  id: '',
  nome: process.env.NEXT_PUBLIC_ESCOLA_NOME ?? 'Loja Escolar',
  cnpj: null,
  cor_primaria: process.env.NEXT_PUBLIC_ESCOLA_COR ?? '#1a2f5a',
  logo_url: null,
  dominio: null,
  ativo: true,
  created_at: '',
  razao_social: null,
  banner_url: null,
  slogan: null,
  texto_boas_vindas: null,
  favicon_url: null,
  endereco_logradouro: null,
  endereco_numero: null,
  endereco_bairro: null,
  endereco_cidade: null,
  endereco_uf: null,
  endereco_cep: null,
}
```

- [ ] **Step 4: Compilar para validar**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 5: Commit + push**

```bash
git add types/database.ts lib/escola/getEscola.ts
git commit -m "feat(types): tipos para Papel, UsuarioPapel, EscolaConfiguracoes + extensão de Escola"
git push
```

---

## Task 12: Lista canônica de chaves de permissão

**Files:**
- Create: `lib/permissoes/keys.ts`
- Create: `tests/permissoes/keys.test.ts`

- [ ] **Step 1: Escrever o teste primeiro**

`tests/permissoes/keys.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { PERMISSION_KEYS, PERMISSION_GROUPS, isValidPermissionKey } from '@/lib/permissoes/keys'

describe('permission keys', () => {
  it('contém pelo menos uma chave por módulo do spec', () => {
    const modulos = [
      'produtos','categorias','pedidos','pagamentos','vouchers',
      'alunos','responsaveis','checkin','pdv','cantina',
      'relatorios','receita','configuracoes',
    ]
    for (const m of modulos) {
      expect(PERMISSION_KEYS.some(k => k.startsWith(`${m}.`))).toBe(true)
    }
  })

  it('todas as chaves são únicas', () => {
    expect(new Set(PERMISSION_KEYS).size).toBe(PERMISSION_KEYS.length)
  })

  it('PERMISSION_GROUPS cobre todas as chaves', () => {
    const flat = PERMISSION_GROUPS.flatMap(g => g.permissoes.map(p => p.chave))
    expect(new Set(flat)).toEqual(new Set(PERMISSION_KEYS))
  })

  it('isValidPermissionKey identifica chaves válidas e inválidas', () => {
    expect(isValidPermissionKey('produtos.ver')).toBe(true)
    expect(isValidPermissionKey('foo.bar')).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm test -- keys`
Expected: FAIL — "Cannot find module '@/lib/permissoes/keys'".

- [ ] **Step 3: Implementar o módulo**

`lib/permissoes/keys.ts`:

```typescript
export interface PermissionDef {
  chave: string
  rotulo: string
}

export interface PermissionGroup {
  modulo: string
  rotulo: string
  permissoes: PermissionDef[]
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    modulo: 'produtos', rotulo: 'Produtos',
    permissoes: [
      { chave: 'produtos.ver',     rotulo: 'Ver produtos' },
      { chave: 'produtos.criar',   rotulo: 'Criar produtos' },
      { chave: 'produtos.editar',  rotulo: 'Editar produtos' },
      { chave: 'produtos.excluir', rotulo: 'Excluir produtos' },
    ],
  },
  {
    modulo: 'categorias', rotulo: 'Categorias',
    permissoes: [
      { chave: 'categorias.ver',       rotulo: 'Ver categorias' },
      { chave: 'categorias.gerenciar', rotulo: 'Gerenciar categorias' },
    ],
  },
  {
    modulo: 'pedidos', rotulo: 'Pedidos',
    permissoes: [
      { chave: 'pedidos.ver',       rotulo: 'Ver pedidos' },
      { chave: 'pedidos.estornar',  rotulo: 'Estornar pedidos' },
      { chave: 'pedidos.cancelar',  rotulo: 'Cancelar pedidos' },
    ],
  },
  {
    modulo: 'pagamentos', rotulo: 'Pagamentos',
    permissoes: [
      { chave: 'pagamentos.ver',      rotulo: 'Ver pagamentos' },
      { chave: 'pagamentos.estornar', rotulo: 'Estornar pagamentos' },
    ],
  },
  {
    modulo: 'vouchers', rotulo: 'Vouchers',
    permissoes: [
      { chave: 'vouchers.ver',       rotulo: 'Ver vouchers' },
      { chave: 'vouchers.gerenciar', rotulo: 'Gerenciar vouchers' },
    ],
  },
  {
    modulo: 'alunos', rotulo: 'Alunos',
    permissoes: [
      { chave: 'alunos.ver',    rotulo: 'Ver alunos' },
      { chave: 'alunos.editar', rotulo: 'Editar alunos' },
    ],
  },
  {
    modulo: 'responsaveis', rotulo: 'Responsáveis',
    permissoes: [
      { chave: 'responsaveis.ver',    rotulo: 'Ver responsáveis' },
      { chave: 'responsaveis.editar', rotulo: 'Editar responsáveis' },
    ],
  },
  {
    modulo: 'checkin', rotulo: 'Check-in',
    permissoes: [
      { chave: 'checkin.usar', rotulo: 'Usar check-in' },
    ],
  },
  {
    modulo: 'pdv', rotulo: 'PDV Balcão',
    permissoes: [
      { chave: 'pdv.usar', rotulo: 'Usar PDV' },
    ],
  },
  {
    modulo: 'cantina', rotulo: 'Cantina',
    permissoes: [
      { chave: 'cantina.ver',       rotulo: 'Ver cantina' },
      { chave: 'cantina.operar',    rotulo: 'Operar cantina' },
      { chave: 'cantina.gerenciar', rotulo: 'Gerenciar cantina' },
    ],
  },
  {
    modulo: 'relatorios', rotulo: 'Relatórios',
    permissoes: [
      { chave: 'relatorios.ver', rotulo: 'Ver relatórios' },
    ],
  },
  {
    modulo: 'receita', rotulo: 'Receita',
    permissoes: [
      { chave: 'receita.ver', rotulo: 'Ver receita líquida' },
    ],
  },
  {
    modulo: 'configuracoes', rotulo: 'Configurações',
    permissoes: [
      { chave: 'configuracoes.ver',                   rotulo: 'Ver configurações' },
      { chave: 'configuracoes.editar_identidade',     rotulo: 'Editar identidade da loja' },
      { chave: 'configuracoes.editar_pagamentos',     rotulo: 'Editar configurações de pagamento' },
      { chave: 'configuracoes.gerenciar_usuarios',    rotulo: 'Gerenciar usuários' },
      { chave: 'configuracoes.gerenciar_papeis',      rotulo: 'Gerenciar papéis' },
    ],
  },
]

export const PERMISSION_KEYS: string[] = PERMISSION_GROUPS.flatMap(
  g => g.permissoes.map(p => p.chave),
)

const KEY_SET = new Set(PERMISSION_KEYS)

export function isValidPermissionKey(k: string): boolean {
  return KEY_SET.has(k)
}

export type PermissionKey = (typeof PERMISSION_KEYS)[number]
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npm test -- keys`
Expected: 4 passed.

- [ ] **Step 5: Commit + push**

```bash
git add lib/permissoes/keys.ts tests/permissoes/keys.test.ts
git commit -m "feat(permissoes): lista canônica de chaves de permissão + testes"
git push
```

---

## Task 13: Helper `getUserPermissions`

**Files:**
- Create: `lib/permissoes/getUserPermissions.ts`
- Create: `tests/permissoes/getUserPermissions.test.ts`

- [ ] **Step 1: Escrever o teste**

`tests/permissoes/getUserPermissions.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { getUserPermissions } from '@/lib/permissoes/getUserPermissions'

function makeSupabase({
  papelId,
  suspenso,
  perms,
}: { papelId: string | null; suspenso?: boolean; perms: string[] }) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'u1' } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'usuario_papel') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: papelId ? { papel_id: papelId, suspenso: !!suspenso } : null,
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'papel_permissoes') {
        return {
          select: () => ({
            eq: vi.fn().mockResolvedValue({
              data: perms.map(c => ({ chave: c })),
              error: null,
            }),
          }),
        }
      }
      throw new Error('unexpected table ' + table)
    }),
  } as any
}

describe('getUserPermissions', () => {
  it('retorna lista vazia para usuário sem papel', async () => {
    const sb = makeSupabase({ papelId: null, perms: [] })
    const r = await getUserPermissions(sb)
    expect(r).toEqual([])
  })

  it('retorna lista vazia para usuário suspenso mesmo com papel', async () => {
    const sb = makeSupabase({ papelId: 'p1', suspenso: true, perms: ['produtos.ver'] })
    const r = await getUserPermissions(sb)
    expect(r).toEqual([])
  })

  it('retorna chaves do papel para usuário ativo', async () => {
    const sb = makeSupabase({ papelId: 'p1', perms: ['produtos.ver','pedidos.ver'] })
    const r = await getUserPermissions(sb)
    expect(r.sort()).toEqual(['pedidos.ver','produtos.ver'])
  })

  it('retorna [] quando não há usuário autenticado', async () => {
    const sb: any = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: vi.fn(),
    }
    const r = await getUserPermissions(sb)
    expect(r).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm test -- getUserPermissions`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

`lib/permissoes/getUserPermissions.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Retorna a lista de chaves de permissão concedidas ao usuário autenticado
 * via usuario_papel + papel_permissoes. Retorna [] se o usuário não está
 * autenticado, não tem papel atribuído ou está suspenso.
 */
export async function getUserPermissions(supabase: SupabaseClient): Promise<string[]> {
  const { data: userRes } = await supabase.auth.getUser()
  const user = userRes?.user
  if (!user) return []

  const { data: vinculo } = await supabase
    .from('usuario_papel')
    .select('papel_id, suspenso')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!vinculo || vinculo.suspenso) return []

  const { data: perms } = await supabase
    .from('papel_permissoes')
    .select('chave')
    .eq('papel_id', vinculo.papel_id)

  return (perms ?? []).map((p: { chave: string }) => p.chave)
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npm test -- getUserPermissions`
Expected: 4 passed.

- [ ] **Step 5: Commit + push**

```bash
git add lib/permissoes/getUserPermissions.ts tests/permissoes/getUserPermissions.test.ts
git commit -m "feat(permissoes): getUserPermissions lê chaves via usuario_papel"
git push
```

---

## Task 14: Helpers `hasPermission` e `requirePermission`

**Files:**
- Create: `lib/permissoes/index.ts`
- Create: `tests/permissoes/require.test.ts`

- [ ] **Step 1: Escrever o teste**

`tests/permissoes/require.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/permissoes/getUserPermissions', () => ({
  getUserPermissions: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { getUserPermissions } from '@/lib/permissoes/getUserPermissions'
import { hasPermission, requirePermission, PermissionDeniedError } from '@/lib/permissoes'

describe('hasPermission / requirePermission', () => {
  it('hasPermission é true quando a chave está na lista', async () => {
    ;(createClient as any).mockResolvedValue({})
    ;(getUserPermissions as any).mockResolvedValue(['produtos.ver','pedidos.ver'])
    expect(await hasPermission('produtos.ver')).toBe(true)
  })

  it('hasPermission é false quando a chave NÃO está na lista', async () => {
    ;(createClient as any).mockResolvedValue({})
    ;(getUserPermissions as any).mockResolvedValue(['pedidos.ver'])
    expect(await hasPermission('produtos.editar')).toBe(false)
  })

  it('requirePermission lança PermissionDeniedError quando não autorizado', async () => {
    ;(createClient as any).mockResolvedValue({})
    ;(getUserPermissions as any).mockResolvedValue([])
    await expect(requirePermission('produtos.ver')).rejects.toBeInstanceOf(PermissionDeniedError)
  })

  it('requirePermission resolve sem erro quando autorizado', async () => {
    ;(createClient as any).mockResolvedValue({})
    ;(getUserPermissions as any).mockResolvedValue(['produtos.ver'])
    await expect(requirePermission('produtos.ver')).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm test -- require`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

`lib/permissoes/index.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { getUserPermissions } from './getUserPermissions'

export class PermissionDeniedError extends Error {
  constructor(public chave: string) {
    super(`Permissão negada: ${chave}`)
    this.name = 'PermissionDeniedError'
  }
}

export async function hasPermission(chave: string): Promise<boolean> {
  const supabase = await createClient()
  const perms = await getUserPermissions(supabase)
  return perms.includes(chave)
}

export async function requirePermission(chave: string): Promise<void> {
  const ok = await hasPermission(chave)
  if (!ok) throw new PermissionDeniedError(chave)
}

export async function currentPermissions(): Promise<string[]> {
  const supabase = await createClient()
  return getUserPermissions(supabase)
}

export { getUserPermissions } from './getUserPermissions'
export * from './keys'
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npm test -- require`
Expected: 4 passed.

- [ ] **Step 5: Rodar TODOS os testes pra garantir que nada quebrou**

Run: `npm test`
Expected: todos passam.

- [ ] **Step 6: Commit + push**

```bash
git add lib/permissoes/index.ts tests/permissoes/require.test.ts
git commit -m "feat(permissoes): hasPermission, requirePermission e PermissionDeniedError"
git push
```

---

## Task 15: Atualizar guard do layout admin

**Files:**
- Modify: `app/(admin)/layout.tsx`

- [ ] **Step 1: Substituir verificação de role**

Abrir `app/(admin)/layout.tsx`. Trocar:

```typescript
const isAdmin = user.app_metadata?.role === 'admin'
if (!isAdmin) redirect('/loja')
```

Por:

```typescript
import { hasPermission } from '@/lib/permissoes'
// ...
const podeEntrar = await hasPermission('configuracoes.ver')
  || await hasPermission('produtos.ver')
  || await hasPermission('pedidos.ver')
if (!podeEntrar) redirect('/loja')
```

> **Lógica:** quem tem qualquer permissão administrativa básica entra no /admin. Layouts internos das sub-rotas farão verificações mais finas em fases seguintes.

- [ ] **Step 2: Compilar**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 3: Smoke test manual**

```bash
npm run dev
```

Abrir `http://localhost:3000/admin` autenticado como admin (papel preset 'admin' tem todas as permissões). Deve carregar a tela.
Abrir como responsável comum: deve redirecionar pra `/loja`.

- [ ] **Step 4: Commit + push**

```bash
git add app/(admin)/layout.tsx
git commit -m "feat(admin): guard usa hasPermission no lugar de app_metadata.role"
git push
```

---

## Task 16: Atualizar guard do layout operador

**Files:**
- Modify: `app/(operador)/layout.tsx`

- [ ] **Step 1: Substituir verificação**

Abrir `app/(operador)/layout.tsx`. Trocar:

```typescript
const role = user.app_metadata?.role
if (role !== 'operador' && role !== 'admin') redirect('/loja')
```

Por:

```typescript
import { hasPermission } from '@/lib/permissoes'
// ...
const podeUsarPdv = await hasPermission('pdv.usar')
if (!podeUsarPdv) redirect('/loja')
```

- [ ] **Step 2: Compilar**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 3: Smoke test manual**

Logar como `operador` (preset tem `pdv.usar`) e acessar `/operador`. Deve carregar.

- [ ] **Step 4: Commit + push**

```bash
git add app/(operador)/layout.tsx
git commit -m "feat(operador): guard usa hasPermission('pdv.usar')"
git push
```

---

## Task 17: Sidebar admin esconde links sem permissão + adiciona "Configurações"

**Files:**
- Modify: `app/(admin)/AdminSidebar.tsx`
- Modify: `app/(admin)/layout.tsx` (passar permissões pra sidebar)

- [ ] **Step 1: Atualizar `AdminSidebar.tsx` para aceitar lista de permissões e filtrar**

Substituir o componente por uma versão que recebe `permissoes: string[]` e filtra cada item:

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ReceiptText, PackageSearch, Users, GraduationCap,
  Camera, ClipboardList, Coffee, Store, Tags, Ticket, TrendingUp,
  ExternalLink, LogOut, Settings,
} from 'lucide-react'
import { logoutAction } from '@/app/actions/auth'

type LinkItem = {
  href: string
  label: string
  icon: any
  perm: string | null  // null = sempre mostra (ex: dashboard)
}

export function AdminSidebar({
  escolaNome,
  iniciais,
  permissoes,
}: {
  escolaNome: string
  iniciais: string
  permissoes: string[]
}) {
  const pathname = usePathname()
  const allowed = (p: string | null) => p === null || permissoes.includes(p)

  const mainLinks: LinkItem[] = [
    { href: '/admin',              label: 'Dashboard',       icon: LayoutDashboard, perm: null },
    { href: '/admin/pedidos',      label: 'Pedidos',         icon: ReceiptText,     perm: 'pedidos.ver' },
    { href: '/admin/produtos',     label: 'Produtos',        icon: PackageSearch,   perm: 'produtos.ver' },
    { href: '/admin/responsaveis', label: 'Responsáveis',    icon: Users,           perm: 'responsaveis.ver' },
    { href: '/admin/alunos',       label: 'Alunos',          icon: GraduationCap,   perm: 'alunos.ver' },
    { href: '/admin/checkin',      label: 'Check-in',        icon: Camera,          perm: 'checkin.usar' },
    { href: '/admin/relatorio',    label: 'Relatório',       icon: ClipboardList,   perm: 'relatorios.ver' },
    { href: '/admin/receita',      label: 'Receita Líquida', icon: TrendingUp,      perm: 'receita.ver' },
    { href: '/admin/cantina',      label: 'Cantina',         icon: Coffee,          perm: 'cantina.ver' },
    { href: '/admin/pdv',          label: 'PDV Balcão',      icon: Store,           perm: 'pdv.usar' },
  ].filter(l => allowed(l.perm))

  const settingsLinks: LinkItem[] = [
    { href: '/admin/produtos/categorias', label: 'Categorias',    icon: Tags,     perm: 'categorias.ver' },
    { href: '/admin/vouchers',            label: 'Vouchers',      icon: Ticket,   perm: 'vouchers.ver' },
    { href: '/admin/configuracoes',       label: 'Configurações', icon: Settings, perm: 'configuracoes.ver' },
  ].filter(l => allowed(l.perm))

  // (... resto do JSX permanece igual, usando mainLinks e settingsLinks já filtrados ...)
  // [Manter o restante do JSX original do arquivo a partir do return — apenas
  //  substitua as listas hard-coded pelas novas variáveis tipadas.]
```

> **Importante:** preserve todo o JSX visual original do arquivo. O que muda são apenas (a) o type/props do componente, (b) as listas de links agora têm a propriedade `perm` e são filtradas, (c) "Configurações" foi acrescentado em `settingsLinks` antes do filtro.

- [ ] **Step 2: Atualizar o layout admin para passar `permissoes`**

Em `app/(admin)/layout.tsx`, antes de renderizar `<AdminSidebar>`, adicionar:

```typescript
import { currentPermissions } from '@/lib/permissoes'
// ...
const permissoes = await currentPermissions()
```

E passar pra sidebar:

```tsx
<AdminSidebar escolaNome={escola.nome} iniciais={iniciais} permissoes={permissoes} />
```

- [ ] **Step 3: Atualizar `AdminMobileNav` para também filtrar por permissão**

`app/(admin)/AdminMobileNav.tsx` — substituir o componente inteiro por:

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ReceiptText, PackageSearch, Users, GraduationCap, Store,
} from 'lucide-react'

type MobileLink = { href: string; label: string; icon: any; perm: string | null }

export function AdminMobileNav({ permissoes }: { permissoes: string[] }) {
  const pathname = usePathname()
  const allowed = (p: string | null) => p === null || permissoes.includes(p)

  const links: MobileLink[] = [
    { href: '/admin',              label: 'Dashboard', icon: LayoutDashboard, perm: null },
    { href: '/admin/pedidos',      label: 'Pedidos',   icon: ReceiptText,     perm: 'pedidos.ver' },
    { href: '/admin/responsaveis', label: 'Pessoas',   icon: Users,           perm: 'responsaveis.ver' },
    { href: '/admin/alunos',       label: 'Alunos',    icon: GraduationCap,   perm: 'alunos.ver' },
    { href: '/admin/produtos',     label: 'Produtos',  icon: PackageSearch,   perm: 'produtos.ver' },
    { href: '/admin/pdv',          label: 'PDV',       icon: Store,           perm: 'pdv.usar' },
  ].filter(l => allowed(l.perm))

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100] flex h-[68px] bg-[#0a1628]/95 backdrop-blur-xl border-t border-white/5 pb-safe">
      {links.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href
        return (
          <Link key={href} href={href} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 4,
            textDecoration: 'none',
            color: isActive ? '#f59e0b' : '#64748b',
            position: 'relative'
          }}>
            {isActive && (
              <div style={{ position: 'absolute', top: 0, width: 24, height: 2, background: '#f59e0b', borderRadius: '0 0 4px 4px' }} />
            )}
            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} style={{ marginTop: isActive ? 2 : 0, transition: 'all 0.2s' }} />
            <span style={{ fontSize: 10, fontWeight: isActive ? 800 : 600 }}>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
```

E em `app/(admin)/layout.tsx`, passar `permissoes` também ao instanciar `<AdminMobileNav />`:

```tsx
<AdminMobileNav permissoes={permissoes} />
```

- [ ] **Step 4: Compilar**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 5: Smoke test**

Run: `npm run dev`
Logar como admin → ver "Configurações" na sidebar (grupo Ajustes).
Logar como `operador` (papel preset com `pdv.usar` + `checkin.usar` + `pedidos.ver`) e tentar abrir `/admin` — vai redirecionar pra `/loja` (porque guard exige `configuracoes.ver` OU `produtos.ver` OU `pedidos.ver`; tem `pedidos.ver`, então entra). Verificar que vê só Dashboard, Pedidos, Check-in, PDV.

- [ ] **Step 6: Commit + push**

```bash
git add app/(admin)/AdminSidebar.tsx app/(admin)/AdminMobileNav.tsx app/(admin)/layout.tsx
git commit -m "feat(admin): sidebar filtra links por permissão + entrada Configurações"
git push
```

---

## Task 18: Layout `/admin/configuracoes`

**Files:**
- Create: `app/(admin)/admin/configuracoes/layout.tsx`
- Create: `app/(admin)/admin/configuracoes/ConfigSidebar.tsx`

- [ ] **Step 1: Criar `ConfigSidebar.tsx`**

`app/(admin)/admin/configuracoes/ConfigSidebar.tsx`:

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type ConfigLink = {
  href: string
  label: string
  perm: string
  fase: 1 | 2 | 3
}

const GROUPS: { titulo: string; links: ConfigLink[] }[] = [
  {
    titulo: 'Loja',
    links: [
      { href: '/admin/configuracoes/loja',         label: 'Identidade & Personalização', perm: 'configuracoes.editar_identidade', fase: 1 },
      { href: '/admin/configuracoes/loja-online',  label: 'Loja Online',                  perm: 'configuracoes.editar_identidade', fase: 2 },
    ],
  },
  {
    titulo: 'Acesso',
    links: [
      { href: '/admin/configuracoes/usuarios', label: 'Usuários', perm: 'configuracoes.gerenciar_usuarios', fase: 1 },
      { href: '/admin/configuracoes/papeis',   label: 'Papéis & Permissões', perm: 'configuracoes.gerenciar_papeis', fase: 1 },
      { href: '/admin/configuracoes/conta',    label: 'Minha Conta', perm: 'configuracoes.ver', fase: 1 },
    ],
  },
  {
    titulo: 'Operação',
    links: [
      { href: '/admin/configuracoes/pagamentos', label: 'Pagamentos', perm: 'configuracoes.editar_pagamentos', fase: 1 },
      { href: '/admin/configuracoes/emails',     label: 'E-mails', perm: 'configuracoes.editar_identidade', fase: 2 },
      { href: '/admin/configuracoes/cantina',    label: 'Cantina', perm: 'configuracoes.editar_identidade', fase: 2 },
      { href: '/admin/configuracoes/checkout',   label: 'Checkout', perm: 'configuracoes.editar_identidade', fase: 2 },
      { href: '/admin/configuracoes/termos',     label: 'Termos & LGPD', perm: 'configuracoes.editar_identidade', fase: 2 },
    ],
  },
  {
    titulo: 'Avançado',
    links: [
      { href: '/admin/configuracoes/integracoes', label: 'Integrações', perm: 'configuracoes.editar_identidade', fase: 2 },
      { href: '/admin/configuracoes/auditoria',   label: 'Auditoria',   perm: 'configuracoes.ver', fase: 3 },
      { href: '/admin/configuracoes/dados',       label: 'Dados & LGPD', perm: 'configuracoes.ver', fase: 3 },
    ],
  },
]

export function ConfigSidebar({ permissoes }: { permissoes: string[] }) {
  const pathname = usePathname()
  const allowed = (p: string) => permissoes.includes(p)

  return (
    <aside style={{
      width: 260, padding: '24px 12px',
      background: 'rgba(0,0,0,0.15)',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      minHeight: 'calc(100dvh - 48px)',
    }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc', padding: '0 12px 16px' }}>
        Configurações
      </h2>
      {GROUPS.map(group => {
        const visible = group.links.filter(l => allowed(l.perm))
        if (visible.length === 0) return null
        return (
          <div key={group.titulo} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 6, paddingLeft: 12 }}>
              {group.titulo}
            </div>
            {visible.map(l => {
              const active = pathname === l.href
              return (
                <Link key={l.href} href={l.href} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 10,
                  fontSize: 13, fontWeight: active ? 800 : 600,
                  color: active ? '#fff' : '#cbd5e1',
                  background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                  textDecoration: 'none',
                }}>
                  <span>{l.label}</span>
                  {l.fase > 1 && (
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: 'rgba(245,158,11,.15)', color: '#f59e0b', fontWeight: 700 }}>
                      F{l.fase}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        )
      })}
    </aside>
  )
}
```

- [ ] **Step 2: Criar `layout.tsx`**

`app/(admin)/admin/configuracoes/layout.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { currentPermissions } from '@/lib/permissoes'
import { ConfigSidebar } from './ConfigSidebar'

export default async function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  const permissoes = await currentPermissions()
  if (!permissoes.includes('configuracoes.ver')) {
    redirect('/admin')
  }

  return (
    <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start', minHeight: 'calc(100dvh - 96px)' }}>
      <ConfigSidebar permissoes={permissoes} />
      <div style={{ flex: 1, padding: '24px 32px' }}>
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Compilar**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 4: Commit + push**

```bash
git add app/(admin)/admin/configuracoes/
git commit -m "feat(configuracoes): layout com sidebar agrupada por área e badges de fase"
git push
```

---

## Task 19: Página index `/admin/configuracoes`

**Files:**
- Create: `app/(admin)/admin/configuracoes/page.tsx`

- [ ] **Step 1: Criar a página**

`app/(admin)/admin/configuracoes/page.tsx`:

```typescript
import Link from 'next/link'
import { currentPermissions } from '@/lib/permissoes'

const CARDS = [
  { href: '/admin/configuracoes/loja',       titulo: 'Identidade & Personalização', descricao: 'Logo, banner, cores, dados fiscais', perm: 'configuracoes.editar_identidade' },
  { href: '/admin/configuracoes/usuarios',   titulo: 'Usuários',                     descricao: 'Convidar, suspender, mudar papéis', perm: 'configuracoes.gerenciar_usuarios' },
  { href: '/admin/configuracoes/papeis',     titulo: 'Papéis & Permissões',          descricao: 'Customize quem acessa o quê', perm: 'configuracoes.gerenciar_papeis' },
  { href: '/admin/configuracoes/pagamentos', titulo: 'Pagamentos',                   descricao: 'Métodos, parcelas, PIX, webhook', perm: 'configuracoes.editar_pagamentos' },
  { href: '/admin/configuracoes/conta',      titulo: 'Minha Conta',                  descricao: 'Senha, MFA, sessões', perm: 'configuracoes.ver' },
]

export default async function ConfiguracoesIndexPage() {
  const perms = await currentPermissions()
  const visiveis = CARDS.filter(c => perms.includes(c.perm))

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 900, color: '#f8fafc', marginBottom: 8 }}>
        Configurações
      </h1>
      <p style={{ color: '#94a3b8', marginBottom: 32 }}>
        Personalize sua loja, gerencie acessos e ajuste a operação.
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 16,
      }}>
        {visiveis.map(c => (
          <Link key={c.href} href={c.href} style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            padding: 20,
            textDecoration: 'none',
            color: '#f8fafc',
            transition: 'all .2s',
          }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>{c.titulo}</div>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>{c.descricao}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Compilar**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 3: Smoke test manual**

Run: `npm run dev`
Logar como admin → abrir `http://localhost:3000/admin/configuracoes` → deve mostrar 5 cards.
Cada link da sidebar leva pra uma rota que ainda não existe (404 esperado por enquanto — serão criadas nas fases seguintes).

- [ ] **Step 4: Commit + push**

```bash
git add app/(admin)/admin/configuracoes/page.tsx
git commit -m "feat(configuracoes): página index com cards das seções da Fase 1"
git push
```

---

## Task 20: Criar bucket Supabase Storage `escola-assets`

**Files:**
- Create: `supabase/migrations/20260511_storage_escola_assets.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- ============================================================
-- Bucket público para assets da loja (logo, banner, favicon).
-- Upload restrito a admins; leitura pública.
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('escola-assets', 'escola-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Leitura pública
CREATE POLICY "escola_assets_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'escola-assets');

-- Upload/update/delete: admin
CREATE POLICY "escola_assets_admin_write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'escola-assets'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','gerente')
  );

CREATE POLICY "escola_assets_admin_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'escola-assets'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','gerente')
  );

CREATE POLICY "escola_assets_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'escola-assets'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','gerente')
  );
```

- [ ] **Step 2: Aplicar e verificar**

```sql
SELECT id, name, public FROM storage.buckets WHERE id = 'escola-assets';
```

Expected: 1 row.

- [ ] **Step 3: Commit + push**

```bash
git add supabase/migrations/20260511_storage_escola_assets.sql
git commit -m "feat(storage): bucket escola-assets para logo/banner/favicon"
git push
```

---

## Task 21: Smoke test final da Fundação

**Files:** nenhum

- [ ] **Step 1: Verificar build e testes**

```bash
cd "Loja virtual/app"
npm test
npx tsc --noEmit
npm run build
```

Expected: testes passam, tsc sem erros, build com sucesso.

- [ ] **Step 2: Verificar banco**

No SQL Editor:

```sql
-- Tabelas
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('escola_configuracoes','papeis','papel_permissoes','usuario_papel');
-- Expected: 4 rows

-- Presets seedados
SELECT chave_preset, COUNT(*) FROM papeis WHERE preset = true GROUP BY chave_preset;
-- Expected: 6 chave_preset distintas

-- Trigger de sincronização
SELECT u.email, u.raw_app_meta_data->>'role' AS role_jwt, p.chave_preset
FROM auth.users u
JOIN usuario_papel up ON up.user_id = u.id
JOIN papeis p ON p.id = up.papel_id;
-- Expected: role_jwt = chave_preset para todos
```

- [ ] **Step 3: Smoke test manual completo**

```bash
npm run dev
```

1. Login como admin → `http://localhost:3000/admin` carrega normalmente
2. Sidebar mostra todos os links (admin tem todas as permissões) incluindo "Configurações"
3. Click em Configurações → abre página index com 5 cards
4. Sidebar de configurações à esquerda mostra grupos Loja/Acesso/Operação/Avançado
5. Logar como operador → `/admin` carrega mas sidebar mostra só Dashboard, Pedidos, Check-in, PDV
6. Logar como responsável comum → tentar `/admin` redireciona pra `/loja`

- [ ] **Step 4: Push final + tag opcional**

```bash
git push
# Após Vercel terminar o deploy, validar em produção (mesmo checklist do step 3).
```

Expected: deploy verde no Vercel.

- [ ] **Step 5: Commit do plano marcado como concluído**

```bash
git add docs/superpowers/plans/2026-05-11-configuracoes-fundacao.md
git commit -m "docs: marca tarefas da Fundação como concluídas"
git push
```

---

## Definition of Done

- [ ] Todas as 4 novas tabelas existem com RLS habilitada
- [ ] 6 presets de papéis criados para cada escola
- [ ] Usuários legados migrados pra `usuario_papel`
- [ ] `app_metadata.role` espelha o papel atual (RLS antigas seguem funcionando)
- [ ] Helpers `hasPermission`, `requirePermission`, `getUserPermissions` cobertos por teste
- [ ] Sidebar admin esconde links sem permissão
- [ ] Layout `/admin/configuracoes` ativo com sidebar e página index
- [ ] Build verde, `tsc --noEmit` limpo, testes passando
- [ ] Deploy Vercel em produção verificado

## Próximo plano

Após Fundação aprovada, escrever o plano do **Módulo Conta** (`/admin/configuracoes/conta` — trocar senha, MFA, perfil, sessões), seguido por Identidade, Pagamentos, Papéis, Usuários.
