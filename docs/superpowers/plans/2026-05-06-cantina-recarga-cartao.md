# Cantina — Recarga por Cartão de Crédito (Checkout Hospedado) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar cartão de crédito à vista como segunda opção de pagamento na tela de recarga da cantina, usando o checkout hospedado do Asaas (sem digitar dados de cartão no app).

**Architecture:** O responsável escolhe PIX ou Cartão na tela de recarga. Para cartão, o servidor cria uma cobrança Asaas sem dados de cartão e recebe uma `invoiceUrl`; o cliente redireciona para essa URL com `callbackSuccessUrl` apontando de volta ao app. O webhook existente (`externalReference: 'recarga:{id}'`) já trata a confirmação sem mudanças.

**Tech Stack:** Next.js 15 App Router, Supabase Postgres, Asaas API v3, TypeScript, React.

---

## Mapa de arquivos

| Arquivo | Ação | O que muda |
|---|---|---|
| `supabase/migrations/20260506_cantina_recargas_metodo.sql` | Criar | Colunas `metodo` e `checkout_url` em `cantina_recargas` |
| `lib/pagamentos/types.ts` | Modificar | Novo tipo `ResultadoCartaoHosted`, atualiza union |
| `lib/pagamentos/asaas.ts` | Modificar | Interface `AsaasPayment` ganha `invoiceUrl`; novo branch `cartao_hosted` |
| `app/actions/cantina.ts` | Modificar | `iniciarRecargaAction` aceita `metodo: 'pix' | 'cartao'` |
| `app/(loja)/cantina/[aluno_id]/recarga/RecargaClient.tsx` | Modificar | Seletor de método + lógica de redirect para cartão |
| `app/(loja)/cantina/[aluno_id]/recarga/[recarga_id]/page.tsx` | Modificar | Passa prop `metodo` para `AguardandoClient` |
| `app/(loja)/cantina/[aluno_id]/recarga/[recarga_id]/AguardandoClient.tsx` | Modificar | UI diferente para `metodo === 'cartao'` |

---

## Task 1: Migration — colunas `metodo` e `checkout_url`

**Files:**
- Create: `supabase/migrations/20260506_cantina_recargas_metodo.sql`

- [ ] **Step 1: Criar arquivo de migration**

```sql
-- supabase/migrations/20260506_cantina_recargas_metodo.sql

ALTER TABLE cantina_recargas
  ADD COLUMN IF NOT EXISTS metodo text NOT NULL DEFAULT 'pix'
    CHECK (metodo IN ('pix', 'cartao')),
  ADD COLUMN IF NOT EXISTS checkout_url text;
```

- [ ] **Step 2: Aplicar no Supabase**

Abra o painel do Supabase → SQL Editor → cole o conteúdo do arquivo → Execute.

Resultado esperado: `ALTER TABLE` sem erros.

- [ ] **Step 3: Verificar**

No SQL Editor execute:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'cantina_recargas'
  AND column_name IN ('metodo', 'checkout_url');
```
Deve retornar 2 linhas: `metodo` (text, default 'pix') e `checkout_url` (text, default null).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260506_cantina_recargas_metodo.sql
git commit -m "feat: adiciona colunas metodo e checkout_url em cantina_recargas"
```

---

## Task 2: Tipos — `ResultadoCartaoHosted`

**Files:**
- Modify: `lib/pagamentos/types.ts`

- [ ] **Step 1: Adicionar interface e atualizar union**

Abra `lib/pagamentos/types.ts`. Após a interface `ResultadoBoleto` (linha ~56), adicione:

```typescript
export interface ResultadoCartaoHosted {
  metodo: 'cartao_hosted'
  gateway_id: string
  checkout_url: string
  status: 'aguardando'
}
```

Atualize o union na linha ~66:
```typescript
export type ResultadoPagamento = ResultadoPix | ResultadoCartao | ResultadoBoleto | ResultadoCartaoHosted
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd "/Users/webertsantos/Documents/Hub/Loja virtual/app"
npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add lib/pagamentos/types.ts
git commit -m "feat: tipo ResultadoCartaoHosted para checkout hospedado Asaas"
```

---

## Task 3: Gateway Asaas — branch `cartao_hosted`

**Files:**
- Modify: `lib/pagamentos/asaas.ts`

- [ ] **Step 1: Adicionar `invoiceUrl` na interface `AsaasPayment`**

