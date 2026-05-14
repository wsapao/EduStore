# Estorno Parcial por Item — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o responsável solicite estorno de itens específicos de um pedido pago, e que o admin aprove ou negue com reembolso automático via Asaas (PIX/cartão) ou aviso manual (boleto).

**Architecture:** Nova tabela `pedido_estornos` + `pedido_estornos_itens` + campo `estornado_em` em `itens_pedido`. Server actions para solicitar (responsável) e aprovar/negar (admin). Dois client components: `EstornoParcialForm` (portal) e `EstornoAdminCard` (admin).

**Tech Stack:** Next.js 15 App Router, Supabase (Postgres + RLS), TypeScript, Asaas API

---

## File Map

| Ação | Arquivo |
|------|---------|
| CREATE | `supabase/migrations/20260507_estorno_parcial_pedido.sql` |
| MODIFY | `types/database.ts` |
| MODIFY | `lib/pagamentos/types.ts` |
| MODIFY | `lib/pagamentos/asaas.ts` |
| MODIFY | `lib/pagamentos/mock.ts` |
| MODIFY | `app/actions/orders.ts` |
| MODIFY | `app/actions/admin.ts` |
| CREATE | `app/(loja)/pedidos/EstornoParcialForm.tsx` |
| MODIFY | `app/(loja)/pedidos/page.tsx` |
| CREATE | `app/(admin)/admin/pedidos/EstornoAdminCard.tsx` |
| MODIFY | `app/(admin)/admin/pedidos/page.tsx` |

---

## Task 1: Migration — Banco de dados

**Files:**
- Create: `supabase/migrations/20260507_estorno_parcial_pedido.sql`

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- ── Solicitações de estorno parcial ──────────────────────────
CREATE TABLE pedido_estornos (
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
);

CREATE TABLE pedido_estornos_itens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estorno_id      uuid NOT NULL REFERENCES pedido_estornos(id) ON DELETE CASCADE,
  item_pedido_id  uuid NOT NULL REFERENCES itens_pedido(id),
  valor_item      numeric(10,2) NOT NULL
);

-- Rastrear quais itens foram estornados
ALTER TABLE itens_pedido ADD COLUMN IF NOT EXISTS estornado_em timestamptz;

-- Índices
CREATE INDEX idx_pedido_estornos_pedido     ON pedido_estornos(pedido_id);
CREATE INDEX idx_pedido_estornos_responsavel ON pedido_estornos(responsavel_id);
CREATE INDEX idx_pedido_estornos_status      ON pedido_estornos(status);
CREATE INDEX idx_pedido_estornos_itens_estorno ON pedido_estornos_itens(estorno_id);

-- RLS
ALTER TABLE pedido_estornos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_estornos_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pedido_estornos_responsavel_select"
  ON pedido_estornos FOR SELECT TO authenticated
  USING (responsavel_id = auth.uid());

CREATE POLICY "pedido_estornos_admin_all"
  ON pedido_estornos FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "pedido_estornos_itens_responsavel_select"
  ON pedido_estornos_itens FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pedido_estornos e
      WHERE e.id = estorno_id
      AND e.responsavel_id = auth.uid()
    )
  );

CREATE POLICY "pedido_estornos_itens_admin_all"
  ON pedido_estornos_itens FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
```

- [ ] **Step 2: Aplicar a migration no Supabase**

Via MCP Supabase (`apply_migration`) com `project_id = rstsomdurwksoqxbypty` e `name = estorno_parcial_pedido`, ou via CLI:
```bash
supabase db push
```
Verificar que as tabelas foram criadas sem erro.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260507_estorno_parcial_pedido.sql
git commit -m "feat: migration tabelas de estorno parcial por item"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `types/database.ts`
- Modify: `lib/pagamentos/types.ts`

- [ ] **Step 1: Adicionar tipos em `types/database.ts`**

Adicionar após a interface `Pagamento` (linha ~151):

```typescript
export type StatusEstorno = 'pendente' | 'aprovado' | 'negado'

export interface PedidoEstorno {
  id: string
  pedido_id: string
  responsavel_id: string
  status: StatusEstorno
  motivo: string
  obs_admin: string | null
  valor_total: number
  created_at: string
  resolvido_em: string | null
}

