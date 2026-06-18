# Agente de QA exploratório (Loja) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir um agente de QA que testa a Loja como uma pessoa real (gera dados, sobe arquivos, paga PIX sandbox, tenta quebrar validações) contra um staging seguro, e entrega relatório com veredito "pode lançar?" + specs de regressão duráveis.

**Architecture:** Sessão principal age como orquestrador via comando `/qa-loja`: trava de segurança → lê playbook → despacha agentes `qa-explorer` em paralelo (1 por perfil) que dirigem Chromium via Playwright contra `QA_BASE_URL` → consolida achados em relatório markdown → cristaliza fluxos verdes em `tests/e2e/`.

**Tech Stack:** Next.js 15 (repo wsapao/EduStore em `Loja virtual/app`), Playwright (`@playwright/test`), Vitest (unit dos fixtures), Supabase (`@supabase/supabase-js`), Asaas sandbox, Claude Code agents/commands.

---

## Convenções

- **Unit (vitest):** arquivos `tests/**/*.test.ts` (config já existente, env `node`, alias `@`).
- **E2E (Playwright):** arquivos `tests/e2e/**/*.spec.ts` (`.spec.ts`, nunca `.test.ts`, p/ não colidir com vitest).
- **Segurança:** nenhum E2E roda sem passar por `assertSafeTarget` (host de staging + Asaas não-produção).
- Branch de trabalho: `feat/qa-agent-loja` (já criada). Commits frequentes, sem push até o usuário pedir.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `package.json` | + devDep `@playwright/test`, scripts `test:e2e` |
| `playwright.config.ts` | baseURL=`QA_BASE_URL`, chromium headless, trace/screenshot; chama a trava de segurança no load |
| `.gitignore` | ignora `playwright-report/`, `test-results/` |
| `tests/qa/fixtures/safety.ts` | trava de segurança (pura, testável) |
| `tests/qa/fixtures/data.ts` | geradores "humanos": CPF/nome/email/arquivo (puros, testáveis) |
| `tests/qa/fixtures/auth.ts` | login por CPF na UI |
| `tests/qa/fixtures/cleanup.ts` | tags `QA-` + limpeza best-effort via service role |
| `tests/qa/fixtures/safety.test.ts` | unit da trava |
| `tests/qa/fixtures/data.test.ts` | unit dos geradores |
| `tests/e2e/smoke.spec.ts` | smoke: vitrine carrega contra staging |
| `tests/e2e/responsavel-checkout.spec.ts` | exemplo durável (Fase 2) |
| `tests/e2e/README.md` | convenção de cristalização |
| `docs/qa/playbook-loja.md` | o "cérebro": fluxos × perfis × critério de correto |
| `docs/qa/staging-setup.md` | runbook do staging (Vercel + Supabase Branch + sandbox) |
| `.claude/agents/qa-explorer.md` | agente explorador (1 por perfil) |
| `.claude/commands/qa-loja.md` | orquestrador `/qa-loja` |
| `docs/qa-reports/.gitkeep` | pasta dos relatórios |
| `.env.example` | + `QA_BASE_URL`, `QA_STAGING_HOST`, `QA_TEST_EMAIL_DOMAIN` |

---

# FASE 0 — Fundação

## Task 1: Instalar Playwright + config + gitignore

**Files:**
- Modify: `package.json` (devDependencies + scripts)
- Create: `playwright.config.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Instalar Playwright e o browser Chromium**

```bash
cd "Loja virtual/app"
npm i -D @playwright/test@^1.49.0
npx playwright install chromium
```

- [ ] **Step 2: Adicionar scripts ao `package.json`**

No bloco `"scripts"`, adicionar:

```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui",
"test:e2e:report": "playwright show-report"
```

- [ ] **Step 3: Criar `playwright.config.ts`**

> Nota: a chamada a `assertSafeTarget` no load faz o Playwright abortar com mensagem clara se `QA_BASE_URL` não for um staging seguro. Isso depende da Task 2 — se executar fora de ordem, crie `safety.ts` antes.

```ts
import { defineConfig, devices } from '@playwright/test'
import { assertSafeTarget } from './tests/qa/fixtures/safety'

const baseURL = process.env.QA_BASE_URL
// Trava: aborta o carregamento se o alvo não for staging seguro.
assertSafeTarget({ baseURL, asaasEnv: process.env.ASAAS_ENVIRONMENT })

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  retries: 1,
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
```

- [ ] **Step 4: Atualizar `.gitignore`**

Acrescentar ao final:

```
# Playwright / QA
playwright-report/
test-results/
```

- [ ] **Step 5: Verificar instalação**

Run: `npx playwright --version`
Expected: imprime `Version 1.49.x` (ou superior). Sem erro.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json playwright.config.ts .gitignore
git commit -m "chore(qa): adiciona Playwright + config com trava de segurança"
```