Em `lib/pagamentos/asaas.ts`, localize a interface `AsaasPayment` (~linha 71) e adicione o campo:

```typescript
interface AsaasPayment {
  id: string
  status: string
  billingType: string
  value: number
  dueDate: string
  bankSlipUrl?: string
  invoiceUrl?: string   // ← adicionar esta linha
}
```

- [ ] **Step 2: Adicionar import do novo tipo**

Localize o bloco de imports no topo do arquivo (~linha 9):

```typescript
import type {
  GatewayPagamento,
  CriarPagamentoInput,
  ResultadoPagamento,
  ResultadoCartaoHosted,  // ← adicionar
} from './types'
```

- [ ] **Step 3: Adicionar branch `cartao_hosted` em `criarPagamento`**

Dentro de `createAsaasGateway`, após o bloco `if (input.metodo === 'boleto') { ... }` e antes do fechamento da função `criarPagamento`, adicione:

```typescript
      if (input.metodo === 'cartao_hosted') {
        const payment = await asaasPost<AsaasPayment>('/payments', {
          customer: customerId,
          billingType: 'CREDIT_CARD',
          value: input.total,
          dueDate,
          description: input.descricao,
          externalReference: input.referencia,
        }, apiKey)

        if (!payment.invoiceUrl) {
          throw new Error('Asaas não retornou invoiceUrl para o pagamento de cartão.')
        }

        return {
          metodo: 'cartao_hosted',
          gateway_id: payment.id,
          checkout_url: payment.invoiceUrl,
          status: 'aguardando',
        } satisfies ResultadoCartaoHosted
      }
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add lib/pagamentos/asaas.ts
git commit -m "feat: gateway Asaas suporta cartao_hosted (invoiceUrl sem dados de cartão)"
```

---

## Task 4: Server Action — `iniciarRecargaAction` aceita `metodo`

**Files:**
- Modify: `app/actions/cantina.ts`

- [ ] **Step 1: Adicionar parâmetro `metodo` na assinatura**

Localize a linha 352:
```typescript
export async function iniciarRecargaAction(alunoId: string, valor: number) {
```
Substitua por:
```typescript
export async function iniciarRecargaAction(
  alunoId: string,
  valor: number,
  metodo: 'pix' | 'cartao' = 'pix',
) {
```

- [ ] **Step 2: Substituir o bloco de criação PIX pelo bloco dinâmico**

Localize o trecho a partir de `// Cria o PIX no Asaas` (~linha 393) até o final do bloco de insert, e substitua pelo seguinte:

```typescript
  // Cria pagamento no Asaas (PIX ou cartão hosted)
  const gateway = getGateway('cantina')
  let resultado: ResultadoPagamento
  try {
    resultado = await gateway.criarPagamento({
      metodo: metodo === 'cartao' ? 'cartao_hosted' : 'pix',
      total: valor,
      responsavel: {
        nome: responsavel.nome,
        email: responsavel.email,
        cpf: responsavel.cpf,
      },
      descricao: `Recarga cantina — R$ ${valor.toFixed(2)}`,
      referencia: `recarga:${recargaId}`,
    })
  } catch (err) {
    console.error('[iniciarRecarga] Erro ao criar pagamento no Asaas:', err)
    return { error: 'Erro ao processar pagamento. Tente novamente.' }
  }

  // Monta campos para insert conforme método
  let insertData: Record<string, unknown>

  if (resultado.metodo === 'pix') {
    insertData = {
      id: recargaId,
      carteira_id: carteira.id,
      responsavel_id: user.id,
      valor,
      metodo: 'pix',
      status: 'aguardando',
      gateway_id: resultado.gateway_id,
      pix_qr_code: resultado.qr_code,
      pix_qr_code_imagem: resultado.qr_code_imagem,
      pix_expiracao: resultado.expiracao,
    }
  } else if (resultado.metodo === 'cartao_hosted') {
    insertData = {
      id: recargaId,
      carteira_id: carteira.id,
      responsavel_id: user.id,
      valor,
      metodo: 'cartao',
      status: 'aguardando',
      gateway_id: resultado.gateway_id,
      checkout_url: resultado.checkout_url,
    }
  } else {
    return { error: 'Método de pagamento inválido.' }
  }

  const adminClient = createAdminClient()
  const { error: errRecarga } = await adminClient
    .from('cantina_recargas' as any)
    .insert(insertData)

  if (errRecarga) {
    console.error('[iniciarRecarga] Pagamento criado mas insert falhou. gateway_id:', resultado.gateway_id, 'erro:', errRecarga.message)
    return { error: 'Erro ao registrar recarga. Tente novamente.' }
  }

  // Retorno diferente por método
  if (resultado.metodo === 'pix') {
    return {
      recarga_id: recargaId,
      metodo: 'pix' as const,
      pix_qr_code: resultado.qr_code,
      pix_qr_code_imagem: resultado.qr_code_imagem,
      pix_expiracao: resultado.expiracao,
    }
  }

  return {
    recarga_id: recargaId,
    metodo: 'cartao' as const,
    checkout_url: resultado.checkout_url,
  }
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add app/actions/cantina.ts
git commit -m "feat: iniciarRecargaAction suporta metodo pix|cartao"
```

