# Configurações — Módulo Checkout (Plano de Implementação)

> Use superpowers:subagent-driven-development. Steps em checkbox.

**Goal:** `/admin/configuracoes/checkout` permite editar 5 campos da operação de venda (todos já existentes em `escola_configuracoes`):

- `termo_padrao_compra` (textarea)
- `permite_multiplos_alunos` (boolean)
- `mensagem_pos_compra` (textarea)
- `carrinho_expiracao_minutos` (int > 0)
- `exige_cpf_responsavel` (boolean)

**Architecture:** Página server-component carrega `EscolaConfiguracoes` via `getEscolaIdParaAdmin` e renderiza um único `CheckoutForm` (client). Server Action `atualizarCheckoutAction` valida e persiste em `escola_configuracoes`. Padrão idêntico ao módulo Pagamentos.

**Tech Stack:** Next.js 15 · Supabase · TypeScript · Vitest

**Branch:** `feat/configuracoes-checkout` (criada de `main`)

**Sem migrations.** Sem refator em `(loja)` — apenas a página de admin nesta entrega. **Wiring no checkout/cadastro/pós-compra fica fora do escopo** (anotado em "Próximos passos").

---

## Estrutura

| Arquivo | Responsabilidade |
|---|---|
| `app/actions/configuracoes/checkout.ts` | `atualizarCheckoutAction` |
| `tests/configuracoes/checkout.test.ts` | Tests da action |
| `app/(admin)/admin/configuracoes/checkout/page.tsx` | Server: busca config, renderiza form |
| `app/(admin)/admin/configuracoes/checkout/CheckoutForm.tsx` | Client: form único |

---

## Task 1: Server action + testes (TDD)

**Files:**
- Create: `app/actions/configuracoes/checkout.ts`
- Create: `tests/configuracoes/checkout.test.ts`

- [ ] **Step 1: Escrever testes**

`tests/configuracoes/checkout.test.ts`:

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
import { atualizarCheckoutAction } from '@/app/actions/configuracoes/checkout'

function fd(obj: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(obj)) f.append(k, v)
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

describe('atualizarCheckoutAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exige permissão configuracoes.editar_identidade', async () => {
    ;(requirePermission as any).mockRejectedValue(new Error('denied'))
    const r = await atualizarCheckoutAction(fd({ carrinho_expiracao_minutos: '60' }))
    expect(requirePermission).toHaveBeenCalledWith('configuracoes.editar_identidade')
    expect(r.error).toBeDefined()
  })

  it('rejeita carrinho_expiracao_minutos <= 0', async () => {
    setupHappy()
    const r = await atualizarCheckoutAction(fd({ carrinho_expiracao_minutos: '0' }))
    expect(r.error).toMatch(/carrinho|expira/i)
  })

  it('rejeita carrinho_expiracao_minutos não numérico', async () => {
    setupHappy()
    const r = await atualizarCheckoutAction(fd({ carrinho_expiracao_minutos: 'abc' }))
    expect(r.error).toMatch(/carrinho|expira/i)
  })

  it('rejeita termo com mais de 5000 caracteres', async () => {
    setupHappy()
    const r = await atualizarCheckoutAction(fd({
      carrinho_expiracao_minutos: '60',
      termo_padrao_compra: 'x'.repeat(5001),
    }))
    expect(r.error).toMatch(/termo/i)
  })

  it('rejeita mensagem_pos_compra com mais de 1000 caracteres', async () => {
    setupHappy()
    const r = await atualizarCheckoutAction(fd({
      carrinho_expiracao_minutos: '60',
      mensagem_pos_compra: 'x'.repeat(1001),
    }))
    expect(r.error).toMatch(/mensagem/i)
  })

  it('persiste happy path mínimo', async () => {
    const { update, eq } = setupHappy()
    const r = await atualizarCheckoutAction(fd({
      carrinho_expiracao_minutos: '90',
    }))
    expect(r).toEqual({ success: true })
    expect(update).toHaveBeenCalledWith({
      termo_padrao_compra: null,
      permite_multiplos_alunos: false,
      mensagem_pos_compra: null,
      carrinho_expiracao_minutos: 90,
      exige_cpf_responsavel: false,
    })
    expect(eq).toHaveBeenCalledWith('escola_id', 'esc-1')
  })

  it('persiste happy path completo', async () => {
    const { update } = setupHappy()
    await atualizarCheckoutAction(fd({
      termo_padrao_compra: 'Termo de uso para esta loja escolar.',
      permite_multiplos_alunos: 'on',
      mensagem_pos_compra: 'Obrigado pela compra!',
      carrinho_expiracao_minutos: '120',
      exige_cpf_responsavel: 'on',
    }))
    expect(update).toHaveBeenCalledWith({
      termo_padrao_compra: 'Termo de uso para esta loja escolar.',
      permite_multiplos_alunos: true,
      mensagem_pos_compra: 'Obrigado pela compra!',
      carrinho_expiracao_minutos: 120,
      exige_cpf_responsavel: true,
    })
  })

  it('retorna erro quando update falha', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    const eq = vi.fn().mockResolvedValue({ error: { message: 'boom' } })
    ;(createClient as any).mockResolvedValue({ from: vi.fn(() => ({ update: () => ({ eq }) })) })
    const r = await atualizarCheckoutAction(fd({ carrinho_expiracao_minutos: '60' }))
    expect(r.error).toMatch(/salvar|erro/i)
  })

  it('retorna erro quando escola não encontrada', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue(null)
    ;(createClient as any).mockResolvedValue({ from: vi.fn() })
    const r = await atualizarCheckoutAction(fd({ carrinho_expiracao_minutos: '60' }))
    expect(r.error).toMatch(/escola/i)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test -- checkout
```

Expected: FAIL — module não encontrado.

- [ ] **Step 3: Implementar**

`app/actions/configuracoes/checkout.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission, PermissionDeniedError } from '@/lib/permissoes'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'