---

## Task 2: Trava de segurança (TDD)

**Files:**
- Create: `tests/qa/fixtures/safety.ts`
- Test: `tests/qa/fixtures/safety.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// tests/qa/fixtures/safety.test.ts
import { describe, it, expect, afterEach } from 'vitest'
import { assertSafeTarget, UnsafeTargetError } from './safety'

describe('assertSafeTarget', () => {
  afterEach(() => { delete process.env.QA_STAGING_HOST })

  it('aceita preview .vercel.app com asaas sandbox', () => {
    const url = assertSafeTarget({ baseURL: 'https://edu-store-abc.vercel.app', asaasEnv: 'sandbox' })
    expect(url.hostname).toBe('edu-store-abc.vercel.app')
  })

  it('recusa quando asaas é production', () => {
    expect(() => assertSafeTarget({ baseURL: 'https://edu-store-abc.vercel.app', asaasEnv: 'production' }))
      .toThrow(UnsafeTargetError)
  })

  it('recusa host que não é de staging', () => {
    expect(() => assertSafeTarget({ baseURL: 'https://www.xkola.com.br', asaasEnv: 'sandbox' }))
      .toThrow(UnsafeTargetError)
  })

  it('recusa baseURL ausente', () => {
    expect(() => assertSafeTarget({ baseURL: undefined, asaasEnv: 'sandbox' }))
      .toThrow(/QA_BASE_URL/)
  })

  it('aceita host custom via QA_STAGING_HOST', () => {
    process.env.QA_STAGING_HOST = 'staging.xkola.com.br'
    const url = assertSafeTarget({ baseURL: 'https://staging.xkola.com.br', asaasEnv: 'sandbox' })
    expect(url.hostname).toBe('staging.xkola.com.br')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/qa/fixtures/safety.test.ts`
Expected: FAIL — `Cannot find module './safety'`.

- [ ] **Step 3: Implementar `safety.ts`**

```ts
// tests/qa/fixtures/safety.ts
// Trava de segurança: o QA exploratório NUNCA pode rodar contra produção.

export interface SafetyEnv {
  baseURL: string | undefined
  asaasEnv: string | undefined
}

export class UnsafeTargetError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsafeTargetError'
  }
}

export function assertSafeTarget({ baseURL, asaasEnv }: SafetyEnv): URL {
  if (!baseURL) {
    throw new UnsafeTargetError(
      'QA_BASE_URL não definida — recusando rodar sem um alvo de staging explícito.',
    )
  }
  let url: URL
  try {
    url = new URL(baseURL)
  } catch {
    throw new UnsafeTargetError(`QA_BASE_URL inválida: ${baseURL}`)
  }

  const host = url.hostname.toLowerCase()
  const customHost = (process.env.QA_STAGING_HOST ?? '').trim().toLowerCase()
  const hostOk = host.endsWith('.vercel.app') || (customHost !== '' && host === customHost)
  if (!hostOk) {
    throw new UnsafeTargetError(
      `Host não permitido para QA: ${host}. Use um preview .vercel.app de staging ` +
        `ou defina QA_STAGING_HOST com o domínio de staging.`,
    )
  }

  if (asaasEnv === 'production') {
    throw new UnsafeTargetError(
      'ASAAS_ENVIRONMENT=production — recusando rodar QA com gateway de pagamento de produção.',
    )
  }

  return url
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/qa/fixtures/safety.test.ts`
Expected: PASS — 5 testes verdes.

- [ ] **Step 5: Commit**

```bash
git add tests/qa/fixtures/safety.ts tests/qa/fixtures/safety.test.ts
git commit -m "feat(qa): trava de segurança que recusa alvo de produção"
```

---

## Task 3: Geradores de dados "humanos" (TDD)

