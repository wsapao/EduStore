# Estorno Parcial por Item — Design Spec

**Data:** 2026-05-07  
**Status:** Aprovado

---

## Contexto

Hoje `cancelarPedidoAction` cancela o pedido inteiro. Não existe suporte a reembolso parcial. O Asaas suporta reembolso parcial via `POST /payments/{id}/refund` com `{ value: X }`, mas essa chamada não está implementada.

---

## Fluxo Geral

1. Responsável seleciona itens e envia solicitação de estorno com motivo
2. Admin analisa e aprova ou nega (com observação)
3. Se aprovado: Asaas processa reembolso parcial + estoque restaurado + registros atualizados
4. Responsável acompanha status no portal

---

## Modelo de Dados

### Nova tabela: `pedido_estornos`

```sql
id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
pedido_id      uuid NOT NULL REFERENCES pedidos(id),
responsavel_id uuid NOT NULL REFERENCES responsaveis(id),
status         text NOT NULL DEFAULT 'pendente'
               CHECK (status IN ('pendente', 'aprovado', 'negado')),
motivo         text NOT NULL,
obs_admin      text,
valor_total    numeric(10,2) NOT NULL,
created_at     timestamptz NOT NULL DEFAULT now(),
resolvido_em   timestamptz
```

### Nova tabela: `pedido_estornos_itens`

```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
estorno_id      uuid NOT NULL REFERENCES pedido_estornos(id) ON DELETE CASCADE,
item_pedido_id  uuid NOT NULL REFERENCES itens_pedido(id),
valor_item      numeric(10,2) NOT NULL
```

### Alteração em `itens_pedido` (existente)

```sql
ALTER TABLE itens_pedido ADD COLUMN IF NOT EXISTS estornado_em timestamptz;
```

### Regras de negócio

- Item com `estornado_em` preenchido não pode entrar em nova solicitação
- Um pedido só pode ter **uma solicitação `pendente`** por vez
- Se todos os itens do pedido tiverem `estornado_em`, o pedido passa para status `reembolsado`; caso contrário permanece `pago`

---

## Backend

### Gateway (`lib/pagamentos/asaas.ts`)

Novo método na interface `GatewayPagamento`:

```typescript
estornarParcial(gateway_id: string, valor: number): Promise<void>
// POST /payments/{id}/refund com { value: valor }
```

Implementado também no mock (`lib/pagamentos/mock.ts`).

### Server Actions — Responsável (`app/actions/orders.ts`)

**`solicitarEstornoParcialAction(pedidoId, itemIds[], motivo)`**

Validações:
- Usuário autenticado e dono do pedido
- Pedido com status `pago`
- Pedido sem solicitação `pendente` ativa
- Todos os `itemIds` pertencem ao pedido e têm `estornado_em = null`
- `motivo` não vazio

Operação: insere em `pedido_estornos` + `pedido_estornos_itens` em transação.

### Server Actions — Admin (`app/actions/admin.ts`)

**`aprovarEstornoParcialAction(estornoId)`**

Passos:
1. Busca solicitação com status `pendente`
2. Busca `pagamentos.gateway_id` e `pagamentos.metodo` do pedido
3. Se método ≠ boleto: chama `gateway.estornarParcial(gateway_id, valor_total)`
4. Marca `itens_pedido.estornado_em = now()` para cada item da solicitação
5. Restaura estoque via RPC `restaurar_estoque_variante` para itens com variante
6. Atualiza `pedido_estornos`: `status = 'aprovado'`, `resolvido_em = now()`
7. Se todos os itens do pedido estão estornados: atualiza `pedidos.status = 'reembolsado'`
8. Revalida paths

**`negarEstornoParcialAction(estornoId, obs_admin)`**

- `obs_admin` obrigatório
- Atualiza `pedido_estornos`: `status = 'negado'`, `obs_admin`, `resolvido_em = now()`

**Boleto:** `aprovarEstornoParcialAction` detecta método boleto, pula a chamada ao gateway e registra aprovação normalmente. Admin recebe aviso na UI para processar reembolso manualmente no Asaas.

---

## UI — Responsável

**Localização:** página de listagem de pedidos (`/pedidos`) e detalhes do pedido (`/pedido/[id]`)

**Pedido com status `pago` e sem solicitação pendente:**
- Botão "Solicitar estorno" no card do pedido

**Ao clicar "Solicitar estorno":**
- Painel inline (não modal) com:
  - Lista de itens com checkbox — itens com `estornado_em` desabilitados com label "Já estornado"
  - Campo de motivo (obrigatório)
  - Resumo do valor total a reembolsar (atualizado dinamicamente)
  - Botão "Enviar solicitação"

**Pedido com solicitação `pendente`:**
- Badge "Estorno aguardando análise" — sem edição ou cancelamento possível

**Após resolução:**
- ✅ "Estorno aprovado — R$ X,XX"
- ❌ "Estorno negado — [obs do admin]"

---

## UI — Admin

**Localização:** `/admin/pedidos`

**Listagem:** pedidos com solicitação `pendente` exibem badge amarelo "Estorno pendente"

**Dentro do pedido — card de solicitação:**
- Data e motivo do responsável
- Lista dos itens solicitados (nome, variante, valor)
- Total a reembolsar
- Botões "Aprovar estorno" e "Negar"

**Fluxo de aprovação:**
- Confirmação inline: "Reembolsar R$ X,XX via [PIX/Cartão]?"
- Exibe sucesso ou erro

**Fluxo de negação:**
- Campo de texto obrigatório para observação
- Botão "Confirmar negação"

**Boleto:** aviso no card — *"Pedido pago com boleto. Processe o reembolso manualmente no Asaas antes de aprovar."*

**Histórico:** solicitações resolvidas ficam visíveis como seção colapsada "Ver estornos anteriores" — nunca deletadas.

---

## Métodos de Pagamento

| Método  | Reembolso Asaas | Comportamento |
|---------|-----------------|---------------|
| PIX     | Automático      | `estornarParcial()` chamado na aprovação |
| Cartão  | Automático      | `estornarParcial()` chamado na aprovação |
| Boleto  | Manual          | Sistema registra aprovação; admin processa no Asaas |

---

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/migrations/20260507_estorno_parcial_pedido.sql` | Novas tabelas + ALTER itens_pedido |
| `lib/pagamentos/types.ts` | Adicionar `estornarParcial` à interface |
| `lib/pagamentos/asaas.ts` | Implementar `estornarParcial` |
| `lib/pagamentos/mock.ts` | Implementar `estornarParcial` no mock |
| `app/actions/orders.ts` | `solicitarEstornoParcialAction` |
| `app/actions/admin.ts` | `aprovarEstornoParcialAction`, `negarEstornoParcialAction` |
| `app/(loja)/pedidos/` | UI do responsável — botão + painel inline |
| `app/(admin)/admin/pedidos/` | UI do admin — badge + card de aprovação |
| `types/database.ts` | Tipos para novas tabelas |