---

## Task 5: UI — Seletor de método em `RecargaClient.tsx`

**Files:**
- Modify: `app/(loja)/cantina/[aluno_id]/recarga/RecargaClient.tsx`

- [ ] **Step 1: Adicionar estado de método e lógica de redirect**

Abra `RecargaClient.tsx`. Após os imports existentes, adicione `useCallback` ao import do React se não estiver:
```typescript
import { useState, useTransition, useCallback } from 'react'
```

Dentro do componente, após a declaração de `const [erro, setErro]`, adicione:
```typescript
const [metodoPagamento, setMetodoPagamento] = useState<'pix' | 'cartao'>('pix')
```

- [ ] **Step 2: Substituir a função `handleSubmit`**

Substitua a função `handleSubmit` existente por:

```typescript
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!valorFinal || isNaN(valorFinal) || valorFinal < 5) {
      setErro('Valor mínimo de recarga é R$ 5,00.')
      return
    }
    if (valorFinal > 2000) {
      setErro('Valor máximo por recarga é R$ 2.000,00.')
      return
    }

    startTransition(async () => {
      const res = await iniciarRecargaAction(alunoId, valorFinal, metodoPagamento)
      if ('error' in res) {
        setErro(res.error ?? 'Erro ao iniciar recarga.')
        return
      }
      if (res.metodo === 'cartao') {
        const callbackUrl = `${window.location.origin}/cantina/${alunoId}/recarga/${res.recarga_id}`
        window.location.href = `${res.checkout_url}?callbackSuccessUrl=${encodeURIComponent(callbackUrl)}`
        return
      }
      router.push(`/cantina/${alunoId}/recarga/${res.recarga_id}`)
    })
  }
```

- [ ] **Step 3: Adicionar seletor visual de método no JSX**

Localize o bloco `{/* Método */}` (o div com fundo `#eff6ff` que mostra "Pagamento via PIX") e substitua por:

```tsx
      {/* Método de pagamento */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
          Forma de pagamento
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {/* PIX */}
          <button
            type="button"
            onClick={() => setMetodoPagamento('pix')}
            style={{
              padding: '12px 8px', borderRadius: 'var(--r-md)',
              border: `2px solid ${metodoPagamento === 'pix' ? 'var(--brand)' : 'var(--border)'}`,
              background: metodoPagamento === 'pix' ? 'var(--brand)' : 'var(--surface)',
              color: metodoPagamento === 'pix' ? '#fff' : 'var(--text-1)',
              cursor: 'pointer', textAlign: 'center', transition: 'all .15s',
            }}
          >
            <div style={{ fontSize: 20 }}>⚡</div>
            <div style={{ fontSize: 13, fontWeight: 800, marginTop: 4 }}>PIX</div>
            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>Instantâneo</div>
          </button>
          {/* Cartão */}
          <button
            type="button"
            onClick={() => setMetodoPagamento('cartao')}
            style={{
              padding: '12px 8px', borderRadius: 'var(--r-md)',
              border: `2px solid ${metodoPagamento === 'cartao' ? 'var(--brand)' : 'var(--border)'}`,
              background: metodoPagamento === 'cartao' ? 'var(--brand)' : 'var(--surface)',
              color: metodoPagamento === 'cartao' ? '#fff' : 'var(--text-1)',
              cursor: 'pointer', textAlign: 'center', transition: 'all .15s',
            }}
          >
            <div style={{ fontSize: 20 }}>💳</div>
            <div style={{ fontSize: 13, fontWeight: 800, marginTop: 4 }}>Cartão</div>
            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>À vista</div>
          </button>
        </div>
      </div>
```