**Files:**
- Create: `tests/qa/fixtures/data.ts`
- Test: `tests/qa/fixtures/data.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// tests/qa/fixtures/data.test.ts
import { describe, it, expect } from 'vitest'
import { existsSync, statSync } from 'node:fs'
import {
  randomCPF, isValidCPF, formatCPF, randomName, randomEmail, randomImageFile,
} from './data'

describe('geradores de dados "humanos"', () => {
  it('randomCPF gera 11 dígitos com verificadores válidos', () => {
    for (let i = 0; i < 50; i++) {
      const cpf = randomCPF()
      expect(cpf).toMatch(/^\d{11}$/)
      expect(isValidCPF(cpf)).toBe(true)
    }
  })

  it('formatCPF aplica a máscara', () => {
    expect(formatCPF('12345678909')).toBe('123.456.789-09')
  })

  it('randomName usa prefixo QA', () => {
    expect(randomName()).toMatch(/^QA /)
  })

  it('randomEmail é plausível e único', () => {
    expect(randomEmail()).toMatch(/@/)
    expect(randomEmail()).not.toBe(randomEmail())
  })

  it('randomImageFile escreve um PNG real no disco', () => {
    const f = randomImageFile()
    expect(existsSync(f)).toBe(true)
    expect(statSync(f).size).toBeGreaterThan(0)
    expect(f).toMatch(/\.png$/)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/qa/fixtures/data.test.ts`
Expected: FAIL — `Cannot find module './data'`.

- [ ] **Step 3: Implementar `data.ts`**

```ts
// tests/qa/fixtures/data.ts
// Toolkit de dados "como um humano": CPF válido, nomes, e-mails e arquivos aleatórios.
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function cpfCheckDigit(nums: number[], startWeight: number): number {
  const sum = nums.reduce((acc, n, i) => acc + n * (startWeight - i), 0)
  const rest = (sum * 10) % 11
  return rest === 10 ? 0 : rest
}

/** Gera um CPF de 11 dígitos com dígitos verificadores válidos (sem máscara). */
export function randomCPF(): string {
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))
  const d1 = cpfCheckDigit(base, 10)
  const d2 = cpfCheckDigit([...base, d1], 11)
  return [...base, d1, d2].join('')
}

/** Valida dígitos verificadores de um CPF (com ou sem máscara). */
export function isValidCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return false
  if (/^(\d)\1{10}$/.test(digits)) return false // rejeita 000... 111... etc.
  const nums = digits.split('').map(Number)
  const d1 = cpfCheckDigit(nums.slice(0, 9), 10)
  const d2 = cpfCheckDigit(nums.slice(0, 10), 11)
  return d1 === nums[9] && d2 === nums[10]
}

export function formatCPF(cpf: string): string {
  return cpf.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

const FIRST = ['Ana', 'Bruno', 'Carla', 'Diego', 'Eva', 'Felipe', 'Gabi', 'Hugo', 'Iris', 'João']
const LAST = ['Silva', 'Souza', 'Lima', 'Costa', 'Alves', 'Pereira', 'Rocha', 'Gomes']

/** Nome plausível com prefixo QA (facilita limpeza e identificação). */
export function randomName(): string {
  return `QA ${pick(FIRST)} ${pick(LAST)}`
}

/** E-mail único para a caixa de teste (domínio configurável via QA_TEST_EMAIL_DOMAIN). */
export function randomEmail(): string {
  const domain = process.env.QA_TEST_EMAIL_DOMAIN ?? 'qa.test'
  return `qa+${Date.now()}-${Math.floor(Math.random() * 1e4)}@${domain}`
}

/** Escreve um PNG 1x1 válido num arquivo temporário único e retorna o caminho. */
export function randomImageFile(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'qa-'))
  const file = path.join(dir, `qa-${Date.now()}.png`)
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  writeFileSync(file, Buffer.from(pngBase64, 'base64'))
  return file
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/qa/fixtures/data.test.ts`
Expected: PASS — 5 testes verdes.

- [ ] **Step 5: Commit**

```bash
git add tests/qa/fixtures/data.ts tests/qa/fixtures/data.test.ts
git commit -m "feat(qa): geradores de dados humanos (CPF/nome/email/arquivo)"
```

---

## Task 4: Fixture de login por CPF

**Files:**
- Create: `tests/qa/fixtures/auth.ts`

> Login da Loja é por **CPF + senha** (campos `name="cpf"` e `name="senha"`, botão "Entrar na loja"). Verificado em `app/(auth)/login/LoginForm.tsx`. Verificação real desta fixture acontece no smoke (Task 6).

- [ ] **Step 1: Implementar `auth.ts`**

