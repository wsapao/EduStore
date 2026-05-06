# Security Fixes — Loja Virtual Escolar

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir as 8 vulnerabilidades de severidade Crítica/Alta/Média identificadas no security audit de 2026-05-06.

**Architecture:** Cada task é independente — fixes em camadas separadas (SQL migration, server action, API route, página React). Nenhuma task quebra as demais.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (Postgres + Auth), Vercel

**Fora de escopo deste plano (alta complexidade):**
- Fix 1 (recarga cantina com gateway real) — exige novo fluxo de produto
- Fix 5 (tokenização de cartão via Asaas.js) — exige mudança no checkout client
- Fix 9 (CSP nonce-based) — exige configuração global de middleware

---

## Task 1: Race condition no contador de vouchers

**Severidade:** 🔴 Crítico  
**Files:**
- Create: `supabase/migrations/20260506_atomic_voucher_increment.sql`
- Modify: `app/actions/orders.ts` (linhas 161–167)

### Contexto
O código atual faz `SELECT usos_atuais` depois `UPDATE usos_atuais + 1`. Dois requests simultâneos leem o mesmo valor e ambos incrementam — excedendo o limite do cupom. A correção é mover o incremento para uma UPDATE atômica com condição de guarda no Postgres.

- [ ] **Step 1: Criar a migration SQL**

Criar o arquivo `supabase/migrations/20260506_atomic_voucher_increment.sql`:

```sql
-- Incrementa usos_atuais apenas se ainda há capacidade.
-- Retorna TRUE se o incremento foi feito, FALSE se o limite foi atingido.
CREATE OR REPLACE FUNCTION incrementar_uso_voucher(p_voucher_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE vouchers
  SET usos_atuais = usos_atuais + 1
  WHERE id = p_voucher_id
    AND (limite_usos IS NULL OR usos_atuais < limite_usos);
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;
```

- [ ] **Step 2: Aplicar a migration no Supabase**

No painel do Supabase → SQL Editor, executar o conteúdo do arquivo acima. Confirmar que a função `incrementar_uso_voucher` aparece em Database → Functions.

- [ ] **Step 3: Substituir o read-then-write em `orders.ts`**

Em `app/actions/orders.ts`, substituir as linhas 161–167:

```ts
// ANTES (race condition):
if (voucherIdParaSalvar) {
  const { data: v } = await supabase.from('vouchers').select('usos_atuais').eq('id', voucherIdParaSalvar).single()
  if (v) {
    await supabase.from('vouchers').update({ usos_atuais: v.usos_atuais + 1 }).eq('id', voucherIdParaSalvar)
  }
}

// DEPOIS (atômico):
if (voucherIdParaSalvar) {
  const { data: incrementado } = await supabase
    .rpc('incrementar_uso_voucher', { p_voucher_id: voucherIdParaSalvar })

  if (!incrementado) {
    // Limite atingido em concorrência — desfaz pedido
    await supabase.from('itens_pedido').delete().eq('pedido_id', pedido.id)
    await supabase.from('pedidos').delete().eq('id', pedido.id)
    await restaurarEstoqueVariantes(supabase, input.items)
    return { success: false, error: 'Cupom esgotado. Tente sem o cupom.' }
  }
}
```

- [ ] **Step 4: Testar manualmente**

Abrir dois abas do checkout com o mesmo voucher de `limite_usos = 1` e submeter ao mesmo tempo. Apenas um pedido deve ser aceito com desconto.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260506_atomic_voucher_increment.sql app/actions/orders.ts
git commit -m "fix(security): tornar incremento de voucher atômico via RPC SQL"
```

---

## Task 2: Export de responsáveis vaza dados de outras escolas

**Severidade:** 🟠 Alto (LGPD)  
**Files:**
- Modify: `app/(admin)/admin/responsaveis/export/route.ts`

### Contexto
A rota de export CSV verifica que o usuário é `admin`, mas não filtra por `escola_id`. Qualquer admin pode baixar todos os responsáveis de todas as escolas.

- [ ] **Step 1: Modificar a route para filtrar por escola do admin**

Substituir o conteúdo de `app/(admin)/admin/responsaveis/export/route.ts`:

```ts
import { createClient } from '@/lib/supabase/server'