- [ ] **Step 4: Atualizar texto do botão de submit**

Localize o botão de submit (último `<button type="submit">`). Substitua o texto interno:

```tsx
        {pending
          ? (metodoPagamento === 'cartao' ? 'Redirecionando…' : 'Gerando PIX…')
          : `Recarregar ${valorFinal && !isNaN(valorFinal) ? fmtMoeda(valorFinal) : ''}`}
```

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros.

- [ ] **Step 6: Commit**

```bash
git add "app/(loja)/cantina/[aluno_id]/recarga/RecargaClient.tsx"
git commit -m "feat: seletor PIX/Cartão na tela de recarga da cantina"
```

---

## Task 6: Server Component — passa `metodo` para `AguardandoClient`

**Files:**
- Modify: `app/(loja)/cantina/[aluno_id]/recarga/[recarga_id]/page.tsx`

- [ ] **Step 1: Adicionar `metodo` na query da recarga**

Localize o `.select(...)` da query de recarga (~linha 20) e adicione `metodo`:

```typescript
    .select('id, valor, status, metodo, pix_qr_code, pix_qr_code_imagem, pix_expiracao, responsavel_id, carteira_id')
```

- [ ] **Step 2: Passar `metodo` para `AguardandoClient`**

Localize o JSX `<AguardandoClient ... />` e adicione a prop:

