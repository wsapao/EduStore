# Configurações — Módulo Pagamentos (Plano de Implementação)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar `/admin/configuracoes/pagamentos` permitindo ao admin editar métodos aceitos por padrão, máximo de parcelas, expiração do PIX, taxa de cartão repassada, webhook secret do Asaas e chave PIX recebedora — tudo persistido em `escola_configuracoes`. Mostrar também o status (read-only) da `ASAAS_API_KEY` configurada via env var.

**Architecture:** Página server-component lê `escola_configuracoes` via `getEscolaIdParaAdmin` (helper já existente) e renderiza dois cards: `PagamentosForm` (client, com todos os campos editáveis num único form) e `AsaasStatusCard` (server, badge dinâmico baseado em `process.env.ASAAS_API_KEY`). Server Action `atualizarPagamentosAction` valida tudo e faz `update` em `escola_configuracoes`.

**Tech Stack:** Next.js 15 App Router · Supabase · TypeScript · Vitest

**Spec:** [2026-05-11-configuracoes-loja-design.md](../specs/2026-05-11-configuracoes-loja-design.md) seção 4.4

**Branch:** `feat/configuracoes-pagamentos` (já criada de `main`)

**Sem migrations** — todas as colunas necessárias já existem em `escola_configuracoes` desde a Fundação:
- `metodos_aceitos_padrao` (TEXT[])
- `max_parcelas_padrao` (INT 1-12)
- `pix_expiracao_segundos` (INT > 0)
- `taxa_cartao_repassada` (BOOLEAN)
- `taxa_cartao_percentual` (NUMERIC(5,2) 0-100)
- `asaas_webhook_secret` (TEXT)
- `pix_chave_recebedora` (TEXT)

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `app/actions/configuracoes/pagamentos.ts` | 1 Server Action `atualizarPagamentosAction` |
| `tests/configuracoes/pagamentos.test.ts` | Tests da action |
| `app/(admin)/admin/configuracoes/pagamentos/page.tsx` | Server component: busca config, renderiza 2 cards |
| `app/(admin)/admin/configuracoes/pagamentos/PagamentosForm.tsx` | Client: form com todos os campos editáveis |
| `app/(admin)/admin/configuracoes/pagamentos/AsaasStatusCard.tsx` | Server: badge "configurado/não configurado" |

---

## Task 1: Server action `atualizarPagamentosAction`

**Files:**
- Create: `app/actions/configuracoes/pagamentos.ts`
- Create: `tests/configuracoes/pagamentos.test.ts`

- [ ] **Step 1: Escrever testes (full content)**