function escapeCsv(value: string | null | undefined) {
  const normalized = value ?? ''
  return `"${normalized.replace(/"/g, '""')}"`
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'admin') {
    return new Response('Acesso negado.', { status: 403 })
  }

  // Busca escola_id do admin autenticado
  const { data: adminResp } = await supabase
    .from('responsaveis')
    .select('escola_id')
    .eq('id', user.id)
    .single()

  if (!adminResp?.escola_id) {
    return new Response('Admin sem escola vinculada.', { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim().toLocaleLowerCase('pt-BR') ?? ''

  const { data: rows } = await supabase
    .from('responsaveis')
    .select(`
      nome, email, cpf, telefone, created_at,
      vinculos:responsavel_aluno(
        aluno:alunos(nome, serie, turma, ativo)
      )
    `)
    .eq('escola_id', adminResp.escola_id)   // ← isolamento multi-tenant
    .order('created_at', { ascending: false })

  const filtered = (rows ?? []).filter((row) => {
    if (!q) return true
    const alunos = (row.vinculos ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((vinculo: any) => Array.isArray(vinculo.aluno) ? vinculo.aluno[0] : vinculo.aluno)
      .filter(Boolean)

    const haystack = [
      row.nome,
      row.email,
      row.cpf,
      row.telefone ?? '',
      ...alunos.map((aluno: { nome: string; serie: string; turma: string | null }) =>
        `${aluno.nome} ${aluno.serie} ${aluno.turma ?? ''}`
      ),
    ].join(' ').toLocaleLowerCase('pt-BR')

    return haystack.includes(q)
  })

  const header = ['nome', 'email', 'cpf', 'telefone', 'cadastro_em', 'alunos']
  const lines = filtered.map((row) => {
    const alunos = (row.vinculos ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((vinculo: any) => Array.isArray(vinculo.aluno) ? vinculo.aluno[0] : vinculo.aluno)
      .filter(Boolean)
      .map((aluno: { nome: string; serie: string; turma: string | null; ativo: boolean }) =>
        `${aluno.nome} (${aluno.serie}${aluno.turma ? `/${aluno.turma}` : ''}${aluno.ativo ? '' : ' - inativo'})`
      )
      .join(' | ')

    return [
      escapeCsv(row.nome),
      escapeCsv(row.email),
      escapeCsv(row.cpf),
      escapeCsv(row.telefone),
      escapeCsv(new Date(row.created_at).toLocaleDateString('pt-BR')),
      escapeCsv(alunos),
    ].join(',')
  })

  const csv = [header.join(','), ...lines].join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="responsaveis.csv"',
      'Cache-Control': 'no-store',
    },
  })
}
```

- [ ] **Step 2: Testar**

Logar como admin, acessar `/admin/responsaveis` e exportar CSV. Verificar que apenas responsáveis da escola do admin aparecem no arquivo.

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/admin/responsaveis/export/route.ts
git commit -m "fix(security): filtrar export de responsaveis por escola_id do admin (LGPD)"
```

---

## Task 3: Cron de lembretes aberto sem CRON_SECRET

**Severidade:** 🟡 Médio  
**Files:**
- Modify: `app/api/cron/reminders/route.ts`

### Contexto
A verificação atual só bloqueia *se* `CRON_SECRET` estiver configurado. Se não estiver, o endpoint fica completamente aberto.

- [ ] **Step 1: Inverter a lógica de guarda**

No arquivo `app/api/cron/reminders/route.ts`, substituir o início da função `GET` (linhas 6–11):

```ts
// ANTES — fail-open:
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

// DEPOIS — fail-closed:
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron/reminders] CRON_SECRET não configurado.')
    return new NextResponse('Internal Server Error', { status: 500 })
  }
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }
```

- [ ] **Step 2: Verificar que o padrão agora é igual ao de expire-pix**

Comparar com `app/api/cron/expire-pix/route.ts` — ambos devem lançar erro 500 se o secret não estiver configurado.

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/reminders/route.ts
git commit -m "fix(security): cron/reminders fail-closed quando CRON_SECRET ausente"
```

---

## Task 4: Email do responsável exposto na página pública de ingresso

**Severidade:** 🟡 Médio (LGPD — dados de menores)  
**Files:**
- Modify: `app/(loja)/ingresso/[token]/page.tsx` (linha 308)

### Contexto
A página de ingresso é acessível sem autenticação e exibe nome + email do responsável. O email é PII desnecessário neste contexto público.

- [ ] **Step 1: Remover email do responsável da renderização**

Em `app/(loja)/ingresso/[token]/page.tsx`, localizar a linha 308 e substituir:

```tsx
// ANTES:
Ingresso emitido em {fmtDataHora(ingresso.created_at)}<br />
{ingresso.responsavel.nome} · {ingresso.responsavel.email}

// DEPOIS:
Ingresso emitido em {fmtDataHora(ingresso.created_at)}
```

- [ ] **Step 2: Verificar que o `IngressoActions` também não usa o email**

Checar `app/(loja)/ingresso/[token]/IngressoActions.tsx` — confirmar que nenhuma prop de email é passada ou exibida.

- [ ] **Step 3: Commit**

```bash
git add "app/(loja)/ingresso/[token]/page.tsx"
git commit -m "fix(security): remover email do responsavel da pagina publica de ingresso (LGPD)"
```

---

## Task 5: PIN da cantina armazenado em texto puro

**Severidade:** 🟠 Alto  
**Files:**
- Create: `supabase/migrations/20260506_pin_hash.sql`
- Modify: `app/actions/cantina.ts` (funções `configurarCarteiraAction` e `confirmarCompraCantinaAction`)
- Create: `lib/cantina/pin.ts`

### Contexto
O PIN de 4 dígitos é salvo em plaintext e comparado com `===`. Usaremos `bcrypt` do pacote `bcryptjs` (já disponível em ambientes Node.js no Vercel).

- [ ] **Step 1: Verificar se bcryptjs está disponível**

```bash
cd "/Users/webertsantos/Documents/Hub/Loja virtual/app" && grep -r "bcrypt" package.json || echo "não encontrado"
```

Se não estiver, instalar:

```bash
npm install bcryptjs
npm install -D @types/bcryptjs
```

- [ ] **Step 2: Criar helper de PIN**

Criar `lib/cantina/pin.ts`:

```ts
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, SALT_ROUNDS)
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash)
}
```

- [ ] **Step 3: Criar migration para renomear coluna (backward-compatible)**

Criar `supabase/migrations/20260506_pin_hash.sql`:

```sql
-- Renomeia senha_pin para senha_pin_hash para deixar explícito que é um hash.
-- Dados existentes em plaintext são invalidados — usuários precisarão redefinir o PIN.
ALTER TABLE cantina_carteiras
  RENAME COLUMN senha_pin TO senha_pin_hash;

