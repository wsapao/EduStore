# Relatório de Compras por Produto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aba "Compras" em `/admin/relatorio` listando compradores de qualquer produto, com filtros (série/turma/status), seleção de colunas e export CSV.

**Architecture:** Nova RPC `get_relatorio_compras` (service-role only) alimenta a página server-side do grupo `(admin)`, que ganha duas abas via `?tab=`. Filtros, seleção de colunas e CSV são client-side num módulo puro testável (`lib/relatorio/compras.ts`). A RPC existente `get_relatorio_presenca` entra no mesmo lockdown e seu caller migra para o admin client.

**Tech Stack:** Next.js App Router (server components + client components com inline styles), Supabase (RPC SECURITY DEFINER, migrations em `supabase/migrations/`, aplicação em prod via MCP), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-10-relatorio-compras-design.md`

---

### Task 1: Módulo puro `lib/relatorio/compras.ts` (TDD)

**Files:**
- Create: `lib/relatorio/compras.ts`
- Test: `tests/lib/relatorio-compras.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/lib/relatorio-compras.test.ts
import { describe, it, expect } from 'vitest'
import {
  COLUNAS_COMPRAS,
  filtrarCompras,
  resumoCompras,
  formatarDataHora,
  formatarValor,
  montarCsvCompras,
  type CompraRow,
  type FiltrosCompras,
} from '@/lib/relatorio/compras'

function row(overrides: Partial<CompraRow> = {}): CompraRow {
  return {
    item_id: 'i1',
    aluno_nome: 'Maria Silva',
    aluno_serie: '6º Ano',
    aluno_turma: 'A',
    responsavel_nome: 'João Silva',
    responsavel_email: 'joao@example.com',
    responsavel_telefone: '81999990000',
    variante: null,
    pedido_numero: 'PED-2026-000001',
    pedido_status: 'pago',
    data_pagamento: '2026-07-01T13:00:00+00:00',
    preco_unitario: 115,
    estornado: false,
    ...overrides,
  }
}

const FILTRO_PADRAO: FiltrosCompras = {
  serie: null,
  turma: null,
  status: 'pago',
  incluirEstornados: false,
}

describe('filtrarCompras', () => {
  it('mantém só pagos não estornados por padrão', () => {
    const rows = [
      row({ item_id: 'a' }),
      row({ item_id: 'b', pedido_status: 'pendente' }),
      row({ item_id: 'c', pedido_status: 'cancelado' }),
      row({ item_id: 'd', estornado: true }),
    ]
    expect(filtrarCompras(rows, FILTRO_PADRAO).map(r => r.item_id)).toEqual(['a'])
  })

  it('inclui estornados quando incluirEstornados=true', () => {
    const rows = [row({ item_id: 'a' }), row({ item_id: 'd', estornado: true })]
    const out = filtrarCompras(rows, { ...FILTRO_PADRAO, incluirEstornados: true })
    expect(out.map(r => r.item_id)).toEqual(['a', 'd'])
  })

  it('status=todos devolve todos os status', () => {
    const rows = [
      row({ item_id: 'a' }),
      row({ item_id: 'b', pedido_status: 'pendente' }),
      row({ item_id: 'c', pedido_status: 'cancelado' }),
    ]
    const out = filtrarCompras(rows, { ...FILTRO_PADRAO, status: 'todos' })
    expect(out).toHaveLength(3)
  })

  it('filtra por série e turma combinadas', () => {
    const rows = [
      row({ item_id: 'a', aluno_serie: '6º Ano', aluno_turma: 'A' }),
      row({ item_id: 'b', aluno_serie: '6º Ano', aluno_turma: 'B' }),
      row({ item_id: 'c', aluno_serie: '7º Ano', aluno_turma: 'A' }),
    ]
    const out = filtrarCompras(rows, { ...FILTRO_PADRAO, serie: '6º Ano', turma: 'A' })
    expect(out.map(r => r.item_id)).toEqual(['a'])
  })
})