`tests/configuracoes/pagamentos.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/permissoes', () => ({
  requirePermission: vi.fn(),
  PermissionDeniedError: class extends Error {},
}))
vi.mock('@/lib/escola/getEscolaIdParaAdmin', () => ({ getEscolaIdParaAdmin: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/permissoes'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { atualizarPagamentosAction } from '@/app/actions/configuracoes/pagamentos'

function fd(obj: Record<string, string | string[]>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) v.forEach(x => f.append(k, x))
    else f.append(k, v)
  }
  return f
}

function setupHappy() {
  ;(requirePermission as any).mockResolvedValue(undefined)
  ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
  const eq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn(() => ({ eq }))
  ;(createClient as any).mockResolvedValue({ from: vi.fn(() => ({ update })) })
  return { update, eq }
}

describe('atualizarPagamentosAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exige permissão configuracoes.editar_pagamentos', async () => {
    ;(requirePermission as any).mockRejectedValue(new Error('denied'))
    const r = await atualizarPagamentosAction(fd({}))
    expect(requirePermission).toHaveBeenCalledWith('configuracoes.editar_pagamentos')
    expect(r.error).toBeDefined()
  })

  it('rejeita quando nenhum método de pagamento é selecionado', async () => {
    setupHappy()
    const r = await atualizarPagamentosAction(fd({
      metodos_aceitos_padrao: [],
      max_parcelas_padrao: '12',
      pix_expiracao_segundos: '1800',
    }))
    expect(r.error).toMatch(/m[ée]todo/i)
  })

  it('rejeita método inválido', async () => {
    setupHappy()
    const r = await atualizarPagamentosAction(fd({
      metodos_aceitos_padrao: ['bitcoin'],
      max_parcelas_padrao: '12',
      pix_expiracao_segundos: '1800',
    }))
    expect(r.error).toMatch(/m[ée]todo/i)
  })

  it('rejeita parcelas fora do range 1-12', async () => {
    setupHappy()
    const r1 = await atualizarPagamentosAction(fd({
      metodos_aceitos_padrao: ['pix'],
      max_parcelas_padrao: '0',
      pix_expiracao_segundos: '1800',
    }))
    expect(r1.error).toMatch(/parcela/i)

    const r2 = await atualizarPagamentosAction(fd({
      metodos_aceitos_padrao: ['pix'],
      max_parcelas_padrao: '13',
      pix_expiracao_segundos: '1800',
    }))
    expect(r2.error).toMatch(/parcela/i)
  })

  it('rejeita expiração PIX <= 0', async () => {
    setupHappy()
    const r = await atualizarPagamentosAction(fd({
      metodos_aceitos_padrao: ['pix'],
      max_parcelas_padrao: '12',
      pix_expiracao_segundos: '0',
    }))
    expect(r.error).toMatch(/pix/i)
  })

  it('rejeita taxa percentual fora de 0-100 quando taxa_cartao_repassada=true', async () => {
    setupHappy()
    const r = await atualizarPagamentosAction(fd({
      metodos_aceitos_padrao: ['cartao'],
      max_parcelas_padrao: '12',
      pix_expiracao_segundos: '1800',
      taxa_cartao_repassada: 'on',
      taxa_cartao_percentual: '150',
    }))
    expect(r.error).toMatch(/taxa/i)
  })

  it('exige percentual quando taxa_cartao_repassada=true', async () => {
    setupHappy()
    const r = await atualizarPagamentosAction(fd({
      metodos_aceitos_padrao: ['cartao'],
      max_parcelas_padrao: '12',
      pix_expiracao_segundos: '1800',
      taxa_cartao_repassada: 'on',
      taxa_cartao_percentual: '',
    }))
    expect(r.error).toMatch(/percentual|taxa/i)
  })

  it('persiste com sucesso o caminho feliz mínimo', async () => {
    const { update } = setupHappy()
    const r = await atualizarPagamentosAction(fd({
      metodos_aceitos_padrao: ['pix', 'cartao'],
      max_parcelas_padrao: '6',
      pix_expiracao_segundos: '1800',
    }))
    expect(r).toEqual({ success: true })
    expect(update).toHaveBeenCalledWith({
      metodos_aceitos_padrao: ['pix', 'cartao'],
      max_parcelas_padrao: 6,
      pix_expiracao_segundos: 1800,
      taxa_cartao_repassada: false,
      taxa_cartao_percentual: null,
      asaas_webhook_secret: null,
      pix_chave_recebedora: null,
    })
  })

  it('persiste com taxa repassada e percentual', async () => {
    const { update } = setupHappy()
    await atualizarPagamentosAction(fd({
      metodos_aceitos_padrao: ['cartao'],
      max_parcelas_padrao: '12',
      pix_expiracao_segundos: '3600',
      taxa_cartao_repassada: 'on',
      taxa_cartao_percentual: '3.5',
      asaas_webhook_secret: 'secret-abc',
      pix_chave_recebedora: 'chave@email.com',
    }))
    expect(update).toHaveBeenCalledWith({
      metodos_aceitos_padrao: ['cartao'],
      max_parcelas_padrao: 12,
      pix_expiracao_segundos: 3600,
      taxa_cartao_repassada: true,
      taxa_cartao_percentual: 3.5,
      asaas_webhook_secret: 'secret-abc',
      pix_chave_recebedora: 'chave@email.com',
    })
  })

  it('zera taxa_cartao_percentual quando taxa_cartao_repassada=false', async () => {
    const { update } = setupHappy()
    await atualizarPagamentosAction(fd({
      metodos_aceitos_padrao: ['pix'],
      max_parcelas_padrao: '12',
      pix_expiracao_segundos: '1800',
      // sem taxa_cartao_repassada (não checked)
      taxa_cartao_percentual: '5', // ignorado
    }))
    const payload = (update.mock.calls[0] as unknown[])[0] as any
    expect(payload.taxa_cartao_repassada).toBe(false)
    expect(payload.taxa_cartao_percentual).toBeNull()
  })

  it('retorna erro quando update falha', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    const eq = vi.fn().mockResolvedValue({ error: { message: 'boom' } })
    ;(createClient as any).mockResolvedValue({ from: vi.fn(() => ({ update: () => ({ eq }) })) })
    const r = await atualizarPagamentosAction(fd({
      metodos_aceitos_padrao: ['pix'],
      max_parcelas_padrao: '12',
      pix_expiracao_segundos: '1800',
    }))
    expect(r.error).toMatch(/salvar|erro/i)
  })

  it('retorna erro quando escola não encontrada', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue(null)
    ;(createClient as any).mockResolvedValue({ from: vi.fn() })
    const r = await atualizarPagamentosAction(fd({
      metodos_aceitos_padrao: ['pix'],
      max_parcelas_padrao: '12',
      pix_expiracao_segundos: '1800',
    }))
    expect(r.error).toMatch(/escola/i)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test -- pagamentos
```