export interface PedidoEstornoItem {
  id: string
  estorno_id: string
  item_pedido_id: string
  valor_item: number
}
```

Atualizar `ItemPedido` para incluir o campo novo:

```typescript
export interface ItemPedido {
  id: string
  pedido_id: string
  produto_id: string
  aluno_id: string
  variante_id?: string | null
  variante: string | null
  preco_unitario: number
  estornado_em: string | null   // ← adicionar esta linha
  created_at: string
}
```

- [ ] **Step 2: Adicionar `estornarParcial` à interface em `lib/pagamentos/types.ts`**

Substituir o bloco `GatewayPagamento` (linhas 78-83):

```typescript
export interface GatewayPagamento {
  criarPagamento(input: CriarPagamentoInput): Promise<ResultadoPagamento>
  consultarStatus(gateway_id: string): Promise<'aguardando' | 'confirmado' | 'falhou' | 'expirado' | 'reembolsado'>
  cancelarPagamento(gateway_id: string): Promise<void>
  estornarPagamento(gateway_id: string): Promise<void>
  estornarParcial(gateway_id: string, valor: number): Promise<void>
}
```

- [ ] **Step 3: Verificar que não há erros de tipo**

```bash
cd "Loja virtual/app" && npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add types/database.ts lib/pagamentos/types.ts
git commit -m "feat: tipos para estorno parcial por item"
```

---

## Task 3: Gateway — implementar `estornarParcial`

**Files:**
- Modify: `lib/pagamentos/asaas.ts` (linha ~325)
- Modify: `lib/pagamentos/mock.ts` (linha ~116)

- [ ] **Step 1: Implementar em `lib/pagamentos/asaas.ts`**

Adicionar o método após `estornarPagamento` (dentro de `return { ... }`):

```typescript
async estornarParcial(gateway_id: string, valor: number): Promise<void> {
  await asaasPost(`/payments/${gateway_id}/refund`, { value: valor }, apiKey)
},
```

- [ ] **Step 2: Implementar no mock `lib/pagamentos/mock.ts`**

Adicionar após `estornarPagamento`:

```typescript
async estornarParcial(gateway_id: string, valor: number) {
  void gateway_id
  void valor
},
```

- [ ] **Step 3: Verificar tipos**

```bash
cd "Loja virtual/app" && npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add lib/pagamentos/asaas.ts lib/pagamentos/mock.ts
git commit -m "feat: gateway estornarParcial para reembolso por valor"
```

---

## Task 4: Server Action — responsável solicita estorno

**Files:**
- Modify: `app/actions/orders.ts`

- [ ] **Step 1: Adicionar imports necessários no topo de `orders.ts`**

Verificar que existem, senão adicionar:

```typescript
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
```

- [ ] **Step 2: Adicionar `solicitarEstornoParcialAction` ao final de `app/actions/orders.ts`**

```typescript
export async function solicitarEstornoParcialAction(
  pedidoId: string,
  itemIds: string[],
  motivo: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }
  if (!motivo.trim()) return { error: 'Motivo é obrigatório.' }
  if (!itemIds.length) return { error: 'Selecione ao menos um item.' }

  // Verificar que o pedido é do usuário e está pago
  const { data: pedido } = await supabase
    .from('pedidos')
    .select('id, status')
    .eq('id', pedidoId)
    .eq('responsavel_id', user.id)
    .single()

  if (!pedido) return { error: 'Pedido não encontrado.' }
  if (pedido.status !== 'pago') return { error: 'Só é possível solicitar estorno em pedidos pagos.' }

  const adminClient = createAdminClient()

  // Verificar que não há solicitação pendente
  const { data: pendente } = await adminClient
    .from('pedido_estornos')
    .select('id')
    .eq('pedido_id', pedidoId)
    .eq('status', 'pendente')
    .maybeSingle()

  if (pendente) return { error: 'Já existe uma solicitação de estorno pendente para este pedido.' }

  // Verificar que os itens pertencem ao pedido e não foram estornados
  const { data: itens } = await adminClient
    .from('itens_pedido')
    .select('id, preco_unitario, estornado_em')
    .eq('pedido_id', pedidoId)
    .in('id', itemIds)

  if (!itens || itens.length !== itemIds.length)
    return { error: 'Um ou mais itens não pertencem a este pedido.' }

  const itemJaEstornado = itens.find(i => i.estornado_em !== null)
  if (itemJaEstornado) return { error: 'Um ou mais itens já foram estornados.' }

  const valorTotal = itens.reduce((s, i) => s + Number(i.preco_unitario), 0)

  // Criar solicitação
  const { data: estorno, error: errEstorno } = await adminClient
    .from('pedido_estornos')
    .insert({
      pedido_id: pedidoId,
      responsavel_id: user.id,
      motivo: motivo.trim(),
      valor_total: valorTotal,
    })
    .select('id')
    .single()

  if (errEstorno || !estorno) return { error: errEstorno?.message ?? 'Erro ao criar solicitação.' }

  const { error: errItens } = await adminClient
    .from('pedido_estornos_itens')
    .insert(itens.map(i => ({
      estorno_id: estorno.id,
      item_pedido_id: i.id,
      valor_item: Number(i.preco_unitario),
    })))

  if (errItens) {
    await adminClient.from('pedido_estornos').delete().eq('id', estorno.id)
    return { error: errItens.message }
  }

  revalidatePath('/pedidos')
  return { success: true }
}
```

- [ ] **Step 3: Verificar tipos**

```bash
cd "Loja virtual/app" && npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add app/actions/orders.ts
git commit -m "feat: solicitarEstornoParcialAction para responsável"
```

---

## Task 5: Server Actions — admin aprova e nega

**Files:**
- Modify: `app/actions/admin.ts`

- [ ] **Step 1: Adicionar `aprovarEstornoParcialAction` em `app/actions/admin.ts`**

Adicionar ao final do arquivo:

```typescript
// ── Aprovar estorno parcial (admin) ──────────────────────────
export async function aprovarEstornoParcialAction(
  estornoId: string,
): Promise<{ success: true } | { error: string }> {
  const { user } = await verificarAdmin()
  const adminClient = createAdminClient()

  function firstOf<T>(v: T | T[] | null | undefined): T | null {
    return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
  }

  const { data: estorno } = await adminClient
    .from('pedido_estornos')
    .select(`
      id, pedido_id, status, valor_total,
      itens:pedido_estornos_itens(item_pedido_id),
      pedido:pedidos!pedido_id(pagamento:pagamentos(gateway_id, metodo))
    `)
    .eq('id', estornoId)
    .single()

  if (!estorno) return { error: 'Solicitação não encontrada.' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((estorno as any).status !== 'pendente') return { error: 'Solicitação não está pendente.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pedido = firstOf((estorno as any).pedido)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pagamento = firstOf((pedido as any)?.pagamento)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metodo = (pagamento as any)?.metodo as string | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gatewayId = (pagamento as any)?.gateway_id as string | null

  // Chamar Asaas se PIX ou cartão
  if (metodo !== 'boleto' && gatewayId) {
    try {
      const { getGateway } = await import('@/lib/pagamentos/gateway')
      const gateway = getGateway()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await gateway.estornarParcial(gatewayId, Number((estorno as any).valor_total))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { error: `Falha no gateway: ${msg}` }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itemIds = ((estorno as any).itens as { item_pedido_id: string }[]).map(i => i.item_pedido_id)

  // Marcar itens como estornados
  const { error: errItems } = await adminClient
    .from('itens_pedido')
    .update({ estornado_em: new Date().toISOString() })
    .in('id', itemIds)

  if (errItems) return { error: errItems.message }

  // Restaurar estoque para itens com variante
  const { data: itensComVariante } = await adminClient
    .from('itens_pedido')
    .select('variante_id')
    .in('id', itemIds)
    .not('variante_id', 'is', null)

  for (const item of itensComVariante ?? []) {
    if (item.variante_id) {
      await adminClient.rpc('restaurar_estoque_variante', { p_variante_id: item.variante_id })
    }
  }

  // Atualizar estorno → aprovado
  const { error: errEstorno } = await adminClient
    .from('pedido_estornos')
    .update({ status: 'aprovado', resolvido_em: new Date().toISOString() })
    .eq('id', estornoId)

  if (errEstorno) return { error: errEstorno.message }

  // Se todos os itens do pedido estão estornados → pedido reembolsado
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: todosItens } = await adminClient
    .from('itens_pedido')
    .select('id, estornado_em')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .eq('pedido_id', (estorno as any).pedido_id)

  const todosEstornados = (todosItens ?? []).every(i => i.estornado_em !== null)
  if (todosEstornados) {
    await adminClient
      .from('pedidos')
      .update({ status: 'reembolsado' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .eq('id', (estorno as any).pedido_id)
  }

  void user
  revalidatePath('/admin/pedidos')
  revalidatePath('/pedidos')
  return { success: true }
}

// ── Negar estorno parcial (admin) ─────────────────────────────
export async function negarEstornoParcialAction(
  estornoId: string,
  obs_admin: string,
): Promise<{ success: true } | { error: string }> {
  await verificarAdmin()
  if (!obs_admin.trim()) return { error: 'Observação é obrigatória ao negar.' }

  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from('pedido_estornos')
    .update({
      status: 'negado',
      obs_admin: obs_admin.trim(),
      resolvido_em: new Date().toISOString(),
    })
    .eq('id', estornoId)
    .eq('status', 'pendente')

  if (error) return { error: error.message }

  revalidatePath('/admin/pedidos')
  revalidatePath('/pedidos')
  return { success: true }
}
```

- [ ] **Step 2: Verificar se `getGateway` em `lib/pagamentos/gateway.ts` aceita chamada sem argumento**

Abrir `lib/pagamentos/gateway.ts` e verificar a assinatura de `getGateway`. Se receber um argumento obrigatório (ex: `'cantina'`), ajustar a chamada acima para `getGateway()` → `getGateway('loja')` conforme necessário.

- [ ] **Step 3: Verificar tipos**

```bash
cd "Loja virtual/app" && npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add app/actions/admin.ts
git commit -m "feat: aprovarEstornoParcialAction e negarEstornoParcialAction"
```

---

## Task 6: Client Component — `EstornoParcialForm` (portal do responsável)

**Files:**
- Create: `app/(loja)/pedidos/EstornoParcialForm.tsx`

- [ ] **Step 1: Criar o componente**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { solicitarEstornoParcialAction } from '@/app/actions/orders'

interface ItemEstorno {
  id: string
  produto_nome: string
  aluno_nome: string
  variante: string | null
  preco_unitario: number
  estornado_em: string | null
}

interface EstornoInfo {
  id: string
  status: 'pendente' | 'aprovado' | 'negado'
  motivo: string
  obs_admin: string | null
  valor_total: number
}

interface Props {
  pedidoId: string
  itens: ItemEstorno[]
  estorno: EstornoInfo | null
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function EstornoParcialForm({ pedidoId, itens, estorno }: Props) {
  const [aberto, setAberto] = useState(false)
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const valorTotal = itens
    .filter(i => selecionados.includes(i.id))
    .reduce((s, i) => s + i.preco_unitario, 0)

  function toggleItem(id: string) {
    setSelecionados(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function submeter() {
    if (!selecionados.length) { setErro('Selecione ao menos um item.'); return }
    if (!motivo.trim()) { setErro('Informe o motivo.'); return }
    setErro(null)
    startTransition(async () => {
      const res = await solicitarEstornoParcialAction(pedidoId, selecionados, motivo)
      if ('error' in res) {
        setErro(res.error)
      } else {
        setAberto(false)
        setSelecionados([])
        setMotivo('')
      }
    })
  }

  // Estorno existente
  if (estorno) {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      pendente: { bg: '#fef3c7', text: '#92400e', label: `⏳ Estorno aguardando análise — ${fmtBRL(estorno.valor_total)}` },
      aprovado: { bg: '#d1fae5', text: '#065f46', label: `✅ Estorno aprovado — ${fmtBRL(estorno.valor_total)}` },
      negado:   { bg: '#fee2e2', text: '#991b1b', label: `❌ Estorno negado${estorno.obs_admin ? ` — ${estorno.obs_admin}` : ''}` },
    }
    const cfg = badges[estorno.status]
    if (cfg) {
      return (
        <div style={{ marginTop: 8, padding: '8px 12px', background: cfg.bg, borderRadius: 8, fontSize: 12, color: cfg.text, fontWeight: 600 }}>
          {cfg.label}
        </div>
      )
    }
  }

  const itensDisponiveis = itens.filter(i => !i.estornado_em)
  if (!itensDisponiveis.length) return null

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        style={{
          marginTop: 8, padding: '8px 14px', borderRadius: 8, width: '100%',
          background: 'rgba(239,68,68,0.06)', border: '1.5px solid rgba(239,68,68,0.15)',
          color: '#dc2626', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}
      >
        Solicitar estorno
      </button>
    )
  }

  return (
    <div style={{
      marginTop: 8, padding: '14px', background: '#fafafa',
      border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: 12,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0a1628', marginBottom: 10 }}>
        Selecione os itens para estorno
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {itens.map(item => (
          <label
            key={item.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              cursor: item.estornado_em ? 'default' : 'pointer',
              opacity: item.estornado_em ? 0.45 : 1,
              fontSize: 12, color: '#374151',
            }}
          >
            <input
              type="checkbox"
              checked={selecionados.includes(item.id)}
              disabled={!!item.estornado_em}
              onChange={() => toggleItem(item.id)}
            />
            <span style={{ flex: 1 }}>
              {item.produto_nome} — {item.aluno_nome}
              {item.variante ? ` (${item.variante})` : ''}
              {item.estornado_em ? ' · Já estornado' : ''}
            </span>
            <span style={{ fontWeight: 700 }}>{fmtBRL(item.preco_unitario)}</span>
          </label>
        ))}
      </div>

      {selecionados.length > 0 && (
        <div style={{ fontSize: 12, fontWeight: 800, color: '#0a1628', marginBottom: 8 }}>
          Total a reembolsar: {fmtBRL(valorTotal)}
        </div>
      )}

      <textarea
        placeholder="Motivo do estorno (obrigatório)"
        value={motivo}
        onChange={e => setMotivo(e.target.value)}
        rows={2}
        style={{
          width: '100%', borderRadius: 8, border: '1.5px solid rgba(0,0,0,0.1)',
          padding: '8px', fontSize: 12, fontFamily: 'inherit',
          boxSizing: 'border-box', resize: 'vertical', marginBottom: 8,
        }}
      />

      {erro && (
        <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 8 }}>{erro}</div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={submeter}
          disabled={pending}
          style={{
            flex: 1, padding: '9px', borderRadius: 8,
            background: '#ef4444', color: '#fff', border: 'none',
            fontSize: 12, fontWeight: 700,
            cursor: pending ? 'not-allowed' : 'pointer',
            opacity: pending ? 0.7 : 1,
          }}
        >
          {pending ? 'Enviando…' : 'Enviar solicitação'}
        </button>
        <button
          onClick={() => { setAberto(false); setSelecionados([]); setMotivo(''); setErro(null) }}
          disabled={pending}
          style={{
            padding: '9px 14px', borderRadius: 8,
            background: 'transparent', border: '1.5px solid rgba(0,0,0,0.1)',
            color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

```bash
cd "Loja virtual/app" && npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "app/(loja)/pedidos/EstornoParcialForm.tsx"
git commit -m "feat: componente EstornoParcialForm para portal do responsável"
```

---

## Task 7: Atualizar página de pedidos do responsável

**Files:**
- Modify: `app/(loja)/pedidos/page.tsx`

- [ ] **Step 1: Adicionar import de `EstornoParcialForm` e `PedidoEstorno` no topo**

```typescript
import { EstornoParcialForm } from './EstornoParcialForm'
import type { PedidoEstorno } from '@/types/database'
```

- [ ] **Step 2: Buscar estornos do usuário após a query de pedidos**

Adicionar após a linha `const todosPedidos: PedidoLista[] = ...`:

```typescript
// Buscar estornos mais recentes de cada pedido
const pedidoIds = todosPedidos.map(p => p.id)
const { data: estornosRaw } = pedidoIds.length
  ? await supabase
      .from('pedido_estornos')
      .select('id, pedido_id, status, motivo, obs_admin, valor_total, created_at')
      .in('pedido_id', pedidoIds)
      .order('created_at', { ascending: false })
  : { data: [] }

// Mapa: pedido_id → estorno mais recente
const estornoByPedidoId = ((estornosRaw ?? []) as PedidoEstorno[]).reduce<Record<string, PedidoEstorno>>(
  (acc, e) => { if (!acc[e.pedido_id]) acc[e.pedido_id] = e; return acc },
  {}
)
```

- [ ] **Step 3: Atualizar o JSX para envolver o card de cada pedido pago**

Localizar o bloco `{pedidos.map((pedido) => {` e substituir o retorno do pedido de:
```jsx
return (
  <Link href={`/pedido/${pedido.id}`} key={pedido.id} style={{ ... }}>
    {/* conteúdo */}
  </Link>
)
```
para:
```jsx
return (
  <div key={pedido.id}>
    <Link
      href={`/pedido/${pedido.id}`}
      style={{
        background: 'white', border: '1.5px solid rgba(0,0,0,.07)', borderRadius: 18,
        overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.06)', display: 'block', textDecoration: 'none'
      }}
    >
      {/* todo o conteúdo interno do card — sem alteração */}
    </Link>

    {isPago && (
      <EstornoParcialForm
        pedidoId={pedido.id}
        itens={pedido.itens.map(i => ({
          id: i.id,
          produto_nome: (i.produto as any)?.nome ?? '—',
          aluno_nome: i.aluno?.nome ?? '—',
          variante: i.variante,
          preco_unitario: Number(i.preco_unitario),
          estornado_em: (i as any).estornado_em ?? null,
        }))}
        estorno={estornoByPedidoId[pedido.id]
          ? {
              id: estornoByPedidoId[pedido.id].id,
              status: estornoByPedidoId[pedido.id].status,
              motivo: estornoByPedidoId[pedido.id].motivo,
              obs_admin: estornoByPedidoId[pedido.id].obs_admin,
              valor_total: Number(estornoByPedidoId[pedido.id].valor_total),
            }
          : null
        }
      />
    )}
  </div>
)
```

- [ ] **Step 4: Verificar tipos**

```bash
cd "Loja virtual/app" && npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add "app/(loja)/pedidos/page.tsx"
git commit -m "feat: botão solicitar estorno na página de pedidos do responsável"
```

---

## Task 8: Client Component — `EstornoAdminCard` (painel admin)

**Files:**
- Create: `app/(admin)/admin/pedidos/EstornoAdminCard.tsx`

- [ ] **Step 1: Criar o componente**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { aprovarEstornoParcialAction, negarEstornoParcialAction } from '@/app/actions/admin'

interface ItemEstornoAdmin {
  item_pedido_id: string
  valor_item: number
  produto_nome: string
  aluno_nome: string
  variante: string | null
}

interface Props {
  estorno: {
    id: string
    pedido_id: string
    motivo: string
    valor_total: number
    created_at: string
    itens: ItemEstornoAdmin[]
  }
  metodoPagamento: string | null
}

function fmtBRL(v: number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function EstornoAdminCard({ estorno, metodoPagamento }: Props) {
  const [modo, setModo] = useState<'idle' | 'confirmar' | 'negar'>('idle')
  const [obsNegacao, setObsNegacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function executarAprovacao() {
    startTransition(async () => {
      const res = await aprovarEstornoParcialAction(estorno.id)
      if ('error' in res) { setErro(res.error); setModo('idle') }
    })
  }

  function executarNegacao() {
    if (!obsNegacao.trim()) { setErro('Informe o motivo da negação.'); return }
    setErro(null)
    startTransition(async () => {
      const res = await negarEstornoParcialAction(estorno.id, obsNegacao)
      if ('error' in res) setErro(res.error)
    })
  }

  const metodoLabel = metodoPagamento === 'pix' ? 'PIX' : metodoPagamento === 'cartao' ? 'Cartão' : 'Boleto'

  return (
    <div style={{
      marginTop: 10, padding: '12px 14px',
      background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
      borderRadius: 8,
    }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#fcd34d', marginBottom: 6 }}>
        ⚠️ Solicitação de estorno — {fmtData(estorno.created_at)}
      </div>

      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
        <strong style={{ color: '#f1f5f9' }}>Motivo:</strong> {estorno.motivo}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
        {estorno.itens.map(item => (
          <div
            key={item.item_pedido_id}
            style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}
          >
            <span>
              {item.produto_nome} — {item.aluno_nome}
              {item.variante ? ` (${item.variante})` : ''}
            </span>
            <span style={{ fontWeight: 700 }}>{fmtBRL(item.valor_item)}</span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 10 }}>
        Total: {fmtBRL(estorno.valor_total)}
      </div>

      {metodoPagamento === 'boleto' && (
        <div style={{
          fontSize: 11, color: '#fbbf24', padding: '6px 8px',
          background: 'rgba(245,158,11,0.1)', borderRadius: 6, marginBottom: 10,
        }}>
          📄 Pedido pago com boleto. Processe o reembolso manualmente no Asaas antes de aprovar.
        </div>
      )}

      {erro && (
        <div style={{ fontSize: 12, color: '#f87171', marginBottom: 8 }}>{erro}</div>
      )}

      {modo === 'idle' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setModo('confirmar')}
            style={{
              padding: '7px 14px', borderRadius: 7,
              background: 'rgba(16,185,129,0.15)', color: '#34d399',
              border: '1px solid rgba(16,185,129,0.3)',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            ✓ Aprovar estorno
          </button>
          <button
            onClick={() => setModo('negar')}
            style={{
              padding: '7px 14px', borderRadius: 7,
              background: 'rgba(239,68,68,0.1)', color: '#f87171',
              border: '1px solid rgba(239,68,68,0.2)',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            ✕ Negar
          </button>
        </div>
      )}

      {modo === 'confirmar' && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', marginBottom: 8 }}>
            Reembolsar {fmtBRL(estorno.valor_total)} via {metodoLabel}?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={executarAprovacao}
              disabled={pending}
              style={{
                padding: '7px 14px', borderRadius: 7,
                background: '#10b981', color: '#fff', border: 'none',
                fontSize: 12, fontWeight: 700,
                cursor: pending ? 'not-allowed' : 'pointer',
                opacity: pending ? 0.7 : 1,
              }}
            >
              {pending ? 'Processando…' : 'Confirmar'}
            </button>
            <button
              onClick={() => setModo('idle')}
              disabled={pending}
              style={{
                padding: '7px 14px', borderRadius: 7,
                background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Voltar
            </button>
          </div>
        </div>
      )}

      {modo === 'negar' && (
        <div>
          <textarea
            placeholder="Motivo da negação (obrigatório)"
            value={obsNegacao}
            onChange={e => setObsNegacao(e.target.value)}
            rows={2}
            style={{
              width: '100%', borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(0,0,0,0.2)', padding: '8px',
              fontSize: 12, color: '#fff', fontFamily: 'inherit',
              boxSizing: 'border-box', resize: 'vertical', marginBottom: 8,
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={executarNegacao}
              disabled={pending}
              style={{
                padding: '7px 14px', borderRadius: 7,
                background: '#dc2626', color: '#fff', border: 'none',
                fontSize: 12, fontWeight: 700,
                cursor: pending ? 'not-allowed' : 'pointer',
                opacity: pending ? 0.7 : 1,
              }}
            >
              {pending ? 'Negando…' : 'Confirmar negação'}
            </button>
            <button
              onClick={() => { setModo('idle'); setObsNegacao(''); setErro(null) }}
              disabled={pending}
              style={{
                padding: '7px 14px', borderRadius: 7,
                background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Voltar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

```bash
cd "Loja virtual/app" && npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/admin/pedidos/EstornoAdminCard.tsx"
git commit -m "feat: componente EstornoAdminCard para painel admin"
```

---

## Task 9: Atualizar página de pedidos do admin

**Files:**
- Modify: `app/(admin)/admin/pedidos/page.tsx`

- [ ] **Step 1: Adicionar import de `EstornoAdminCard` e `createAdminClient`**

No topo do arquivo, adicionar:

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { EstornoAdminCard } from './EstornoAdminCard'
```

- [ ] **Step 2: Buscar estornos pendentes para os pedidos da página atual**

Adicionar após `const pedidos: PedidoAdminNormalizado[] = ...`:

```typescript
// Buscar estornos pendentes para os pedidos desta página
const pedidoIdsPage = pedidos.map(p => p.id)
const adminClient = createAdminClient()

const { data: estornosPendentesRaw } = pedidoIdsPage.length
  ? await adminClient
      .from('pedido_estornos')
      .select('id, pedido_id, motivo, valor_total, created_at, itens:pedido_estornos_itens(item_pedido_id, valor_item)')
      .in('pedido_id', pedidoIdsPage)
      .eq('status', 'pendente')
  : { data: [] }

// Mapa de detalhes dos itens já carregados nos pedidos
const itemDetailsMap = pedidos.flatMap(p => p.itens).reduce<Record<string, { produto_nome: string; aluno_nome: string; variante: string | null }>>(
  (acc, item) => {
    acc[item.id] = {
      produto_nome: item.produto?.nome ?? '—',
      aluno_nome: item.aluno?.nome ?? '—',
      variante: item.variante,
    }
    return acc
  },
  {}
)

// Enriquecer itens do estorno com nomes de produto/aluno
const estornoByPedidoId = ((estornosPendentesRaw ?? []) as any[]).reduce<Record<string, any>>(
  (acc, e) => {
    acc[e.pedido_id] = {
      ...e,
      itens: (e.itens ?? []).map((i: any) => ({
        ...i,
        ...(itemDetailsMap[i.item_pedido_id] ?? { produto_nome: '—', aluno_nome: '—', variante: null }),
      })),
    }
    return acc
  },
  {}
)
```

- [ ] **Step 3: Adicionar badge "Estorno pendente" na listagem e o `EstornoAdminCard` em cada pedido**

Localizar o bloco onde o status badge é renderizado (linha ~291):
```jsx
<span style={{ display: 'inline-flex', alignItems: 'center', ... }}>
  {statusCfg.label}
</span>
```

Logo após esse `<span>`, adicionar:
```jsx
{estornoByPedidoId[p.id] && (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700,
    background: 'rgba(245,158,11,0.15)', color: '#fcd34d',
    border: '1px solid rgba(245,158,11,0.3)',
  }}>
    ⚠️ Estorno pendente
  </span>
)}
```

Localizar o fechamento do card de cada pedido (o `</div>` que fecha o container do pedido, antes do `{pagamento?.pix_tx_id &&`) e adicionar o card de estorno no bloco de ações, após a div de total:

Localizar (linha ~379):
```jsx
<div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,.05)', ... }}>
```

Dentro desse div, após os botões de ação existentes, adicionar:
```jsx
{estornoByPedidoId[p.id] && (
  <EstornoAdminCard
    estorno={estornoByPedidoId[p.id]}
    metodoPagamento={p.metodo_pagamento}
  />
)}
```

- [ ] **Step 4: Verificar tipos**

```bash
cd "Loja virtual/app" && npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/admin/pedidos/page.tsx"
git commit -m "feat: badge e card de estorno pendente na página admin de pedidos"
```

---

## Task 10: Push e verificação final

- [ ] **Step 1: Push para Vercel**

```bash
git push
```

- [ ] **Step 2: Testar fluxo completo em localhost**

1. Logar como responsável → Meus Pedidos → Pedido pago → clicar "Solicitar estorno"
2. Selecionar um item, informar motivo, enviar
3. Verificar badge "⏳ Estorno aguardando análise" aparece
4. Logar como admin → Pedidos → Ver badge amarelo "Estorno pendente"
5. Aprovar → verificar que `itens_pedido.estornado_em` foi preenchido no banco
6. Logar como responsável → verificar badge "✅ Estorno aprovado"

- [ ] **Step 3: Testar negação**

1. Criar nova solicitação como responsável
2. Admin nega com observação
3. Responsável vê "❌ Estorno negado — [obs]"

- [ ] **Step 4: Verificar que pedido vai para `reembolsado` quando todos os itens são estornados**

Usando Supabase MCP:
```sql
SELECT p.id, p.status, COUNT(i.id) total_itens, COUNT(i.estornado_em) estornados
FROM pedidos p
JOIN itens_pedido i ON i.pedido_id = p.id
GROUP BY p.id, p.status
HAVING COUNT(i.id) = COUNT(i.estornado_em);
```
Verificar que os pedidos retornados têm `status = 'reembolsado'`.
