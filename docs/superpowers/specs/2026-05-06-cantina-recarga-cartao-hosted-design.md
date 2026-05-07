# Cantina — Recarga por Cartão de Crédito (Checkout Hospedado Asaas)

## Objetivo

Adicionar cartão de crédito à vista como segunda forma de pagamento na tela de recarga da cantina. O responsável escolhe entre PIX ou Cartão; para cartão, é redirecionado ao checkout hospedado do Asaas (sem digitar dados de cartão no nosso app), paga lá, e volta automaticamente ao app via `callbackSuccessUrl`. O saldo é creditado pelo webhook existente.

---

## Arquitetura

O fluxo de cartão é paralelo ao PIX: mesma tabela `cantina_recargas`, mesmo webhook, mesmo RPC `confirmar_recarga`. A diferença está no método de criação do pagamento e no UI da tela de aguardo.

```
RecargaClient (escolhe método)
  └─ iniciarRecargaAction(alunoId, valor, metodo)
       ├─ metodo=pix  → gateway.criarPagamento({metodo:'pix'})       → QR Code
       └─ metodo=cartao → gateway.criarPagamento({metodo:'cartao_hosted'}) → checkout_url
            └─ window.location.href = checkout_url + ?callbackSuccessUrl=...
                  └─ usuário paga no Asaas
                        └─ Asaas redireciona de volta + envia webhook
                              └─ webhook → confirmar_recarga RPC → Realtime → tela atualiza
```

---

## Banco de Dados

### Migration: `20260506_cantina_recargas_metodo.sql`

Adiciona duas colunas à tabela `cantina_recargas`:

```sql
ALTER TABLE cantina_recargas
  ADD COLUMN metodo text NOT NULL DEFAULT 'pix'
    CHECK (metodo IN ('pix', 'cartao')),
  ADD COLUMN checkout_url text;
```

Nenhuma mudança no RPC `confirmar_recarga` — funciona igual para ambos os métodos.

---

## Tipos — `lib/pagamentos/types.ts`

Novo tipo de resultado para checkout hospedado:

```typescript
export interface ResultadoCartaoHosted {
  metodo: 'cartao_hosted'
  gateway_id: string
  checkout_url: string
  status: 'aguardando'
}
```

`ResultadoPagamento` passa a incluir `ResultadoCartaoHosted`.

`MetodoPagamento` (em `types/database.ts` ou equivalente) ganha `'cartao_hosted'` se necessário, ou mantém `'cartao'` no DB e usa `'cartao_hosted'` apenas internamente no gateway.

---

## Gateway — `lib/pagamentos/asaas.ts`

Novo branch em `criarPagamento` para `metodo === 'cartao_hosted'`:

```typescript
// Cria cobrança sem dados de cartão — Asaas retorna invoiceUrl (checkout hospedado)
const payment = await asaasPost<AsaasPayment>('/payments', {
  customer: customerId,
  billingType: 'CREDIT_CARD',
  value: input.total,
  dueDate,
  description: input.descricao,
  externalReference: input.referencia,
}, apiKey)

return {
  metodo: 'cartao_hosted',
  gateway_id: payment.id,
  checkout_url: payment.invoiceUrl,
  status: 'aguardando',
}
```

---

## Server Action — `app/actions/cantina.ts`

`iniciarRecargaAction` recebe novo parâmetro `metodo: 'pix' | 'cartao'`:

**Fluxo PIX:** inalterado.

**Fluxo cartão:**
1. Chama `gateway.criarPagamento({ metodo: 'cartao_hosted', ... })`
2. Captura `checkout_url` do resultado
3. Insere em `cantina_recargas` com `metodo: 'cartao'`, `status: 'aguardando'`, `checkout_url`
4. Retorna `{ recarga_id, checkout_url }`

Em caso de erro no Asaas: `console.error` com detalhes + retorna mensagem genérica ao cliente. Nenhuma recarga inserida.

Em caso de erro no insert após Asaas criar: `console.error` com `gateway_id` para rastreamento manual.

---

## UI — `RecargaClient.tsx`

Adiciona seletor de método antes do botão de submit:

- Dois botões/cards: **PIX** (ativo por padrão) e **Cartão de crédito**
- O card do método ativo fica destacado com `var(--brand)`
- Texto do botão de submit muda: "Gerar PIX" ou "Pagar com Cartão"
- Spinner/estado de loading muda: "Gerando PIX…" ou "Redirecionando…"

Ao submeter com cartão:
```typescript
const res = await iniciarRecargaAction(alunoId, valorFinal, 'cartao')
if ('error' in res) { setErro(res.error); return }
// Monta callbackSuccessUrl absoluto
const callbackUrl = `${window.location.origin}/cantina/${alunoId}/recarga/${res.recarga_id}`
window.location.href = `${res.checkout_url}?callbackSuccessUrl=${encodeURIComponent(callbackUrl)}`
```

---

## Server Component — `[recarga_id]/page.tsx`

Inclui `metodo` na query da recarga e passa para `AguardandoClient`:

```typescript
.select('id, valor, status, metodo, pix_qr_code, pix_qr_code_imagem, pix_expiracao, responsavel_id, carteira_id')
```

```tsx
<AguardandoClient
  ...
  metodo={recarga.metodo as 'pix' | 'cartao'}
/>
```

---

## Client Component — `AguardandoClient.tsx`

Recebe nova prop `metodo: 'pix' | 'cartao'`.

**Renderização condicional no estado `'aguardando'`:**

- `metodo === 'pix'`: UI atual (QR code + copia-e-cola + countdown + renovar)
- `metodo === 'cartao'`: UI simplificada:
  ```
  💳 Processando pagamento
  Aguardando confirmação do seu cartão de crédito.
  Isso pode levar alguns instantes.
  [spinner animado]
  ```
  Sem countdown, sem QR code, sem botão de renovar.

Estados `'confirmada'` e `'expirada'` permanecem iguais para ambos os métodos.

Realtime continua ouvindo normalmente — quando o webhook confirmar, a tela atualiza automaticamente independente do método.

---

## Webhook — `app/api/webhook/asaas/route.ts`

**Nenhuma mudança necessária.** O fluxo de `externalReference: 'recarga:{recargaId}'` já detecta e chama `confirmar_recarga` para qualquer método de pagamento.

---

## Tratamento de Erros

| Cenário | Comportamento |
|---|---|
| Asaas falha ao criar cobrança | `console.error` + mensagem genérica ao usuário, sem insert no banco |
| Insert falha após Asaas criar | `console.error` com `gateway_id`, retorna erro ao usuário |
| Usuário fecha checkout sem pagar | Recarga fica `aguardando`, usuário pode tentar nova recarga |
| Cartão recusado no Asaas | Asaas não envia webhook, recarga fica `aguardando` (limpeza futura fora de escopo) |
| Webhook chega antes do retorno | Realtime já escuta desde a criação, tela atualiza quando webhook chegar |

---

## Fora de Escopo

- Job de limpeza para recargas de cartão não confirmadas
- Parcelamento (apenas à vista)
- Estorno/cancelamento de cobrança de cartão