Expected: FAIL — `Cannot find module '@/app/actions/configuracoes/pagamentos'`.

- [ ] **Step 3: Implementar**

`app/actions/configuracoes/pagamentos.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission, PermissionDeniedError } from '@/lib/permissoes'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'

const METODOS_VALIDOS = new Set(['pix', 'cartao', 'boleto'])

export async function atualizarPagamentosAction(formData: FormData) {
  try {
    await requirePermission('configuracoes.editar_pagamentos')
  } catch (e) {
    if (e instanceof PermissionDeniedError) return { error: 'Sem permissão.' }
    return { error: 'Sem permissão.' }
  }

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const metodos = formData.getAll('metodos_aceitos_padrao').map(String)
  if (metodos.length === 0) {
    return { error: 'Selecione pelo menos um método de pagamento.' }
  }
  for (const m of metodos) {
    if (!METODOS_VALIDOS.has(m)) {
      return { error: `Método inválido: ${m}.` }
    }
  }

  const maxParcelasRaw = formData.get('max_parcelas_padrao') as string | null
  const maxParcelas = Number(maxParcelasRaw)
  if (!Number.isFinite(maxParcelas) || maxParcelas < 1 || maxParcelas > 12) {
    return { error: 'Máximo de parcelas deve ser entre 1 e 12.' }
  }

  const pixExpRaw = formData.get('pix_expiracao_segundos') as string | null
  const pixExp = Number(pixExpRaw)
  if (!Number.isFinite(pixExp) || pixExp <= 0) {
    return { error: 'Expiração do PIX deve ser maior que zero.' }
  }

  const taxaRepassada = formData.get('taxa_cartao_repassada') === 'on'
  let taxaPercentual: number | null = null
  if (taxaRepassada) {
    const raw = (formData.get('taxa_cartao_percentual') as string | null)?.trim() ?? ''
    if (!raw) return { error: 'Informe o percentual da taxa.' }
    const v = Number(raw.replace(',', '.'))
    if (!Number.isFinite(v) || v < 0 || v > 100) {
      return { error: 'Taxa percentual deve estar entre 0 e 100.' }
    }
    taxaPercentual = v
  }

  const webhookSecret = (formData.get('asaas_webhook_secret') as string | null)?.trim() || null
  const pixChave = (formData.get('pix_chave_recebedora') as string | null)?.trim() || null

  const { error } = await supabase
    .from('escola_configuracoes')
    .update({
      metodos_aceitos_padrao: metodos,
      max_parcelas_padrao: maxParcelas,
      pix_expiracao_segundos: pixExp,
      taxa_cartao_repassada: taxaRepassada,
      taxa_cartao_percentual: taxaPercentual,
      asaas_webhook_secret: webhookSecret,
      pix_chave_recebedora: pixChave,
    })
    .eq('escola_id', escolaId)

  if (error) return { error: 'Erro ao salvar configurações de pagamento.' }

  revalidatePath('/admin/configuracoes/pagamentos')
  return { success: true }
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npm test -- pagamentos
```