-- Limpa PINs existentes em plaintext (não é possível migrar sem conhecer o texto original)
UPDATE cantina_carteiras SET senha_pin_hash = NULL WHERE senha_pin_hash IS NOT NULL;

COMMENT ON COLUMN cantina_carteiras.senha_pin_hash IS 'bcrypt hash do PIN de 4 dígitos. NULL = sem PIN configurado.';
```

- [ ] **Step 4: Aplicar a migration**

No painel Supabase → SQL Editor, executar o conteúdo do arquivo acima.

- [ ] **Step 5: Atualizar `configurarCarteiraAction` para fazer hash ao salvar**

Em `app/actions/cantina.ts`, no topo do arquivo adicionar:

```ts
import { hashPin } from '@/lib/cantina/pin'
```

Na função `configurarCarteiraAction` (em torno da linha 87), substituir:

```ts
// ANTES:
const updateData: any = {
  limite_diario: limiteDiario,
  ativo: !bloqueioMotivo,
  bloqueio_motivo: bloqueioMotivo || null,
  updated_at: new Date().toISOString(),
}

if (senhaPin !== undefined) {
  updateData.senha_pin = senhaPin || null
}

// DEPOIS:
const updateData: any = {
  limite_diario: limiteDiario,
  ativo: !bloqueioMotivo,
  bloqueio_motivo: bloqueioMotivo || null,
  updated_at: new Date().toISOString(),
}