describe('resumoCompras', () => {
  it('soma quantidade e valor', () => {
    const rows = [row(), row({ item_id: 'i2', preco_unitario: 10.5 })]
    expect(resumoCompras(rows)).toEqual({ qtd: 2, total: 125.5 })
  })

  it('lida com preco vindo como string do PostgREST', () => {
    const rows = [row({ preco_unitario: '115.00' as unknown as number })]
    expect(resumoCompras(rows)).toEqual({ qtd: 1, total: 115 })
  })
})

describe('formatarDataHora', () => {
  it('formata em pt-BR no fuso de Recife', () => {
    expect(formatarDataHora('2026-07-01T13:00:00+00:00')).toBe('01/07/26 10:00')
  })

  it('devolve travessão para null', () => {
    expect(formatarDataHora(null)).toBe('—')
  })
})

describe('formatarValor', () => {
  it('usa vírgula decimal com 2 casas', () => {
    expect(formatarValor(115)).toBe('115,00')
    expect(formatarValor('99.9' as unknown as number)).toBe('99,90')
  })
})

describe('montarCsvCompras', () => {
  it('gera header e linhas só das colunas escolhidas', () => {
    const csv = montarCsvCompras([row()], ['aluno_nome', 'aluno_serie', 'preco_unitario'])
    const linhas = csv.split('\n')
    expect(linhas[0]).toBe('Aluno,Série,Valor')
    expect(linhas[1]).toBe('"Maria Silva","6º Ano","115,00"')
  })

  it('escapa aspas duplas e trata nulos', () => {
    const csv = montarCsvCompras(
      [row({ aluno_nome: 'Ana "Aninha" Souza', aluno_turma: null })],
      ['aluno_nome', 'aluno_turma'],
    )
    expect(csv.split('\n')[1]).toBe('"Ana ""Aninha"" Souza",""')
  })

  it('formata data de pagamento na coluna', () => {
    const csv = montarCsvCompras([row()], ['pedido_numero', 'data_pagamento'])
    expect(csv.split('\n')[1]).toBe('"PED-2026-000001","01/07/26 10:00"')
  })

  it('toda coluna declarada em COLUNAS_COMPRAS é exportável sem erro', () => {
    const todas = COLUNAS_COMPRAS.map(c => c.key)
    const csv = montarCsvCompras([row()], todas)
    expect(csv.split('\n')[0].split(',')).toHaveLength(todas.length)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/relatorio-compras.test.ts`
Expected: FAIL — `Cannot find module '@/lib/relatorio/compras'` (ou equivalente).

- [ ] **Step 3: Write the implementation**

```ts
// lib/relatorio/compras.ts
// Lógica pura do relatório de compras por produto (aba "Compras" do admin).
// Mantida sem dependências de React/Supabase para ser testável em unidade.

export interface CompraRow {
  item_id: string
  aluno_nome: string | null
  aluno_serie: string | null
  aluno_turma: string | null
  responsavel_nome: string | null
  responsavel_email: string | null
  responsavel_telefone: string | null
  variante: string | null
  pedido_numero: string
  pedido_status: string
  data_pagamento: string | null
  preco_unitario: number
  estornado: boolean
}

export type StatusFiltro = 'pago' | 'pendente' | 'cancelado' | 'todos'

export interface FiltrosCompras {
  serie: string | null
  turma: string | null
  status: StatusFiltro
  incluirEstornados: boolean
}

export const COLUNAS_COMPRAS = [
  { key: 'aluno_nome', label: 'Aluno' },
  { key: 'aluno_serie', label: 'Série' },
  { key: 'aluno_turma', label: 'Turma' },
  { key: 'responsavel_nome', label: 'Responsável' },
  { key: 'responsavel_email', label: 'E-mail' },
  { key: 'responsavel_telefone', label: 'Telefone' },
  { key: 'variante', label: 'Variante' },
  { key: 'pedido_numero', label: 'Pedido' },
  { key: 'pedido_status', label: 'Status' },
  { key: 'data_pagamento', label: 'Pago em' },
  { key: 'preco_unitario', label: 'Valor' },
] as const

export type ColunaKey = (typeof COLUNAS_COMPRAS)[number]['key']

export function filtrarCompras(rows: CompraRow[], f: FiltrosCompras): CompraRow[] {
  return rows.filter(r => {
    if (!f.incluirEstornados && r.estornado) return false
    if (f.status !== 'todos' && r.pedido_status !== f.status) return false
    if (f.serie && r.aluno_serie !== f.serie) return false
    if (f.turma && r.aluno_turma !== f.turma) return false
    return true
  })
}

export function resumoCompras(rows: CompraRow[]): { qtd: number; total: number } {
  return {
    qtd: rows.length,
    total: rows.reduce((acc, r) => acc + Number(r.preco_unitario), 0),
  }
}

export function formatarDataHora(iso: string | null, timeZone = 'America/Recife'): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', timeZone,
  }).replace(',', '')
}

export function formatarValor(valor: number): string {
  return Number(valor).toFixed(2).replace('.', ',')
}

function celula(row: CompraRow, key: ColunaKey): string {
  switch (key) {
    case 'data_pagamento': return row.data_pagamento ? formatarDataHora(row.data_pagamento) : ''
    case 'preco_unitario': return formatarValor(row.preco_unitario)
    default: return String(row[key] ?? '')
  }
}

export function montarCsvCompras(rows: CompraRow[], colunas: ColunaKey[]): string {
  const meta = COLUNAS_COMPRAS.filter(c => colunas.includes(c.key))
  const header = meta.map(c => c.label).join(',')
  const linhas = rows.map(r =>
    meta.map(c => `"${celula(r, c.key).replace(/"/g, '""')}"`).join(','),
  )
  return [header, ...linhas].join('\n')
}
```

Atenção ao detalhe do `formatarDataHora`: `toLocaleString('pt-BR')` em Node moderno devolve
`01/07/26, 10:00` (com vírgula) — o `.replace(',', '')` normaliza para `01/07/26 10:00`.
Se o teste do Step 4 falhar por diferença de formato exato, ajustar a implementação (nunca o
fuso do teste) até `formatarDataHora('2026-07-01T13:00:00+00:00') === '01/07/26 10:00'`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/relatorio-compras.test.ts`
Expected: PASS (12 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/relatorio/compras.ts tests/lib/relatorio-compras.test.ts
git commit -m "feat(admin): lógica pura do relatório de compras por produto"
```

---

### Task 2: Migration da RPC `get_relatorio_compras` + lockdown da de presença

**Files:**
- Create: `supabase/migrations/20260710_relatorio_compras_rpc.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================================
-- Relatório de Compras por Produto (aba "Compras" de /admin/relatorio).
--
-- get_relatorio_compras: itens de pedido de um produto com aluno, responsável
-- e dados do pedido. SECURITY DEFINER + EXECUTE restrito a service_role — o
-- caller é a página admin server-side via createAdminClient().
--
-- Aproveita para corrigir get_relatorio_presenca: ela ficou fora do lockdown
-- de 20260519_revoke_rpc_execute.sql e qualquer authenticated podia chamá-la
-- via POST /rest/v1/rpc/ e obter PII de alunos. Caller migrado p/ admin client.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_relatorio_compras(p_produto_id uuid)
RETURNS TABLE (
  item_id uuid,
  aluno_nome text,
  aluno_serie text,
  aluno_turma text,
  responsavel_nome text,
  responsavel_email text,
  responsavel_telefone text,
  variante text,
  pedido_numero text,
  pedido_status text,
  data_pagamento timestamptz,
  preco_unitario numeric,
  estornado boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT
    ip.id,
    a.nome,
    a.serie,
    a.turma,
    r.nome,
    r.email,
    r.telefone,
    ip.variante,
    p.numero,
    p.status,
    p.data_pagamento,
    ip.preco_unitario,
    (ip.estornado_em IS NOT NULL)
  FROM itens_pedido ip
  JOIN pedidos p        ON p.id = ip.pedido_id
  LEFT JOIN alunos a    ON a.id = ip.aluno_id
  LEFT JOIN responsaveis r ON r.id = p.responsavel_id
  WHERE ip.produto_id = p_produto_id
  ORDER BY a.serie, a.turma, a.nome, p.numero;
$$;

REVOKE ALL ON FUNCTION public.get_relatorio_compras(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_relatorio_compras(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_relatorio_presenca(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_relatorio_presenca(uuid) TO service_role;
```

- [ ] **Step 2: Apply to prod via Supabase MCP**

Aplicar com `mcp__...__apply_migration` no projeto `rstsomdurwksoqxbypty`, nome
`relatorio_compras_rpc`, com o SQL acima. (Canal SQL para este projeto é o MCP —
sem CLI/psql local.)

- [ ] **Step 3: Verify grants**

Via `execute_sql`:

```sql
SELECT p.proname,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_pode,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_pode
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('get_relatorio_compras', 'get_relatorio_presenca');
```

Expected: `auth_pode = false`, `service_pode = true` para as duas.

Sanity do retorno (deve trazer 46 linhas da Copa Tadeu, 42 pagas):

```sql
SELECT pedido_status, count(*) FROM get_relatorio_compras('5210e07b-d709-49b1-bc48-27f634ef8057') GROUP BY pedido_status;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260710_relatorio_compras_rpc.sql
git commit -m "feat(db): RPC get_relatorio_compras + lockdown de get_relatorio_presenca"
```

---

### Task 3: Página com abas + busca via admin client

**Files:**
- Modify: `app/(admin)/admin/relatorio/page.tsx` (arquivo inteiro substituído abaixo)

- [ ] **Step 1: Rewrite page.tsx**

```tsx
import { createAdminClient } from '@/lib/supabase/admin'
import { RelatorioClient } from './RelatorioClient'
import { ComprasClient } from './ComprasClient'
import { RelatorioTabs } from './RelatorioTabs'
import type { Produto } from '@/types/database'
import type { CompraRow } from '@/lib/relatorio/compras'

export default async function RelatorioPage({
  searchParams,
}: {
  searchParams: Promise<{ produto?: string; tab?: string }>
}) {
  const { produto: produtoId, tab: tabParam } = await searchParams
  const tab: 'presenca' | 'compras' = tabParam === 'compras' ? 'compras' : 'presenca'

  // RPCs e listagem via service role: as RPCs de relatório são service-role-only
  // (lockdown 20260710) e o acesso já é guardado pelo layout do grupo (admin).
  const admin = createAdminClient()

  const { data: produtos } = await admin
    .from('produtos')
    .select('*')
    .order('created_at', { ascending: false })

  const todos: Produto[] = (produtos ?? []) as Produto[]
  const lista = tab === 'presenca' ? todos.filter(p => p.gera_ingresso) : todos

  const produtoSelecionado = produtoId
    ? lista.find(p => p.id === produtoId) ?? lista[0] ?? null
    : lista[0] ?? null

  let relatorio: RelatorioRow[] = []
  let compras: CompraRow[] = []
  if (produtoSelecionado) {
    if (tab === 'presenca') {
      const { data } = await admin
        .rpc('get_relatorio_presenca', { p_produto_id: produtoSelecionado.id })
      relatorio = (data ?? []) as RelatorioRow[]
    } else {
      const { data } = await admin
        .rpc('get_relatorio_compras', { p_produto_id: produtoSelecionado.id })
      compras = (data ?? []) as CompraRow[]
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 100 }}>
      <RelatorioTabs tab={tab} />
      {tab === 'presenca' ? (
        <RelatorioClient
          produtos={lista}
          produtoSelecionado={produtoSelecionado}
          relatorio={relatorio}
        />
      ) : (
        <ComprasClient
          produtos={lista}
          produtoSelecionado={produtoSelecionado}
          compras={compras}
        />
      )}
    </div>
  )
}

export interface RelatorioRow {
  ingresso_id: string
  token: string
  status: string
  aluno_nome: string
  aluno_serie: string
  aluno_turma: string | null
  responsavel_nome: string
  responsavel_email: string
  usado_em: string | null
  validado_por: string | null
  created_at: string
}
```

Nota: `RelatorioClient` hoje embrulha tudo num `<div style={{ maxWidth: 900 ... }}>`;
esse wrapper sobe para a page (código acima). No Step 3 o wrapper interno do
`RelatorioClient` vira um `<div>` sem estilo (ou fragment) para não duplicar o limite
de largura — conferir visualmente pelo JSX (sem dev server).

- [ ] **Step 2: Create RelatorioTabs.tsx**

```tsx
// app/(admin)/admin/relatorio/RelatorioTabs.tsx
'use client'

import Link from 'next/link'

const TABS = [
  { key: 'presenca', label: '🎟️ Presença', href: '/admin/relatorio' },
  { key: 'compras',  label: '🛒 Compras',  href: '/admin/relatorio?tab=compras' },
] as const

export function RelatorioTabs({ tab }: { tab: 'presenca' | 'compras' }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
      {TABS.map(t => {
        const ativo = t.key === tab
        return (
          <Link
            key={t.key}
            href={t.href}
            style={{
              padding: '8px 18px', borderRadius: 999, fontSize: 13, fontWeight: 700,
              textDecoration: 'none',
              background: ativo ? 'var(--brand, #ea580c)' : 'var(--surface-2)',
              color: ativo ? '#fff' : 'var(--text-2)',
              border: ativo ? '1px solid transparent' : '1px solid var(--border)',
            }}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
```

(Conferir no `globals.css` qual é a variável de cor de destaque usada no admin — se não
houver `--brand`, usar a mesma cor de botão primário que o restante do admin usa.)

- [ ] **Step 3: Remove wrapper duplicado do RelatorioClient**

Em `app/(admin)/admin/relatorio/RelatorioClient.tsx`, trocar o container raiz
`<div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 100 }}>` por `<div>`
(o wrapper agora vive na page).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: erro apenas de `ComprasClient` inexistente (criado na Task 4). Se preferir zero
erro, criar na Task 4 antes de rodar. Sem outros erros novos.

- [ ] **Step 5: Commit** (pode ser junto com a Task 4 se o typecheck exigir)

```bash
git add "app/(admin)/admin/relatorio/page.tsx" "app/(admin)/admin/relatorio/RelatorioTabs.tsx" "app/(admin)/admin/relatorio/RelatorioClient.tsx"
git commit -m "feat(admin): abas Presença/Compras no relatório + RPCs via admin client"
```

---

### Task 4: ComprasClient (filtros, colunas, tabela, CSV)

**Files:**
- Create: `app/(admin)/admin/relatorio/ComprasClient.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Produto } from '@/types/database'
import {
  COLUNAS_COMPRAS, filtrarCompras, resumoCompras, montarCsvCompras,
  formatarDataHora, formatarValor,
  type ColunaKey, type CompraRow, type FiltrosCompras, type StatusFiltro,
} from '@/lib/relatorio/compras'

const COLUNAS_PADRAO: ColunaKey[] = [
  'aluno_nome', 'aluno_serie', 'aluno_turma', 'responsavel_nome', 'responsavel_email',
]

const STATUS_OPCOES: Array<{ value: StatusFiltro; label: string }> = [
  { value: 'pago', label: 'Pagos' },
  { value: 'pendente', label: 'Pendentes' },
  { value: 'cancelado', label: 'Cancelados' },
  { value: 'todos', label: 'Todos' },
]

interface Props {
  produtos: Produto[]
  produtoSelecionado: Produto | null
  compras: CompraRow[]
}

export function ComprasClient({ produtos, produtoSelecionado, compras }: Props) {
  const router = useRouter()
  const [filtros, setFiltros] = useState<FiltrosCompras>({
    serie: null, turma: null, status: 'pago', incluirEstornados: false,
  })
  const [colunas, setColunas] = useState<ColunaKey[]>(COLUNAS_PADRAO)

  const series = useMemo(
    () => [...new Set(compras.map(c => c.aluno_serie).filter((s): s is string => !!s))].sort(),
    [compras],
  )
  const turmas = useMemo(
    () => [...new Set(compras.map(c => c.aluno_turma).filter((t): t is string => !!t))].sort(),
    [compras],
  )

  const visiveis = useMemo(() => filtrarCompras(compras, filtros), [compras, filtros])
  const { qtd, total } = resumoCompras(visiveis)
  const colunasAtivas = COLUNAS_COMPRAS.filter(c => colunas.includes(c.key))

  function toggleColuna(key: ColunaKey) {
    setColunas(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  function exportarCSV() {
    const nome = produtoSelecionado?.nome ?? 'relatorio'
    const csv = montarCsvCompras(visiveis, colunas)
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `compras_${nome.toLowerCase().replace(/\s+/g, '_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function celulaTabela(row: CompraRow, key: ColunaKey): string {
    if (key === 'data_pagamento') return formatarDataHora(row.data_pagamento)
    if (key === 'preco_unitario') return `R$ ${formatarValor(row.preco_unitario)}`
    return String(row[key] ?? '—')
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--text-1)', margin: '0 0 6px', letterSpacing: '-.03em' }}>
            🛒 Relatório de Compras
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0, fontWeight: 500 }}>
            Quem comprou cada produto, com filtros e colunas configuráveis.
          </p>
        </div>
        {visiveis.length > 0 && (
          <button
            onClick={exportarCSV}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', borderRadius: 10,
              background: 'var(--surface-2)', color: 'var(--text-1)',
              border: '1px solid var(--border)', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
            }}
          >
            ⬇️ Exportar CSV
          </button>
        )}
      </div>

      {produtos.length === 0 ? (
        <div style={{
          background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.25)',
          borderRadius: 12, padding: '16px 20px', fontSize: 14, color: '#b45309', fontWeight: 600,
        }}>
          ⚠️ Nenhum produto encontrado.
        </div>
      ) : (
        <>
          {/* Seletor de produto */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-3)', marginBottom: 8, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              Produto
            </label>
            <select
              value={produtoSelecionado?.id ?? ''}
              onChange={e => router.push(`/admin/relatorio?tab=compras&produto=${e.target.value}`)}
              style={{
                width: '100%', maxWidth: 480, padding: '10px 14px',
                borderRadius: 10, border: '1px solid var(--border)',
                fontSize: 14, fontWeight: 600, color: 'var(--text-1)',
                background: 'var(--surface-2)', appearance: 'none', cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {produtos.map(p => (
                <option key={p.id} value={p.id} style={{ color: '#000' }}>
                  {p.icon ?? '📦'} {p.nome}
                  {p.data_evento ? ` — ${new Date(p.data_evento).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
            <Filtro label="Série">
              <select value={filtros.serie ?? ''} onChange={e => setFiltros(f => ({ ...f, serie: e.target.value || null }))} style={selectStyle}>
                <option value="">Todas</option>
                {series.map(s => <option key={s} value={s} style={{ color: '#000' }}>{s}</option>)}
              </select>
            </Filtro>
            <Filtro label="Turma">
              <select value={filtros.turma ?? ''} onChange={e => setFiltros(f => ({ ...f, turma: e.target.value || null }))} style={selectStyle}>
                <option value="">Todas</option>
                {turmas.map(t => <option key={t} value={t} style={{ color: '#000' }}>{t}</option>)}
              </select>
            </Filtro>
            <Filtro label="Status">
              <select value={filtros.status} onChange={e => setFiltros(f => ({ ...f, status: e.target.value as StatusFiltro }))} style={selectStyle}>
                {STATUS_OPCOES.map(o => <option key={o.value} value={o.value} style={{ color: '#000' }}>{o.label}</option>)}
              </select>
            </Filtro>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-2)', paddingBottom: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filtros.incluirEstornados}
                onChange={e => setFiltros(f => ({ ...f, incluirEstornados: e.target.checked }))}
              />
              Incluir estornados
            </label>
          </div>

          {/* Seletor de colunas */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-3)', marginBottom: 8, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              Colunas do relatório
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COLUNAS_COMPRAS.map(c => {
                const ativa = colunas.includes(c.key)
                return (
                  <button
                    key={c.key}
                    onClick={() => toggleColuna(c.key)}
                    style={{
                      padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                      cursor: 'pointer',
                      background: ativa ? 'rgba(16,185,129,.12)' : 'var(--surface-2)',
                      color: ativa ? '#059669' : 'var(--text-3)',
                      border: ativa ? '1px solid rgba(16,185,129,.35)' : '1px solid var(--border)',
                    }}
                  >
                    {ativa ? '✓ ' : ''}{c.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Resumo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
            <ResumoCard valor={String(qtd)} label="Compras" emoji="🛒" />
            <ResumoCard valor={`R$ ${formatarValor(total)}`} label="Valor total" emoji="💰" />
          </div>

          {/* Tabela / vazio */}
          {visiveis.length === 0 ? (
            <div style={{
              background: 'var(--surface)', border: '1.5px dashed var(--border)',
              borderRadius: 16, padding: '60px 20px', textAlign: 'center',
              fontSize: 14, color: 'var(--text-3)',
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              Nenhuma compra encontrada com os filtros atuais.
            </div>
          ) : (
            <div style={{
              background: 'var(--surface)', border: '1.5px solid var(--border)',
              borderRadius: 16, overflowX: 'auto', backdropFilter: 'blur(16px)',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)' }}>
                    {colunasAtivas.map(c => (
                      <th key={c.key} style={{
                        padding: '10px 12px', textAlign: 'left',
                        fontSize: 10, fontWeight: 800, color: 'var(--text-3)',
                        letterSpacing: '.08em', textTransform: 'uppercase',
                        borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                      }}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map(row => (
                    <tr key={row.item_id} style={{ borderBottom: '1px solid var(--border)' }}>
                      {colunasAtivas.map(c => (
                        <td key={c.key} style={{
                          padding: '10px 12px', color: 'var(--text-2)', fontWeight: 500,
                          whiteSpace: 'nowrap',
                          textDecoration: row.estornado ? 'line-through' : 'none',
                        }}>
                          {celulaTabela(row, c.key)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)',
  fontSize: 13, fontWeight: 600, color: 'var(--text-1)',
  background: 'var(--surface-2)', appearance: 'none', cursor: 'pointer',
  fontFamily: 'inherit', minWidth: 120,
}

function Filtro({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-3)', marginBottom: 6, letterSpacing: '.08em', textTransform: 'uppercase' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function ResumoCard({ valor, label, emoji }: { valor: string; label: string; emoji: string }) {
  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '16px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    }}>
      <div style={{ fontSize: 24 }}>{emoji}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-1)' }}>{valor}</div>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-3)' }}>{label.toUpperCase()}</div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/admin/relatorio/ComprasClient.tsx"
git commit -m "feat(admin): aba Compras com filtros, seleção de colunas e export CSV"
```

---

### Task 5: Suíte completa + build

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: todos os testes passam (279 pré-existentes + 12 novos).

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build conclui sem erros. (Não subir dev server — regra do ambiente.)

- [ ] **Step 3: Commit fixes if any**

Se algo quebrar, corrigir e commitar junto da causa. Nada a commitar se tudo verde.

---

### Task 6: Push + PR

- [ ] **Step 1: Push branch**

```bash
git push -u origin feat/relatorio-compras
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --repo wsapao/EduStore \
  --title "Relatório de Compras por Produto (aba nova em /admin/relatorio)" \
  --body "$(cat <<'EOF'
## O que muda
- `/admin/relatorio` agora tem duas abas: **Presença** (comportamento atual) e **Compras** (nova).
- Aba Compras: relatório de compradores de **qualquer** produto (com ou sem ingresso), com filtros por série/turma/status, seleção de colunas (aluno, série, turma, responsável, e-mail, telefone, variante, pedido, data, valor) e export CSV.
- Nova RPC `get_relatorio_compras` (SECURITY DEFINER, service-role only), migration versionada.
- **Segurança:** `get_relatorio_presenca` estava executável por qualquer `authenticated` via PostgREST (PII de alunos). Entrou no lockdown e o caller migrou para o admin client.

## Testes
- 12 testes novos em `tests/lib/relatorio-compras.test.ts` (filtros, resumo, formatação, CSV).
- Suíte completa verde + `npm run build` ok.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Report PR URL to user**