Expected: 12 passed.

- [ ] **Step 5: Suíte completa**

```bash
npm test
```

Expected: 60 passed (48 anteriores + 12 novos).

- [ ] **Step 6: Commit + push**

```bash
git add app/actions/configuracoes/pagamentos.ts tests/configuracoes/pagamentos.test.ts
git commit -m "feat(pagamentos): atualizarPagamentosAction com 12 testes"
git push -u origin feat/configuracoes-pagamentos
```

---

## Task 2: Página + componentes UI

**Files:**
- Create: `app/(admin)/admin/configuracoes/pagamentos/page.tsx`
- Create: `app/(admin)/admin/configuracoes/pagamentos/PagamentosForm.tsx`
- Create: `app/(admin)/admin/configuracoes/pagamentos/AsaasStatusCard.tsx`

- [ ] **Step 1: Criar `page.tsx` (server)**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { hasPermission } from '@/lib/permissoes'
import type { EscolaConfiguracoes } from '@/types/database'
import { PagamentosForm } from './PagamentosForm'
import { AsaasStatusCard } from './AsaasStatusCard'

export default async function PagamentosConfigPage() {
  if (!(await hasPermission('configuracoes.editar_pagamentos'))) {
    redirect('/admin/configuracoes')
  }

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginBottom: 16 }}>
          Pagamentos
        </h1>
        <p style={{ color: '#94a3b8' }}>Sua conta não está vinculada a uma escola.</p>
      </div>
    )
  }

  const { data: config } = await supabase
    .from('escola_configuracoes')
    .select('*')
    .eq('escola_id', escolaId)
    .single<EscolaConfiguracoes>()

  if (!config) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginBottom: 16 }}>
          Pagamentos
        </h1>
        <p style={{ color: '#ef4444' }}>Configurações da escola não encontradas.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginBottom: 24 }}>
        Pagamentos
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 820 }}>
        <Card titulo="Configurações operacionais">
          <PagamentosForm config={config} />
        </Card>

        <Card titulo="Asaas — credenciais (env)">
          <AsaasStatusCard />
        </Card>
      </div>
    </div>
  )
}

function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16,
      padding: 24,
    }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc', marginBottom: 16 }}>
        {titulo}
      </h2>
      {children}
    </section>
  )
}
```

- [ ] **Step 2: Criar `AsaasStatusCard.tsx` (server)**

```typescript
export function AsaasStatusCard() {
  const configurada = !!process.env.ASAAS_API_KEY
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{
          width: 10, height: 10, borderRadius: 5,
          background: configurada ? '#22c55e' : '#ef4444',
        }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>
          {configurada ? 'API key configurada' : 'API key NÃO configurada'}
        </span>
      </div>

      <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
        A chave de API do Asaas é gerenciada via variável de ambiente <code style={codeStyle}>ASAAS_API_KEY</code> no Vercel — por questões de segurança, ela não pode ser editada por aqui.
      </p>

      {!configurada && (
        <p style={{ fontSize: 12, color: '#fbbf24', marginTop: 12 }}>
          ⚠️ Sem essa chave, gateway Asaas não funciona. Configure no painel do Vercel em
          {' '}<strong>Settings → Environment Variables</strong>.
        </p>
      )}
    </div>
  )
}

const codeStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.3)',
  padding: '2px 6px',
  borderRadius: 4,
  fontSize: 12,
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
}
```

- [ ] **Step 3: Criar `PagamentosForm.tsx` (client)**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { atualizarPagamentosAction } from '@/app/actions/configuracoes/pagamentos'
import type { EscolaConfiguracoes } from '@/types/database'

const EXPIRACOES = [
  { valor: 900,    rotulo: '15 minutos' },
  { valor: 1800,   rotulo: '30 minutos' },
  { valor: 3600,   rotulo: '1 hora' },
  { valor: 86400,  rotulo: '24 horas' },
]

export function PagamentosForm({ config }: { config: EscolaConfiguracoes }) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [taxaRepassada, setTaxaRepassada] = useState(config.taxa_cartao_repassada)

  async function onSubmit(formData: FormData) {
    setMsg(null)
    startTransition(async () => {
      const r = await atualizarPagamentosAction(formData)
      if ('error' in r && r.error) setMsg({ tipo: 'erro', texto: r.error })
      else setMsg({ tipo: 'ok', texto: 'Configurações salvas!' })
    })
  }

  const metodos = new Set(config.metodos_aceitos_padrao)

  return (
    <form action={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Field label="Métodos aceitos por padrão">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Checkbox name="metodos_aceitos_padrao" value="pix"     defaultChecked={metodos.has('pix')}     label="PIX" />
          <Checkbox name="metodos_aceitos_padrao" value="cartao"  defaultChecked={metodos.has('cartao')}  label="Cartão" />
          <Checkbox name="metodos_aceitos_padrao" value="boleto"  defaultChecked={metodos.has('boleto')}  label="Boleto" />
        </div>
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="Máximo de parcelas (1-12)">
          <input
            name="max_parcelas_padrao"
            type="number"
            min={1}
            max={12}
            defaultValue={config.max_parcelas_padrao}
            required
            style={inputStyle}
          />
        </Field>

        <Field label="Expiração do PIX">
          <select name="pix_expiracao_segundos" defaultValue={String(config.pix_expiracao_segundos)} style={inputStyle as any}>
            {EXPIRACOES.map(e => (
              <option key={e.valor} value={e.valor}>{e.rotulo}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Taxa de cartão repassada ao cliente">
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              name="taxa_cartao_repassada"
              checked={taxaRepassada}
              onChange={e => setTaxaRepassada(e.target.checked)}
              style={checkboxStyle}
            />
            <span style={{ fontSize: 13, color: '#cbd5e1' }}>Repassar a taxa para o cliente</span>
          </label>

          {taxaRepassada && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                name="taxa_cartao_percentual"
                type="number"
                step="0.01"
                min={0}
                max={100}
                defaultValue={config.taxa_cartao_percentual ?? ''}
                placeholder="0.00"
                required
                style={{ ...inputStyle, width: 100 }}
              />
              <span style={{ fontSize: 13, color: '#94a3b8' }}>%</span>
            </div>
          )}
        </div>
      </Field>

      <Field label="Webhook secret do Asaas">
        <input
          name="asaas_webhook_secret"
          defaultValue={config.asaas_webhook_secret ?? ''}
          placeholder="Use o mesmo valor configurado no painel do Asaas"
          style={inputStyle}
        />
      </Field>

      <Field label="Chave PIX recebedora (exibida em comprovantes)">
        <input
          name="pix_chave_recebedora"
          defaultValue={config.pix_chave_recebedora ?? ''}
          placeholder="CPF, e-mail, telefone ou chave aleatória"
          style={inputStyle}
        />
      </Field>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="submit" disabled={pending} style={btnPrimary}>
          {pending ? 'Salvando…' : 'Salvar configurações'}
        </button>
        {msg && (
          <span style={{ fontSize: 13, color: msg.tipo === 'ok' ? '#22c55e' : '#ef4444' }}>
            {msg.texto}
          </span>
        )}
      </div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>{label}</span>
      {children}
    </label>
  )
}

function Checkbox({ name, value, defaultChecked, label }: { name: string; value: string; defaultChecked?: boolean; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} style={checkboxStyle} />
      <span style={{ fontSize: 13, color: '#cbd5e1' }}>{label}</span>
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.25)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: '10px 12px',
  color: '#f8fafc',
  fontSize: 14,
  outline: 'none',
}

const checkboxStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  cursor: 'pointer',
  accentColor: '#f59e0b',
}

const btnPrimary: React.CSSProperties = {
  background: '#f59e0b',
  border: 'none',
  borderRadius: 10,
  padding: '10px 18px',
  color: '#0a1628',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
}
```

- [ ] **Step 4: Validar**