export async function atualizarCheckoutAction(formData: FormData) {
  try {
    await requirePermission('configuracoes.editar_identidade')
  } catch (e) {
    if (e instanceof PermissionDeniedError) return { error: 'Sem permissão.' }
    return { error: 'Sem permissão.' }
  }

  const expRaw = formData.get('carrinho_expiracao_minutos') as string | null
  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp <= 0) {
    return { error: 'Tempo de expiração do carrinho deve ser maior que zero.' }
  }

  const termo = (formData.get('termo_padrao_compra') as string | null)?.trim() || null
  if (termo && termo.length > 5000) {
    return { error: 'Termo padrão de compra deve ter no máximo 5000 caracteres.' }
  }

  const msg = (formData.get('mensagem_pos_compra') as string | null)?.trim() || null
  if (msg && msg.length > 1000) {
    return { error: 'Mensagem pós-compra deve ter no máximo 1000 caracteres.' }
  }

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const { error } = await supabase
    .from('escola_configuracoes')
    .update({
      termo_padrao_compra: termo,
      permite_multiplos_alunos: formData.get('permite_multiplos_alunos') === 'on',
      mensagem_pos_compra: msg,
      carrinho_expiracao_minutos: exp,
      exige_cpf_responsavel: formData.get('exige_cpf_responsavel') === 'on',
    })
    .eq('escola_id', escolaId)

  if (error) return { error: 'Erro ao salvar configurações de checkout.' }

  revalidatePath('/admin/configuracoes/checkout')
  return { success: true }
}
```

- [ ] **Step 4: Rodar e ver passar (9 tests)**

```bash
npm test -- checkout
```

Expected: 9 passed.

- [ ] **Step 5: Suíte completa**

```bash
npm test
```

Expected: 121 passed (112 + 9).

- [ ] **Step 6: Commit + push**

```bash
git add app/actions/configuracoes/checkout.ts tests/configuracoes/checkout.test.ts
git commit -m "feat(checkout): atualizarCheckoutAction com 9 testes"
git push -u origin feat/configuracoes-checkout
```

---

## Task 2: Página + form

**Files:**
- Create: `app/(admin)/admin/configuracoes/checkout/page.tsx`
- Create: `app/(admin)/admin/configuracoes/checkout/CheckoutForm.tsx`

- [ ] **Step 1: Criar `page.tsx` (server)**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { hasPermission } from '@/lib/permissoes'
import type { EscolaConfiguracoes } from '@/types/database'
import { CheckoutForm } from './CheckoutForm'

export default async function CheckoutConfigPage() {
  if (!(await hasPermission('configuracoes.editar_identidade'))) {
    redirect('/admin/configuracoes')
  }

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginBottom: 16 }}>Checkout</h1>
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
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginBottom: 16 }}>Checkout</h1>
        <p style={{ color: '#ef4444' }}>Configurações da escola não encontradas.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginBottom: 24 }}>Checkout</h1>
      <div style={{ maxWidth: 820 }}>
        <section style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: 24,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc', marginBottom: 16 }}>
            Regras de pedidos e carrinho
          </h2>
          <CheckoutForm config={config} />
        </section>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Criar `CheckoutForm.tsx` (client)**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { atualizarCheckoutAction } from '@/app/actions/configuracoes/checkout'
import type { EscolaConfiguracoes } from '@/types/database'

export function CheckoutForm({ config }: { config: EscolaConfiguracoes }) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  async function onSubmit(formData: FormData) {
    setMsg(null)
    startTransition(async () => {
      const r = await atualizarCheckoutAction(formData)
      if ('error' in r && r.error) setMsg({ tipo: 'erro', texto: r.error })
      else setMsg({ tipo: 'ok', texto: 'Configurações salvas!' })
    })
  }

  return (
    <form action={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Field label="Termo padrão de compra (aplicado a produtos sem termo próprio, máx. 5000 caracteres)">
        <textarea
          name="termo_padrao_compra"
          rows={6}
          maxLength={5000}
          defaultValue={config.termo_padrao_compra ?? ''}
          placeholder="Ex.: Ao concluir esta compra, você concorda com os termos da escola..."
          style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
        />
      </Field>

      <Field label="Mensagem pós-compra (mostrada ao responsável após finalizar pedido, máx. 1000 caracteres)">
        <textarea
          name="mensagem_pos_compra"
          rows={3}
          maxLength={1000}
          defaultValue={config.mensagem_pos_compra ?? ''}
          placeholder="Ex.: Obrigado! Seu pedido será processado em breve."
          style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
        />
      </Field>

      <Field label="Tempo de expiração do carrinho (minutos sem checkout)">
        <input
          name="carrinho_expiracao_minutos"
          type="number"
          min={1}
          defaultValue={config.carrinho_expiracao_minutos}
          required
          style={{ ...inputStyle, width: 160 }}
        />
      </Field>

      <Field label="Pedidos com múltiplos alunos">
        <Toggle
          name="permite_multiplos_alunos"
          defaultChecked={config.permite_multiplos_alunos}
          label="Permitir incluir mais de um aluno no mesmo pedido"
        />
      </Field>

      <Field label="Cadastro de responsáveis">
        <Toggle
          name="exige_cpf_responsavel"
          defaultChecked={config.exige_cpf_responsavel}
          label="Exigir CPF do responsável no cadastro"
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

function Toggle({ name, defaultChecked, label }: { name: string; defaultChecked?: boolean; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} style={checkboxStyle} />
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

- [ ] **Step 3: Validar**

```bash
npx tsc --noEmit
npm test
npm run build
```

Esperado: tsc 0 erros, 121 testes passando, rota `/admin/configuracoes/checkout` listada.

- [ ] **Step 4: Commit + push**

```bash
git add app/\(admin\)/admin/configuracoes/checkout/
git commit -m "feat(checkout): página /admin/configuracoes/checkout com form único"
git push
```

---

## Task 3: PR + merge

- [ ] **Step 1: Commit do plano**

```bash
git add docs/superpowers/plans/2026-05-14-configuracoes-checkout.md
git commit -m "docs: plano do Módulo Checkout"
git push
```

- [ ] **Step 2: Abrir PR + aguardar checks + mergear**

```bash
/opt/homebrew/bin/gh pr create --base main --head feat/configuracoes-checkout \
  --title "feat: Módulo Checkout — termo, multi-aluno, expiração, CPF" \
  --body "$(cat <<'EOF'