if (senhaPin !== undefined) {
  updateData.senha_pin_hash = senhaPin ? await hashPin(senhaPin) : null
}
```

- [ ] **Step 6: Atualizar `confirmarCompraCantinaAction` para usar verifyPin**

Em `app/actions/cantina.ts`, na função `confirmarCompraCantinaAction`, adicionar import no topo:

```ts
import { verifyPin } from '@/lib/cantina/pin'
```

Substituir a comparação de PIN (em torno da linha 283–291):

```ts
// ANTES:
const { data: carteira } = await adminClient
  .from('cantina_carteiras')
  .select('id, escola_id, senha_pin')
  .eq('aluno_id', alunoId)
  .single()

if (!carteira) return { error: 'Carteira não encontrada para este aluno.' }

if (carteira.senha_pin && carteira.senha_pin !== senhaDigitada) {
  return { error: 'Senha incorreta.', requiresPin: true }
}

// DEPOIS:
const { data: carteira } = await adminClient
  .from('cantina_carteiras')
  .select('id, escola_id, senha_pin_hash')
  .eq('aluno_id', alunoId)
  .single()

if (!carteira) return { error: 'Carteira não encontrada para este aluno.' }

if (carteira.senha_pin_hash) {
  if (!senhaDigitada) return { error: 'PIN necessário.', requiresPin: true }
  const pinValido = await verifyPin(senhaDigitada, carteira.senha_pin_hash)
  if (!pinValido) return { error: 'Senha incorreta.', requiresPin: true }
}
```

- [ ] **Step 7: Atualizar `buscarAlunoCantinaAction` para usar o novo nome de coluna**

Na função `buscarAlunoCantinaAction`, na query `select`, substituir `senha_pin` por `senha_pin_hash`, e no mapeamento:

```ts
// ANTES:
cantina_carteiras: aluno.cantina_carteiras.map(c => ({
  ...c,
  has_pin: !!c.senha_pin,
  senha_pin: undefined
}))