```bash
npx tsc --noEmit
npm test
npm run build
```

Esperado: tsc 0 erros, 60 testes passando, build com `/admin/configuracoes/pagamentos` listada.

- [ ] **Step 5: Commit + push**

```bash
git add app/\(admin\)/admin/configuracoes/pagamentos/
git commit -m "feat(pagamentos): página /admin/configuracoes/pagamentos com 2 cards (form + asaas status)"
git push
```

---

## Task 3: Smoke test final + PR + merge

**Files:** nenhum

- [ ] **Step 1: Smoke test manual**

```bash
npm run dev
```

1. Login admin → `/admin/configuracoes/pagamentos`
2. Card "Configurações operacionais": estado inicial bate com o banco
3. Desmarcar todos os métodos → Salvar → erro "Selecione pelo menos um método"
4. Marcar PIX, mudar parcelas pra 6, expiração 30 min → Salvar → "Configurações salvas!"
5. Recarregar → valores persistem
6. Marcar "Repassar taxa" → input de % aparece → digitar 3.5 → Salvar
7. Card "Asaas": badge verde se `ASAAS_API_KEY` está no Vercel; vermelho caso contrário

- [ ] **Step 2: Commit do plano + abrir PR**

```bash
git add docs/superpowers/plans/2026-05-12-configuracoes-pagamentos.md
git commit -m "docs: plano do Módulo Pagamentos"
git push

/opt/homebrew/bin/gh pr create --base main --head feat/configuracoes-pagamentos \
  --title "feat: Módulo Pagamentos — métodos, parcelas, PIX, webhook" \
  --body "$(cat <<'EOF'
## Summary

Implementa `/admin/configuracoes/pagamentos` com 2 cards:

- **Configurações operacionais (editáveis):** métodos aceitos por padrão (PIX/Cartão/Boleto), máximo de parcelas (1-12), expiração do PIX (15min/30min/1h/24h), taxa de cartão repassada (boolean + %), webhook secret do Asaas, chave PIX recebedora.
- **Asaas — credenciais (read-only):** badge dinâmico mostrando se `ASAAS_API_KEY` está configurada via env do Vercel. Editar continua sendo via painel do Vercel (decisão arquitetural — credenciais sensíveis fora do banco).

Inclui:
- Server Action `atualizarPagamentosAction` com `requirePermission('configuracoes.editar_pagamentos')`
- **12 novos testes Vitest** cobrindo todos os caminhos de validação (60 totais)
- Lê de e atualiza `escola_configuracoes` (criada na Fundação)

Sem migrations.

## Test plan

- [ ] `/admin/configuracoes/pagamentos` carrega com 2 cards
- [ ] Estado inicial bate com banco
- [ ] Validações: sem métodos, parcelas fora 1-12, taxa fora 0-100 → erros
- [ ] Salvar com taxa repassada e % válido → persiste
- [ ] Badge Asaas: verde se ASAAS_API_KEY definida; vermelho se não
- [ ] \`npm test\` → 60 passing
- [ ] \`npm run build\` → ok
EOF
)"
```

- [ ] **Step 3: Aguardar checks + mergear**

```bash
PR_NUM=$(/opt/homebrew/bin/gh pr view --json number -q .number)
/opt/homebrew/bin/gh pr checks $PR_NUM --watch --interval 15
/opt/homebrew/bin/gh pr merge $PR_NUM --squash --delete-branch
git checkout main && git pull origin main
```

---

## Definition of Done

- [ ] `/admin/configuracoes/pagamentos` carrega com 2 cards
- [ ] Form salva todos os 7 campos corretamente em `escola_configuracoes`
- [ ] Validação client + server funcionando
- [ ] Badge Asaas dinâmico baseado em `ASAAS_API_KEY`
- [ ] 60 testes passando, tsc limpo, build verde
- [ ] PR mergeado em `main`

## Próximo após Pagamentos

**Plano 5: Módulo Papéis & Permissões** (`/admin/configuracoes/papeis`) — listar 6 presets + papéis customizados, editor com checkboxes por módulo, criar/duplicar/excluir papel customizado.