## Summary

Implementa /admin/configuracoes/checkout com 5 campos (todos já em escola_configuracoes desde a Fundação):

- Termo padrão de compra (textarea, máx. 5000)
- Mensagem pós-compra (textarea, máx. 1000)
- Tempo de expiração do carrinho (minutos > 0)
- Permite múltiplos alunos no mesmo pedido (boolean)
- Exigir CPF do responsável no cadastro (boolean)

Server Action com requirePermission('configuracoes.editar_identidade'). 9 testes Vitest. Sem migrations.

## Test plan

- [ ] /admin/configuracoes/checkout carrega com form único
- [ ] Estado inicial bate com banco
- [ ] Validações: expiração <= 0, termo > 5000, mensagem > 1000 → erros
- [ ] Salvar com todos os campos preenchidos → persiste
- [ ] npm test → 121 passing
- [ ] npm run build → ok

## Out of scope

Wiring desses campos em (loja)/checkout, /pedido/sucesso e /cadastro fica para próximo PR — esta entrega só cobre a tela de admin.
EOF
)"

PR_NUM=$(/opt/homebrew/bin/gh pr view --json number -q .number)
/opt/homebrew/bin/gh pr checks $PR_NUM --watch --interval 15
/opt/homebrew/bin/gh pr merge $PR_NUM --squash --delete-branch
git checkout main && git pull origin main
```

---

## Definition of Done

- [ ] /admin/configuracoes/checkout funcional
- [ ] 121 testes passando, tsc + build verdes
- [ ] PR mergeado em main

## Próximos passos (fora deste plano)

PR separado para fazer o checkout/cadastro/pós-compra **lerem** essas configs:
- `(loja)/checkout` lê `permite_multiplos_alunos` + `carrinho_expiracao_minutos`
- `/pedido/[id]` ou `/pedido/sucesso` lê `mensagem_pos_compra`
- `(auth)/cadastro` lê `exige_cpf_responsavel`
- Produtos sem `texto_termo` próprio aplicam `termo_padrao_compra`