// DEPOIS:
cantina_carteiras: aluno.cantina_carteiras.map(c => ({
  ...c,
  has_pin: !!c.senha_pin_hash,
  senha_pin_hash: undefined
}))
```

- [ ] **Step 8: Testar**

1. Configurar um PIN na tela de configuração da cantina.
2. Verificar no Supabase que `senha_pin_hash` começa com `$2b$` (formato bcrypt).
3. Tentar compra na cantina — PIN correto deve funcionar, PIN errado deve retornar erro.

- [ ] **Step 9: Commit**

```bash
git add lib/cantina/pin.ts app/actions/cantina.ts supabase/migrations/20260506_pin_hash.sql
git commit -m "fix(security): hash bcrypt no PIN da cantina, remover plaintext"
```

---

## Task 6: Redis não configurado não gera alerta — rate limit silencioso em memória

**Severidade:** 🟡 Médio  
**Files:**
- Modify: `lib/ratelimit.ts`

### Contexto
Em produção sem Upstash Redis, o rate limit roda em memória e é resetado a cada cold start do Vercel — efetivamente desativado. Precisamos logar um aviso claro no startup.

- [ ] **Step 1: Adicionar aviso de configuração ausente**

Em `lib/ratelimit.ts`, após a declaração do `memoryStore`, adicionar:

```ts
// Avisa uma vez por processo se Redis não estiver configurado em produção
if (
  typeof process !== 'undefined' &&
  process.env.NODE_ENV === 'production' &&
  (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN)
) {
  console.warn(
    '[ratelimit] ATENÇÃO: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN não configurados. ' +
    'Rate limiting rodando em memória — será resetado a cada cold start. ' +
    'Configure o Upstash Redis em produção.'
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/ratelimit.ts
git commit -m "fix(security): aviso de startup quando Redis nao configurado em producao"
```

---

## Task 7: `console.time` expõe timing interno em logs de produção

**Severidade:** 🔵 Baixo  
**Files:**
- Modify: `app/actions/auth.ts`

### Contexto
O `loginAction` tem vários `console.time` / `console.timeEnd` que ficam ativos em produção, expondo detalhes de latência nos logs do Vercel.

- [ ] **Step 1: Remover todos os console.time do loginAction**

Em `app/actions/auth.ts`, remover as seguintes linhas completamente:

```ts
// Remover estas linhas:
console.time('loginAction Total')
console.time('createClient')
console.timeEnd('createClient')
console.time('rateLimit')
console.timeEnd('rateLimit')
console.time('rpc get_email_by_cpf')
console.timeEnd('rpc get_email_by_cpf')
console.time('signInWithPassword')
console.timeEnd('signInWithPassword')
console.time('revalidatePath')
console.timeEnd('revalidatePath')
console.timeEnd('loginAction Total')
```

O arquivo final deve ter apenas a lógica de negócio, sem nenhum `console.time`.

- [ ] **Step 2: Verificar que não há outros console.time no projeto**

```bash
grep -r "console\.time" "/Users/webertsantos/Documents/Hub/Loja virtual/app/app" --include="*.ts" --include="*.tsx"
```

Expected output: nenhuma linha.

- [ ] **Step 3: Commit**

```bash
git add app/actions/auth.ts
git commit -m "fix(security): remover console.time do loginAction em producao"
```

---

## Task 8: CEP hardcoded no pagamento com cartão

**Severidade:** 🔵 Baixo  
**Files:**
- Modify: `lib/pagamentos/asaas.ts` (linha 252)
- Modify: `lib/pagamentos/types.ts`
- Modify: `app/actions/orders.ts`

### Contexto
O campo `postalCode: '00000000'` é um dado falso enviado ao Asaas no pagamento com cartão. Isso pode causar recusas por antifraude e não está em conformidade.

- [ ] **Step 1: Adicionar campo `cep` ao tipo `DadosCartao`**

Em `lib/pagamentos/types.ts`, localizar a interface `DadosCartao` e adicionar o campo:

```ts
export interface DadosCartao {
  nome: string
  numero: string
  validade: string
  cvv: string
  cep: string  // ← adicionar
}
```

- [ ] **Step 2: Usar o CEP na chamada ao Asaas**

Em `lib/pagamentos/asaas.ts`, substituir na linha 252:

```ts
// ANTES:
postalCode: '00000000', // fallback — idealmente coleta do usuário

// DEPOIS:
postalCode: input.dadosCartao.cep.replace(/\D/g, ''),
```

- [ ] **Step 3: Atualizar o CheckoutClient para coletar o CEP**

Em `app/(loja)/checkout/CheckoutClient.tsx`, adicionar campo CEP no formulário de cartão. Buscar onde `dadosCartao` é construído e adicionar:

```ts
// No state de dadosCartao, adicionar:
cep: ''

// No JSX, adicionar campo após o CVV:
<input
  type="text"
  placeholder="CEP (00000-000)"
  value={dadosCartao.cep}
  onChange={e => setDadosCartao(prev => ({ ...prev, cep: e.target.value }))}
  maxLength={9}
  inputMode="numeric"
/>
```

- [ ] **Step 4: Verificar se há outros lugares que constroem `DadosCartao`**

```bash
grep -r "DadosCartao" "/Users/webertsantos/Documents/Hub/Loja virtual/app" --include="*.ts" --include="*.tsx" -l
```

Atualizar todos os usos com o campo `cep`.

- [ ] **Step 5: Commit**

```bash
git add lib/pagamentos/types.ts lib/pagamentos/asaas.ts app/\(loja\)/checkout/CheckoutClient.tsx
git commit -m "fix: coletar CEP no checkout para pagamento com cartao (anti-fraude Asaas)"
```

---

## Resumo de Execução

| Task | Severidade | Esforço | Dependência |
|------|-----------|---------|-------------|
| 1 — Voucher atômico | 🔴 Crítico | 20min | Precisa SQL no Supabase |
| 2 — Export por escola | 🟠 Alto | 5min | Nenhuma |
| 3 — Cron fail-closed | 🟡 Médio | 2min | Nenhuma |
| 4 — Email no ingresso | 🟡 Médio | 2min | Nenhuma |
| 5 — PIN hash | 🟠 Alto | 30min | Precisa SQL no Supabase |
| 6 — Redis warning | 🟡 Médio | 5min | Nenhuma |
| 7 — console.time | 🔵 Baixo | 2min | Nenhuma |
| 8 — CEP no cartão | 🔵 Baixo | 15min | Task 8 depende do CheckoutClient |

**Ordem recomendada:** 3 → 4 → 7 → 2 → 6 → 1 → 5 → 8 (mais fácil para mais complexo)