```ts
// tests/qa/fixtures/auth.ts
// Login pela UI (a Loja autentica por CPF + senha).
import { Page, expect } from '@playwright/test'

export interface Credenciais {
  cpf: string   // com ou sem máscara
  senha: string
}

/** Faz login pela tela /login e espera sair de /login. */
export async function loginByCpf(page: Page, { cpf, senha }: Credenciais): Promise<void> {
  await page.goto('/login')
  await page.fill('input[name="cpf"]', cpf)
  await page.fill('input[name="senha"]', senha)
  await page.getByRole('button', { name: /entrar na loja/i }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 })
  // Sanidade: não deve haver mensagem de erro visível.
  await expect(page.locator('body')).not.toContainText(/CPF ou senha inválid/i)
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sem erros novos relacionados a `auth.ts`.

- [ ] **Step 3: Commit**

```bash
git add tests/qa/fixtures/auth.ts
git commit -m "feat(qa): fixture de login por CPF"
```

---

## Task 5: Fixture de limpeza (dados QA-)

**Files:**
- Create: `tests/qa/fixtures/cleanup.ts`

> Em staging numa Supabase Branch efêmera, resetar a branch é a limpeza definitiva. Esta fixture é best-effort para tenants compartilhados. Confirme nomes de tabela/coluna no schema (Supabase MCP `list_tables`) antes de usar em destrutivo amplo.

- [ ] **Step 1: Implementar `cleanup.ts`**

```ts
// tests/qa/fixtures/cleanup.ts
// Marca entidades de teste com prefixo QA- e oferece limpeza best-effort.
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export const QA_PREFIX = 'QA-'

/** Gera um rótulo único com prefixo QA- (ex.: QA-aluno-1718600000000). */
export function qaTag(label: string): string {
  return `${QA_PREFIX}${label}-${Date.now()}`
}

function qaAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('cleanup: faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

// Tabelas/colunas onde dados QA- aparecem por nome. Ajuste conforme o schema real.
const QA_NAME_TARGETS: Array<{ table: string; column: string }> = [
  { table: 'alunos', column: 'nome' },
  { table: 'responsaveis', column: 'nome' },
]

/** Remove linhas cujo `column` começa com QA-. Best-effort: ignora tabela inexistente. */
export async function cleanupQAData(): Promise<void> {
  const db = qaAdminClient()
  for (const { table, column } of QA_NAME_TARGETS) {
    const { error } = await db.from(table).delete().like(column, `${QA_PREFIX}%`)
    if (error && !/does not exist/i.test(error.message)) {
      console.warn(`cleanup: falha ao limpar ${table}.${column}: ${error.message}`)
    }
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add tests/qa/fixtures/cleanup.ts
git commit -m "feat(qa): fixture de limpeza de dados QA-"
```

---

## Task 6: Smoke E2E + env.example + runbook de staging

**Files:**
- Create: `tests/e2e/smoke.spec.ts`
- Modify: `.env.example`
- Create: `docs/qa/staging-setup.md`

- [ ] **Step 1: Criar o smoke spec**

```ts
// tests/e2e/smoke.spec.ts
import { test, expect } from '@playwright/test'

test('a vitrine pública da loja carrega sem erro', async ({ page }) => {
  await page.goto('/loja')
  await expect(page).toHaveTitle(/.+/)
  await expect(page.locator('body')).not.toContainText(
    /Application error|Internal Server Error|This page could not be found/i,
  )
})
```

- [ ] **Step 2: Adicionar variáveis ao `.env.example`**

Acrescentar uma seção:

```
# ── QA exploratório (staging) ─────────────────────────────────────────────────
# URL do preview/staging que o agente de QA vai testar (NUNCA produção).
QA_BASE_URL=https://edu-store-staging.vercel.app
# Domínio de staging custom permitido pela trava de segurança (além de *.vercel.app).
QA_STAGING_HOST=
# Domínio da caixa de teste para e-mails gerados pelo QA.
QA_TEST_EMAIL_DOMAIN=qa.test
```

- [ ] **Step 3: Escrever o runbook de staging**

```markdown
# Staging para QA — runbook

O agente de QA só roda contra um **staging seguro**. Passos (executar com o usuário):

## 1. Supabase Branch (dados isolados)
- Criar uma branch do projeto `rstsomdurwksoqxbypty` (Supabase Branching / MCP `create_branch`).
- Seed mínimo: 1 escola de teste + papéis (admin, operador) + 1 responsável de teste com CPF/senha conhecidos.

## 2. Deploy de preview na Vercel
Variáveis de ambiente do preview:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` → da branch Supabase.
- `ASAAS_ENVIRONMENT=sandbox` + `ASAAS_API_KEY` / `ASAAS_CANTINA_API_KEY` sandbox.
- `RESEND_API_KEY` apontando p/ caixa de teste (ou ausente p/ ignorar e-mails).
- `NEXT_PUBLIC_SITE_URL` = URL do preview.

## 3. Variáveis locais do QA (`.env.local` ou export no shell)
- `QA_BASE_URL` = URL do preview.
- `QA_STAGING_HOST` (se usar domínio custom).
- Credenciais de teste por perfil (ver playbook).

## Verificação
`QA_BASE_URL=<preview> ASAAS_ENVIRONMENT=sandbox npx playwright test tests/e2e/smoke.spec.ts`
Deve passar. Sem `QA_BASE_URL`, o comando aborta pela trava de segurança (esperado).
```

- [ ] **Step 4: Verificar a trava (sem infra)**

Run: `npx playwright test tests/e2e/smoke.spec.ts`
Expected: ABORTA com `UnsafeTargetError: QA_BASE_URL não definida` (prova que a trava funciona sem staging).

- [ ] **Step 5: Verificar o smoke (com staging — requer pré-requisito de infra)**

Run: `QA_BASE_URL=<url-preview> ASAAS_ENVIRONMENT=sandbox npx playwright test tests/e2e/smoke.spec.ts`
Expected: PASS (1 teste). Se o staging ainda não existir, pular este step até o runbook ser concluído.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/smoke.spec.ts .env.example docs/qa/staging-setup.md
git commit -m "feat(qa): smoke e2e + runbook de staging + env de QA"
```

---

# FASE 1 — O agente

## Task 7: Playbook da Loja

**Files:**
- Create: `docs/qa/playbook-loja.md`

- [ ] **Step 1: Escrever o playbook**

```markdown
# Playbook de QA — Loja virtual

O agente segue este playbook E tem licença para exploração livre além dele.
Para cada fluxo: **pré-condição → passos → resultado esperado**. Dados de teste sempre
com prefixo `QA-`. Pagamentos sempre em **sandbox**.

## Credenciais de teste (preencher por ambiente)
- Responsável: CPF `___`, senha `___`
- Admin: CPF `___`, senha `___`
- Operador: CPF `___`, senha `___`

## Perfil: Autenticação
1. **Cadastro** (`/cadastro`): preencher com CPF válido novo + dados → conta criada, login automático ou redirect ao login.
2. **Login** (`/login`): CPF + senha válidos → entra; CPF/senha inválidos → mensagem de erro, sem entrar.
3. **Recuperar senha** (aba em `/login`): CPF válido → confirmação de envio; não vaza se o CPF existe.
4. **Nova senha** (`/nova-senha`): token válido → troca; token inválido/expirado → erro.

## Perfil: Responsável (loja)
1. **Vitrine** (`/loja`): lista produtos; busca/filtro funciona.
2. **Produto** (`/loja/produto/[id]`): detalhes, escolher variação/qtd, adicionar ao carrinho.
3. **Checkout** (`/checkout`): revisar carrinho → escolher PIX → gera QR/código sandbox; escolher cartão → fluxo sandbox (aprovado e recusado).
4. **Pedidos** (`/pedidos`, `/pedido/[id]`): histórico e detalhe; status reflete o pagamento.
5. **Ingresso** (`/ingresso/[token]`): QR/validação do ingresso.
6. **Perfil** (`/perfil`, `/perfil/alunos`, `/perfil/senha`, `/perfil/privacidade`): editar dados, gerenciar alunos, trocar senha, exportar/gerir privacidade (LGPD).

## Perfil: Responsável (cantina)
1. **Cartão** (`/cantina/[aluno_id]/cartao`): exibe saldo/cartão.
2. **Recarga** (`/cantina/[aluno_id]/recarga`): escolher valor → gerar PIX sandbox → confirmar → **saldo atualiza** → e-mail p/ caixa de teste; `recarga/[recarga_id]` mostra status.
3. **Extrato** (`/cantina/[aluno_id]/extrato`): lançamentos batem com recargas/consumos.
4. **Configurar** (`/cantina/[aluno_id]/configurar`): limites/restrições salvam.

## Perfil: Admin
1. **Dashboard** (`/admin`): cards/resumos carregam.
2. **Alunos / Responsáveis** (`/admin/alunos`, `/admin/responsaveis` + export): CRUD + exportação.
3. **Produtos** (`/admin/produtos`, `/novo`, `/[id]/editar`, `/categorias`): CRUD + **upload de imagem** (subir arquivo aleatório, ver renderizar; rejeitar tipo/tamanho inválido).
4. **Pedidos** (`/admin/pedidos`): listar/filtrar, mudar status.
5. **Cantina admin** (`/admin/cantina`, `/recargas`, `/carteiras`, `/produtos`): operações de cantina.
6. **Vouchers / Check-in / Receita / Relatório** (`/admin/vouchers`, `/checkin`, `/receita`, `/relatorio`): geração, leitura, consistência.
7. **PDV** (`/admin/pdv`): venda offline/online, IndexedDB, sincronização.
8. **Configurações** (`/admin/configuracoes/*`): papéis (novo/[id]), cantina, pagamentos, e-mails, loja-online, checkout, termos, usuários, integrações, dados, auditoria, conta — cada um salva e reflete.

## Perfil: Operador
1. **Operador** (`/operador`): fluxo do operador (vendas/atendimento conforme permissão).

## Casos-limite transversais (aplicar em formulários)
- Campo obrigatório vazio → validação bloqueia.
- CPF inválido / e-mail malformado → erro claro.
- Arquivo de tipo errado (ex.: .txt onde espera imagem) ou gigante → rejeitado com mensagem.
- Texto com caracteres especiais / tentativa de `<script>` → tratado, sem quebrar/sem XSS.
- Valores negativos / zero onde não cabe → bloqueado.
- **Permissão (RLS):** perfil sem acesso não consegue abrir/agir em telas de admin (espera 403/redirect).
- Sessão expirada → redireciona ao login.

## Severidade
- **P0** bloqueia lançamento (fluxo de receita quebrado, dados vazando, crash).
- **P1** grave (funcionalidade importante quebrada, workaround difícil).
- **P2** menor (erro localizado, workaround fácil).
- **P3** cosmético.
```

- [ ] **Step 2: Verificar cobertura**

Run: `ls "app/(loja)" "app/(admin)/admin" "app/(operador)" "app/(auth)"`
Expected: cada rota listada tem fluxo correspondente no playbook. Adicionar o que faltar.

- [ ] **Step 3: Commit**

```bash
git add docs/qa/playbook-loja.md
git commit -m "docs(qa): playbook de fluxos da Loja por perfil"
```

---

## Task 8: Agente `qa-explorer`

**Files:**
- Create: `.claude/agents/qa-explorer.md`

- [ ] **Step 1: Escrever a definição do agente**

````markdown
---
name: qa-explorer
description: Explorador de QA que testa a Loja como um usuário real (um perfil por vez). Dirige Chromium via Playwright contra a URL de staging, gera dados realistas, sobe arquivos, testa happy-path e caminhos infelizes, captura artefatos e devolve achados estruturados. Invocado pelo orquestrador /qa-loja.
tools: Bash, Read, Write, Edit, Grep, Glob
model: sonnet
---

Você é um QA exploratório. Recebe: **um perfil** (responsável | admin | operador), **a lista de fluxos** desse perfil e a **URL de staging** (`QA_BASE_URL`). Você se comporta como uma pessoa real usando o sistema.

## Regras inegociáveis
- **Só staging.** Nunca rode sem `QA_BASE_URL` válido. A trava `assertSafeTarget` já protege; se algo barrar, PARE e reporte.
- **Nunca suba dev server local** (trava a máquina). O alvo é sempre a URL publicada.
- Todo dado que você criar usa prefixo `QA-` (use `qaTag()` de `tests/qa/fixtures/cleanup.ts`).
- Você NÃO faz commit nem escreve o relatório final — devolve achados ao orquestrador.

## Como você testa (loop por fluxo)
1. Leia a seção do seu perfil no `docs/qa/playbook-loja.md`.
2. Para cada fluxo, escreva um spec Playwright temporário em `tests/e2e/_scratch/<perfil>-<fluxo>.spec.ts` usando as fixtures (`auth.loginByCpf`, `data.*`). Capture screenshots nos passos-chave (`await page.screenshot({ path: 'test-results/<...>.png' })`).
3. Rode: `npx playwright test tests/e2e/_scratch/<arquivo>.spec.ts`.
4. Leia o resultado e os artefatos (screenshot/trace em `test-results/`, console/network do relatório).
5. **Happy-path:** se passou e bate com o esperado → marque o fluxo como **verde** (candidato a virar spec durável).
6. **Caminho infeliz:** repita variando para os casos-limite do playbook (campo vazio, CPF inválido, arquivo errado, `<script>`, valor negativo, permissão). Comportamento inesperado vira achado.
7. Distinga **bug** de **flaky**: se falhou por rede/timing, rode de novo 1×; só persistente é bug.

## Exemplo de uso das fixtures num spec scratch
```ts
import { test, expect } from '@playwright/test'
import { loginByCpf } from '../../qa/fixtures/auth'
import { randomName, randomImageFile } from '../../qa/fixtures/data'

test('admin sobe imagem de produto', async ({ page }) => {
  await loginByCpf(page, { cpf: process.env.QA_ADMIN_CPF!, senha: process.env.QA_ADMIN_SENHA! })
  await page.goto('/admin/produtos/novo')
  await page.getByLabel(/nome/i).fill(randomName())
  await page.locator('input[type="file"]').setInputFiles(randomImageFile())
  await page.getByRole('button', { name: /salvar/i }).click()
  await expect(page.locator('body')).not.toContainText(/erro/i)
})
```

## O que devolver (formato fixo)
Devolva SOMENTE um bloco JSON com a lista de achados e os fluxos verdes:
```json
{
  "perfil": "admin",
  "verdes": ["admin: upload de imagem de produto", "admin: CRUD de aluno"],
  "achados": [
    {
      "fluxo": "admin: upload de imagem",
      "passo": "subir arquivo .txt",
      "esperado": "rejeitar com mensagem de tipo inválido",
      "obtido": "aceitou o arquivo e quebrou a renderização",
      "severidade": "P1",
      "repro": ["login admin", "ir a /admin/produtos/novo", "subir .txt", "salvar"],
      "artefato": "test-results/admin-upload-txt.png"
    }
  ]
}
```
````

- [ ] **Step 2: Validar o frontmatter**

Run: `head -8 .claude/agents/qa-explorer.md`
Expected: frontmatter com `name: qa-explorer`, `description`, `tools`, `model` bem formados.

- [ ] **Step 3: Commit**

```bash
git add .claude/agents/qa-explorer.md
git commit -m "feat(qa): agente explorador qa-explorer"
```

---

## Task 9: Comando orquestrador `/qa-loja` + relatório

**Files:**
- Create: `.claude/commands/qa-loja.md`
- Create: `docs/qa-reports/.gitkeep`

- [ ] **Step 1: Criar a pasta de relatórios**

```bash
mkdir -p docs/qa-reports && touch docs/qa-reports/.gitkeep
```

- [ ] **Step 2: Escrever o comando `/qa-loja`**

````markdown
---
description: Roda o QA exploratório na Loja (orquestrador). Uso opcional: /qa-loja <url-staging>
---

Você é o **orquestrador de QA** da Loja. Execute em ordem e não pule a trava de segurança.

## 1. Trava de segurança (ABORTE se falhar)
- Defina `QA_BASE_URL`: use o argumento `$ARGUMENTS` se passado; senão o `QA_BASE_URL` do ambiente.
- Rode o smoke como gate:
  `QA_BASE_URL=<url> ASAAS_ENVIRONMENT=sandbox npx playwright test tests/e2e/smoke.spec.ts`
- Se abortar/falhar (alvo não é staging, Asaas em produção, ou app fora do ar): **PARE** e explique ao usuário como concluir o `docs/qa/staging-setup.md`. Nunca prossiga contra produção.

## 2. Plano de sessão
- Leia `docs/qa/playbook-loja.md`.
- Divida os fluxos em 3 lotes por perfil: responsável, admin, operador.

## 3. Fan-out (paralelo)
- Use o skill `superpowers:dispatching-parallel-agents`.
- Dispare 3 subagentes `qa-explorer` em paralelo (subagent_type "qa-explorer"), um por perfil, passando: o perfil, a lista de fluxos do playbook e a `QA_BASE_URL`. Inclua as credenciais de teste do perfil (do ambiente).

## 4. Consolidação
- Junte os JSON dos exploradores. Deduplique achados iguais. Confirme severidades (P0–P3).
- Conte verdes e achados por severidade.

## 5. Relatório
- Escreva `docs/qa-reports/<AAAA-MM-DD-HHMM>.md` com este formato:

```markdown
# Relatório de QA — Loja — <data/hora>
**Alvo:** <QA_BASE_URL>  ·  **Asaas:** sandbox  ·  **Perfis:** responsável, admin, operador

## Veredito
<✅ PODE LANÇAR  |  ⛔ NÃO LANÇAR — N bloqueador(es) P0>

## Resumo
| Severidade | Qtd |
|---|---|
| P0 | _ |
| P1 | _ |
| P2 | _ |
| P3 | _ |
| Fluxos verdes | _ |

## Achados
### [P0] <fluxo> — <título>
- **Passo:** ...
- **Esperado:** ... · **Obtido:** ...
- **Reproduzir:** 1)... 2)...
- **Artefato:** test-results/...
<repetir por achado, ordenado por severidade>

## Fluxos verdes (candidatos a regressão durável)
- ...
```

- Veredito = ⛔ se houver qualquer P0; senão ✅ com ressalvas listando P1+.

## 6. Cristalização (Fase 2)
- Para cada fluxo verde ainda sem spec durável, crie/atualize um spec em `tests/e2e/` seguindo `tests/e2e/README.md` (mova do `_scratch`, dê nome estável, mantenha as asserções). Rode `npx playwright test` para confirmar verde. Remova o `_scratch`.

## 7. Fechamento
- Responda ao usuário: caminho do relatório, o veredito e quantos specs duráveis foram criados/atualizados. NÃO faça push (só se o usuário pedir).
````

- [ ] **Step 3: Verificar que o comando é reconhecido**

Run: `head -3 .claude/commands/qa-loja.md`
Expected: frontmatter com `description`. (O comando aparece como `/qa-loja` numa sessão Claude Code neste repo.)

- [ ] **Step 4: Commit**

```bash
git add .claude/commands/qa-loja.md docs/qa-reports/.gitkeep
git commit -m "feat(qa): comando orquestrador /qa-loja + relatório"
```

---

# FASE 2 — Regressão durável

## Task 10: Convenção de cristalização + spec de exemplo

**Files:**
- Create: `tests/e2e/README.md`
- Create: `tests/e2e/responsavel-checkout.spec.ts`

- [ ] **Step 1: Escrever a convenção**

```markdown
# tests/e2e — specs duráveis de regressão

Specs aqui são os **fluxos verdes cristalizados** pelo `/qa-loja`. Eles rodam sempre,
contra staging, e travam regressões.

## Convenção
- Nome: `<perfil>-<fluxo>.spec.ts` (ex.: `responsavel-checkout.spec.ts`).
- Use as fixtures de `tests/qa/fixtures/` (auth, data, cleanup).
- Credenciais por env: `QA_<PERFIL>_CPF` / `QA_<PERFIL>_SENHA`.
- Pagamentos sempre sandbox. Dados criados com prefixo `QA-`.
- Specs de exploração ad-hoc ficam em `tests/e2e/_scratch/` (gitignored, descartável).

## Rodar
`QA_BASE_URL=<preview> ASAAS_ENVIRONMENT=sandbox npx playwright test`
```

- [ ] **Step 2: Adicionar `_scratch/` ao `.gitignore`**

Acrescentar ao `.gitignore`:

```
tests/e2e/_scratch/
```

- [ ] **Step 3: Escrever o spec de exemplo (checkout PIX, happy-path)**

> Selecionadores robustos (getByRole/getByLabel). Confirme contra a UI real de staging na primeira execução e ajuste se necessário.

```ts
// tests/e2e/responsavel-checkout.spec.ts
import { test, expect } from '@playwright/test'
import { loginByCpf } from '../qa/fixtures/auth'

test('responsável conclui checkout via PIX (sandbox)', async ({ page }) => {
  await loginByCpf(page, {
    cpf: process.env.QA_RESPONSAVEL_CPF!,
    senha: process.env.QA_RESPONSAVEL_SENHA!,
  })

  // Vitrine → primeiro produto → adicionar ao carrinho
  await page.goto('/loja')
  await page.getByRole('link', { name: /ver|comprar|detalhe/i }).first().click()
  await page.getByRole('button', { name: /adicionar|carrinho|comprar/i }).first().click()

  // Checkout → PIX
  await page.goto('/checkout')
  await page.getByText(/pix/i).first().click()
  await page.getByRole('button', { name: /pagar|finalizar|gerar/i }).first().click()

  // Espera o código/QR PIX aparecer (sandbox)
  await expect(page.getByText(/pix|copia e cola|qr/i).first()).toBeVisible({ timeout: 20_000 })
})
```

- [ ] **Step 4: Verificar (requer staging com credenciais de responsável)**

Run: `QA_BASE_URL=<preview> ASAAS_ENVIRONMENT=sandbox QA_RESPONSAVEL_CPF=<cpf> QA_RESPONSAVEL_SENHA=<senha> npx playwright test tests/e2e/responsavel-checkout.spec.ts`
Expected: PASS. Se algum seletor não bater com a UI real, ajuste e rode de novo (esse ajuste é o passo de cristalização). Sem staging, pular até o runbook concluído.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/README.md tests/e2e/responsavel-checkout.spec.ts .gitignore
git commit -m "feat(qa): convenção de cristalização + spec de regressão de checkout"
```

---

## Verificação final da suíte

- [ ] Rodar os unit dos fixtures: `npx vitest run tests/qa` → PASS.
- [ ] Rodar a suíte vitest inteira pra garantir que nada quebrou: `npm run test` → PASS (39 + novos).
- [ ] Confirmar a trava sem env: `npx playwright test` → aborta com `UnsafeTargetError` (esperado).
- [ ] Com staging pronto: `/qa-loja` gera um relatório em `docs/qa-reports/` com veredito.