```tsx
        <AguardandoClient
          recargaId={recarga.id}
          alunoId={aluno_id}
          alunoNome={aluno?.nome ?? ''}
          valor={recarga.valor as number}
          metodo={(recarga.metodo ?? 'pix') as 'pix' | 'cartao'}
          pixQrCode={(recarga.pix_qr_code ?? '') as string}
          pixQrCodeImagem={(recarga.pix_qr_code_imagem ?? '') as string}
          pixExpiracao={(recarga.pix_expiracao ?? '') as string}
          statusInicial={recarga.status as 'aguardando' | 'confirmada' | 'expirada' | 'falhou'}
        />
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros (pode ter erro de prop desconhecida até Task 7 ser concluída).

- [ ] **Step 4: Commit**

```bash
git add "app/(loja)/cantina/[aluno_id]/recarga/[recarga_id]/page.tsx"
git commit -m "feat: page.tsx passa metodo para AguardandoClient"
```

---

## Task 7: Client Component — UI de cartão em `AguardandoClient.tsx`

**Files:**
- Modify: `app/(loja)/cantina/[aluno_id]/recarga/[recarga_id]/AguardandoClient.tsx`

- [ ] **Step 1: Adicionar `metodo` na interface `Props`**

Localize a interface `Props` (~linha 8) e adicione:

```typescript
interface Props {
  recargaId: string
  alunoId: string
  alunoNome: string
  valor: number
  metodo: 'pix' | 'cartao'   // ← adicionar
  pixQrCode: string
  pixQrCodeImagem: string
  pixExpiracao: string
  statusInicial: 'aguardando' | 'confirmada' | 'expirada' | 'falhou'
}
```

- [ ] **Step 2: Desestruturar `metodo` nos parâmetros do componente**

Localize a linha `export function AguardandoClient({` e adicione `metodo` na desestruturação:

```typescript
export function AguardandoClient({
  recargaId, alunoId, alunoNome, valor,
  metodo,
  pixQrCode: initialQrCode,
  pixQrCodeImagem: initialQrImagem,
  pixExpiracao: initialExpiracao,
  statusInicial,
}: Props) {
```

- [ ] **Step 3: Substituir o bloco "Estado: Aguardando (principal)"**

Localize o comentário `// ── Estado: Aguardando (principal) ────────────────────────────` e substitua todo o `return` que vem após ele pelo seguinte:

```tsx
  // ── Estado: Aguardando (principal) ────────────────────────────
  // Cartão: UI simplificada, sem QR code
  if (metodo === 'cartao') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Valor */}
        <div style={{
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)', padding: '12px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.07em' }}>
            Valor da recarga
          </span>
          <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand)' }}>
            {fmtMoeda(valor)}
          </span>
        </div>

        {/* Aguardando confirmação */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-xl)', padding: '40px 24px', gap: 16,
        }}>
          <div style={{ fontSize: 48 }}>💳</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-1)', textAlign: 'center' }}>
            Aguardando confirmação
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', textAlign: 'center', maxWidth: 280 }}>
            Seu pagamento com cartão está sendo processado. Isso pode levar alguns instantes.
          </div>
          {/* Spinner simples via CSS animation */}
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            border: '3px solid var(--border)',
            borderTopColor: 'var(--brand)',
            animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>

        {/* Fallback se Realtime cair */}
        {!realtimeOk && (
          <button
            onClick={() => router.refresh()}
            style={{
              padding: '10px', borderRadius: 'var(--r-md)',
              background: 'var(--surface)', border: '1px solid var(--border)',
              cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-2)',
            }}
          >
            🔄 Verificar pagamento
          </button>
        )}
      </div>
    )
  }

  // ── PIX: UI completa com QR code ──────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Valor da recarga */}
      <div style={{
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)', padding: '12px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.07em' }}>
          Valor da recarga
        </span>
        <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand)' }}>
          {fmtMoeda(valor)}
        </span>
      </div>

      {/* QR Code */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        background: '#fff', border: '1px solid var(--border)',
        borderRadius: 'var(--r-xl)', padding: '24px',
      }}>
        {qrImagem ? (
          <img
            src={qrImagem}
            alt="QR Code PIX"
            width={220}
            height={220}
            style={{ borderRadius: 8, display: 'block' }}
          />
        ) : (
          <div style={{
            width: 220, height: 220,
            background: 'var(--surface-2)', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, color: 'var(--text-3)',
          }}>
            Carregando…
          </div>
        )}
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-3)' }}>
          Escaneie o QR Code no app do banco
        </div>
      </div>

      {/* Copia e cola */}
      <div>
        <div style={{
          fontSize: 12, fontWeight: 700, color: 'var(--text-3)',
          textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8,
        }}>
          Ou copie o código PIX
        </div>
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center',
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)', padding: '10px 12px',
        }}>
          <span style={{
            flex: 1, fontSize: 11, color: 'var(--text-2)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontFamily: 'monospace',
          }}>
            {qrCode}
          </span>
          <button
            onClick={handleCopiar}
            style={{
              padding: '5px 12px', borderRadius: 'var(--r-sm)',
              background: copiado ? '#16a34a' : 'var(--brand)',
              color: '#fff', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700, flexShrink: 0,
              transition: 'background .2s',
            }}
          >
            {copiado ? 'Copiado! ✓' : 'Copiar'}
          </button>
        </div>
      </div>

      {/* Countdown */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        background: segsRestantes < 60 ? '#fff7ed' : 'var(--surface-2)',
        border: `1px solid ${segsRestantes < 60 ? '#fed7aa' : 'var(--border)'}`,
        borderRadius: 'var(--r-md)', padding: '12px',
      }}>
        <span style={{
          fontSize: 13, fontWeight: 600,
          color: segsRestantes < 60 ? '#9a3412' : 'var(--text-2)',
        }}>
          ⏱ Expira em:
        </span>
        <span style={{
          fontSize: 20, fontWeight: 800,
          color: segsRestantes < 60 ? '#dc2626' : 'var(--text-1)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {fmtCountdown(segsRestantes)}
        </span>
      </div>

      {/* Fallback: botão manual se Realtime cair */}
      {!realtimeOk && (
        <button
          onClick={() => router.refresh()}
          style={{
            padding: '10px', borderRadius: 'var(--r-md)',
            background: 'var(--surface)', border: '1px solid var(--border)',
            cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-2)',
          }}
        >
          🔄 Verificar pagamento
        </button>
      )}

    </div>
  )
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros.

- [ ] **Step 5: Commit e push**

```bash
git add "app/(loja)/cantina/[aluno_id]/recarga/[recarga_id]/AguardandoClient.tsx"
git commit -m "feat: AguardandoClient mostra spinner para cartão e QR para PIX"
git push
```

---

## Verificação final

Após o deploy no Vercel:

1. Acesse o portal do responsável → Cantina → selecione um aluno → Recarregar
2. Selecione **Cartão** e um valor
3. Clique em Recarregar — deve redirecionar para checkout do Asaas
4. Complete o pagamento no Asaas — deve voltar ao app automaticamente
5. A tela deve mostrar o spinner e, após o webhook chegar, exibir "Saldo creditado!" e redirecionar para o extrato
6. Teste também o fluxo PIX para garantir nenhuma regressão
