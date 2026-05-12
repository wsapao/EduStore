# Configurações — Módulo Conta (Plano de Implementação)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a rota `/admin/configuracoes/conta` com 4 funcionalidades sobre a própria conta do usuário logado: editar nome, trocar senha, habilitar/desabilitar MFA (TOTP) e encerrar sessões ativas em outros dispositivos.

**Architecture:** Página server-component que carrega dados do usuário e lista de factors MFA, e delega cada bloco a um client component para gerenciar formulários e estado. Server Actions em `app/actions/configuracoes/conta.ts` cuidam de validação e mutações via Supabase Auth. A action de troca de senha é reutilizada de `app/actions/perfil.ts` (já existente, com verificação por re-login). MFA usa o fluxo TOTP padrão do Supabase: enroll retorna QR code → user escaneia → server faz challenge + verify.

**Tech Stack:** Next.js 15 App Router · Supabase Auth (MFA TOTP) · TypeScript · Vitest · Server Actions

**Spec:** [2026-05-11-configuracoes-loja-design.md](../specs/2026-05-11-configuracoes-loja-design.md) seção 4.5

**Branch:** `feat/configuracoes-conta` (já criada a partir de `main`)

**Convenção:** Após cada commit, `git push` (Vercel deploya auto). Use o helper `requirePermission` do `lib/permissoes` em toda Server Action; a página é protegida pelo layout pai (`/admin/configuracoes/layout.tsx`).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `app/(admin)/admin/configuracoes/conta/page.tsx` | Server component: carrega user, factors MFA, renderiza 4 cards |
| `app/(admin)/admin/configuracoes/conta/DadosPessoaisForm.tsx` | Client: form de nome + email (read-only) |
| `app/(admin)/admin/configuracoes/conta/SenhaForm.tsx` | Client: form 3 campos pra trocar senha |
| `app/(admin)/admin/configuracoes/conta/MfaCard.tsx` | Client: state machine idle → enrolling → verifying → enrolled |
| `app/(admin)/admin/configuracoes/conta/SessoesCard.tsx` | Client: botão "Encerrar outras sessões" |
| `app/actions/configuracoes/conta.ts` | Server Actions: atualizarPerfil, MFA (iniciar/verificar/desativar), encerrarOutrasSessoes |
| `tests/configuracoes/conta.test.ts` | Tests unitários das server actions com mock do Supabase |

A action `alterarSenhaAction` já existe em `app/actions/perfil.ts` — será **reutilizada sem cópia**.

---

## Task 1: Server action `atualizarPerfilContaAction`

**Files:**
- Create: `app/actions/configuracoes/conta.ts`
- Create: `tests/configuracoes/conta.test.ts`

- [ ] **Step 1: Escrever o teste**

`tests/configuracoes/conta.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { atualizarPerfilContaAction } from '@/app/actions/configuracoes/conta'

function fd(obj: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(obj)) f.append(k, v)
  return f
}

describe('atualizarPerfilContaAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejeita se não autenticado', async () => {
    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })
    const r = await atualizarPerfilContaAction(fd({ nome: 'João' }))
    expect(r).toEqual({ error: 'Não autenticado.' })
  })

  it('rejeita nome com menos de 3 caracteres', async () => {
    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
    })
    const r = await atualizarPerfilContaAction(fd({ nome: 'Jo' }))
    expect(r.error).toMatch(/3 caracteres/)
  })

  it('atualiza user_metadata.nome via auth.updateUser', async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null })
    ;(createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
        updateUser,
      },
    })
    const r = await atualizarPerfilContaAction(fd({ nome: 'João Silva' }))
    expect(r).toEqual({ success: true })
    expect(updateUser).toHaveBeenCalledWith({ data: { nome: 'João Silva' } })
  })

  it('retorna erro se updateUser falhar', async () => {
    ;(createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
        updateUser: vi.fn().mockResolvedValue({ error: { message: 'boom' } }),
      },
    })
    const r = await atualizarPerfilContaAction(fd({ nome: 'João' }))
    expect(r.error).toMatch(/atualizar/i)
  })
})
```

- [ ] **Step 2: Rodar teste e ver falhar**

Run: `npm test -- conta`
Expected: FAIL — `Cannot find module '@/app/actions/configuracoes/conta'`.

- [ ] **Step 3: Implementar a action**

`app/actions/configuracoes/conta.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function atualizarPerfilContaAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const nome = (formData.get('nome') as string)?.trim()
  if (!nome || nome.length < 3) {
    return { error: 'Nome deve ter pelo menos 3 caracteres.' }
  }

  const { error } = await supabase.auth.updateUser({ data: { nome } })
  if (error) return { error: 'Erro ao atualizar perfil. Tente novamente.' }

  revalidatePath('/admin/configuracoes/conta')
  return { success: true }
}
```

- [ ] **Step 4: Rodar teste e ver passar**

Run: `npm test -- conta`
Expected: 4 passed.

- [ ] **Step 5: Commit + push**

```bash
git add app/actions/configuracoes/conta.ts tests/configuracoes/conta.test.ts
git commit -m "feat(conta): atualizarPerfilContaAction + testes"
git push -u origin feat/configuracoes-conta
```

---

## Task 2: Server actions MFA (`iniciar` / `verificar` / `desativar` / `listar`)

**Files:**
- Modify: `app/actions/configuracoes/conta.ts` (append)
- Modify: `tests/configuracoes/conta.test.ts` (append)

- [ ] **Step 1: Adicionar testes**

Append em `tests/configuracoes/conta.test.ts`:

```typescript
import {
  iniciarMfaAction,
  verificarMfaAction,
  desativarMfaAction,
  listarFatoresMfaAction,
} from '@/app/actions/configuracoes/conta'

describe('MFA actions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('iniciarMfaAction retorna { factorId, qrCode, secret } no sucesso', async () => {
    const enroll = vi.fn().mockResolvedValue({
      data: { id: 'fac1', totp: { qr_code: '<svg/>', secret: 'ABCDEF' } },
      error: null,
    })
    ;(createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
        mfa: { enroll },
      },
    })
    const r = await iniciarMfaAction()
    expect(r).toEqual({ factorId: 'fac1', qrCode: '<svg/>', secret: 'ABCDEF' })
    expect(enroll).toHaveBeenCalledWith({ factorType: 'totp' })
  })

  it('iniciarMfaAction retorna erro se enroll falhar', async () => {
    ;(createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
        mfa: { enroll: vi.fn().mockResolvedValue({ data: null, error: { message: 'x' } }) },
      },
    })
    const r = await iniciarMfaAction()
    expect(r).toHaveProperty('error')
  })

  it('verificarMfaAction chama challenge + verify', async () => {
    const challenge = vi.fn().mockResolvedValue({ data: { id: 'chl1' }, error: null })
    const verify = vi.fn().mockResolvedValue({ data: {}, error: null })
    ;(createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
        mfa: { challenge, verify },
      },
    })
    const r = await verificarMfaAction({ factorId: 'fac1', codigo: '123456' })
    expect(r).toEqual({ success: true })
    expect(challenge).toHaveBeenCalledWith({ factorId: 'fac1' })
    expect(verify).toHaveBeenCalledWith({ factorId: 'fac1', challengeId: 'chl1', code: '123456' })
  })

  it('verificarMfaAction retorna erro se código for inválido', async () => {
    ;(createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
        mfa: {
          challenge: vi.fn().mockResolvedValue({ data: { id: 'chl1' }, error: null }),
          verify: vi.fn().mockResolvedValue({ data: null, error: { message: 'invalid' } }),
        },
      },
    })
    const r = await verificarMfaAction({ factorId: 'fac1', codigo: '000000' })
    expect(r.error).toMatch(/c[óo]digo/i)
  })

  it('desativarMfaAction chama unenroll', async () => {
    const unenroll = vi.fn().mockResolvedValue({ error: null })
    ;(createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
        mfa: { unenroll },
      },
    })
    const r = await desativarMfaAction({ factorId: 'fac1' })
    expect(r).toEqual({ success: true })
    expect(unenroll).toHaveBeenCalledWith({ factorId: 'fac1' })
  })

  it('listarFatoresMfaAction retorna lista de TOTP factors verificados', async () => {
    ;(createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
        mfa: {
          listFactors: vi.fn().mockResolvedValue({
            data: { totp: [{ id: 'fac1', friendly_name: 'Authenticator', status: 'verified' }], all: [] },
            error: null,
          }),
        },
      },
    })
    const r = await listarFatoresMfaAction()
    expect(r.factors).toHaveLength(1)
    expect(r.factors![0].id).toBe('fac1')
  })
})
```

- [ ] **Step 2: Rodar testes e ver falhar**

Run: `npm test -- conta`
Expected: FAIL — exports não encontrados.

- [ ] **Step 3: Implementar as 4 actions**

Append em `app/actions/configuracoes/conta.ts`:

```typescript

// ── MFA ───────────────────────────────────────────────────────────────────────

export async function iniciarMfaAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
  if (error || !data) return { error: 'Não foi possível iniciar o MFA. Tente novamente.' }

  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  }
}

export async function verificarMfaAction(input: { factorId: string; codigo: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { factorId, codigo } = input
  if (!factorId || !codigo || codigo.length !== 6) {
    return { error: 'Código inválido.' }
  }

  const challenge = await supabase.auth.mfa.challenge({ factorId })
  if (challenge.error || !challenge.data) {
    return { error: 'Não foi possível validar o código. Tente novamente.' }
  }

  const verify = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.data.id,
    code: codigo,
  })

  if (verify.error) {
    return { error: 'Código incorreto. Verifique o app autenticador.' }
  }

  revalidatePath('/admin/configuracoes/conta')
  return { success: true }
}

export async function desativarMfaAction(input: { factorId: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { error } = await supabase.auth.mfa.unenroll({ factorId: input.factorId })
  if (error) return { error: 'Erro ao desativar MFA.' }

  revalidatePath('/admin/configuracoes/conta')
  return { success: true }
}

export async function listarFatoresMfaAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error || !data) return { factors: [] as Array<{ id: string; friendly_name: string | null; status: string }> }

  return {
    factors: (data.totp ?? []).filter(f => f.status === 'verified').map(f => ({
      id: f.id,
      friendly_name: f.friendly_name ?? null,
      status: f.status,
    })),
  }
}
```

- [ ] **Step 4: Rodar testes e ver passar**

Run: `npm test -- conta`
Expected: todos passando (4 do perfil + 6 do MFA = 10).

- [ ] **Step 5: Commit + push**

```bash
git add app/actions/configuracoes/conta.ts tests/configuracoes/conta.test.ts
git commit -m "feat(conta): server actions de MFA (enroll/verify/unenroll/list)"
git push
```

---

## Task 3: Server action `encerrarOutrasSessoesAction`

**Files:**
- Modify: `app/actions/configuracoes/conta.ts` (append)
- Modify: `tests/configuracoes/conta.test.ts` (append)

- [ ] **Step 1: Adicionar teste**

Append em `tests/configuracoes/conta.test.ts`:

```typescript
import { encerrarOutrasSessoesAction } from '@/app/actions/configuracoes/conta'

describe('encerrarOutrasSessoesAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('chama signOut com scope "others"', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null })
    ;(createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
        signOut,
      },
    })
    const r = await encerrarOutrasSessoesAction()
    expect(r).toEqual({ success: true })
    expect(signOut).toHaveBeenCalledWith({ scope: 'others' })
  })

  it('retorna erro se signOut falhar', async () => {
    ;(createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
        signOut: vi.fn().mockResolvedValue({ error: { message: 'x' } }),
      },
    })
    const r = await encerrarOutrasSessoesAction()
    expect(r.error).toBeDefined()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- conta`
Expected: FAIL — export não encontrado.

- [ ] **Step 3: Implementar**

Append em `app/actions/configuracoes/conta.ts`:

```typescript

// ── Sessões ───────────────────────────────────────────────────────────────────

export async function encerrarOutrasSessoesAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { error } = await supabase.auth.signOut({ scope: 'others' })
  if (error) return { error: 'Erro ao encerrar sessões.' }

  return { success: true }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- conta`
Expected: 12 passed.

- [ ] **Step 5: Commit + push**

```bash
git add app/actions/configuracoes/conta.ts tests/configuracoes/conta.test.ts
git commit -m "feat(conta): encerrarOutrasSessoesAction"
git push
```

---

## Task 4: Página `/admin/configuracoes/conta/page.tsx`

**Files:**
- Create: `app/(admin)/admin/configuracoes/conta/page.tsx`

- [ ] **Step 1: Criar o arquivo**

```typescript
import { createClient } from '@/lib/supabase/server'
import { listarFatoresMfaAction } from '@/app/actions/configuracoes/conta'
import { DadosPessoaisForm } from './DadosPessoaisForm'
import { SenhaForm } from './SenhaForm'
import { MfaCard } from './MfaCard'
import { SessoesCard } from './SessoesCard'

export default async function ContaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const fatores = await listarFatoresMfaAction()
  const mfaAtivo = 'factors' in fatores && (fatores.factors?.length ?? 0) > 0
  const factorId = mfaAtivo ? fatores.factors![0].id : null

  const nomeAtual = (user.user_metadata as any)?.nome ?? ''
  const emailAtual = user.email ?? ''

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginBottom: 24 }}>
        Minha Conta
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720 }}>
        <Card titulo="Dados pessoais">
          <DadosPessoaisForm nomeAtual={nomeAtual} emailAtual={emailAtual} />
        </Card>

        <Card titulo="Alterar senha">
          <SenhaForm />
        </Card>

        <Card titulo="Autenticação em dois fatores (MFA)">
          <MfaCard mfaAtivo={mfaAtivo} factorId={factorId} />
        </Card>

        <Card titulo="Sessões ativas">
          <SessoesCard />
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

- [ ] **Step 2: Verificar tsc**

Run: `npx tsc --noEmit`
Expected: erros sobre os 4 componentes que ainda não existem.

> **Não commita ainda.** Os 4 client components serão criados nas próximas tarefas. A página só passa no tsc depois disso.

---

## Task 5: `DadosPessoaisForm` (client component)

**Files:**
- Create: `app/(admin)/admin/configuracoes/conta/DadosPessoaisForm.tsx`

- [ ] **Step 1: Criar o componente**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { atualizarPerfilContaAction } from '@/app/actions/configuracoes/conta'

export function DadosPessoaisForm({
  nomeAtual,
  emailAtual,
}: {
  nomeAtual: string
  emailAtual: string
}) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  async function onSubmit(formData: FormData) {
    setMsg(null)
    startTransition(async () => {
      const r = await atualizarPerfilContaAction(formData)
      if ('error' in r && r.error) {
        setMsg({ tipo: 'erro', texto: r.error })
      } else {
        setMsg({ tipo: 'ok', texto: 'Salvo!' })
      }
    })
  }

  return (
    <form action={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Field label="Nome">
        <input
          name="nome"
          defaultValue={nomeAtual}
          minLength={3}
          required
          style={inputStyle}
        />
      </Field>

      <Field label="E-mail (somente leitura)">
        <input value={emailAtual} disabled style={{ ...inputStyle, opacity: 0.6 }} />
      </Field>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="submit" disabled={pending} style={btnPrimary}>
          {pending ? 'Salvando…' : 'Salvar'}
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

const inputStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.25)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: '10px 12px',
  color: '#f8fafc',
  fontSize: 14,
  outline: 'none',
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

- [ ] **Step 2: Commit (ainda sem ver tsc passar — outros componentes faltam)**

```bash
git add app/\(admin\)/admin/configuracoes/conta/DadosPessoaisForm.tsx
git commit -m "feat(conta): DadosPessoaisForm (client)"
git push
```

---

## Task 6: `SenhaForm` (client component reutilizando `alterarSenhaAction`)

**Files:**
- Create: `app/(admin)/admin/configuracoes/conta/SenhaForm.tsx`

- [ ] **Step 1: Criar o componente**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { alterarSenhaAction } from '@/app/actions/perfil'

export function SenhaForm() {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  async function onSubmit(formData: FormData) {
    setMsg(null)

    const nova = formData.get('nova_senha') as string
    const conf = formData.get('confirma_senha') as string
    if (nova !== conf) {
      setMsg({ tipo: 'erro', texto: 'As senhas não coincidem.' })
      return
    }
    if (nova.length < 8) {
      setMsg({ tipo: 'erro', texto: 'A nova senha deve ter pelo menos 8 caracteres.' })
      return
    }

    startTransition(async () => {
      const r = await alterarSenhaAction(formData)
      if ('error' in r && r.error) {
        setMsg({ tipo: 'erro', texto: r.error })
      } else {
        setMsg({ tipo: 'ok', texto: 'Senha alterada com sucesso!' })
      }
    })
  }

  return (
    <form action={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Field label="Senha atual">
        <input name="senha_atual" type="password" required style={inputStyle} />
      </Field>
      <Field label="Nova senha (mín. 8 caracteres)">
        <input name="nova_senha" type="password" required minLength={8} style={inputStyle} />
      </Field>
      <Field label="Confirmar nova senha">
        <input name="confirma_senha" type="password" required minLength={8} style={inputStyle} />
      </Field>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="submit" disabled={pending} style={btnPrimary}>
          {pending ? 'Alterando…' : 'Alterar senha'}
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

const inputStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.25)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: '10px 12px',
  color: '#f8fafc',
  fontSize: 14,
  outline: 'none',
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

- [ ] **Step 2: Commit**

```bash
git add app/\(admin\)/admin/configuracoes/conta/SenhaForm.tsx
git commit -m "feat(conta): SenhaForm reutiliza alterarSenhaAction"
git push
```

---

## Task 7: `MfaCard` (client component com state machine)

**Files:**
- Create: `app/(admin)/admin/configuracoes/conta/MfaCard.tsx`

- [ ] **Step 1: Criar o componente**

```typescript
'use client'

import { useState, useTransition } from 'react'
import {
  iniciarMfaAction,
  verificarMfaAction,
  desativarMfaAction,
} from '@/app/actions/configuracoes/conta'

type Estado =
  | { kind: 'idle' }
  | { kind: 'iniciando' }
  | { kind: 'enrolling'; factorId: string; qrCode: string; secret: string }
  | { kind: 'verificando' }
  | { kind: 'erro'; mensagem: string }

export function MfaCard({
  mfaAtivo,
  factorId,
}: {
  mfaAtivo: boolean
  factorId: string | null
}) {
  const [pending, startTransition] = useTransition()
  const [estado, setEstado] = useState<Estado>({ kind: 'idle' })
  const [codigo, setCodigo] = useState('')

  function iniciar() {
    setEstado({ kind: 'iniciando' })
    startTransition(async () => {
      const r = await iniciarMfaAction()
      if ('error' in r && r.error) {
        setEstado({ kind: 'erro', mensagem: r.error })
        return
      }
      setEstado({
        kind: 'enrolling',
        factorId: r.factorId!,
        qrCode: r.qrCode!,
        secret: r.secret!,
      })
    })
  }

  function verificar() {
    if (estado.kind !== 'enrolling') return
    if (codigo.length !== 6) return
    const fId = estado.factorId
    setEstado({ kind: 'verificando' })
    startTransition(async () => {
      const r = await verificarMfaAction({ factorId: fId, codigo })
      if ('error' in r && r.error) {
        setEstado({ kind: 'erro', mensagem: r.error })
        return
      }
      window.location.reload()
    })
  }

  function desativar() {
    if (!factorId) return
    if (!confirm('Desativar MFA? Você perderá a proteção da segunda etapa.')) return
    startTransition(async () => {
      const r = await desativarMfaAction({ factorId })
      if ('error' in r && r.error) {
        setEstado({ kind: 'erro', mensagem: r.error })
        return
      }
      window.location.reload()
    })
  }

  // ─── MFA já ativo ────────────────────────────────────────
  if (mfaAtivo && factorId) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: '#22c55e' }} />
          <span style={{ fontSize: 14, color: '#cbd5e1' }}>MFA ativo</span>
        </div>
        <button onClick={desativar} disabled={pending} style={btnDanger}>
          {pending ? 'Desativando…' : 'Desativar MFA'}
        </button>
      </div>
    )
  }

  // ─── Enrolling (mostra QR + input) ───────────────────────
  if (estado.kind === 'enrolling') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: 13, color: '#94a3b8' }}>
          Escaneie o QR no seu app autenticador (Authy, 1Password, Google Authenticator…)
          e cole o código de 6 dígitos abaixo.
        </p>

        <div
          dangerouslySetInnerHTML={{ __html: estado.qrCode }}
          style={{ background: '#fff', padding: 12, borderRadius: 10, width: 'fit-content' }}
        />

        <code style={{ fontSize: 12, color: '#94a3b8', wordBreak: 'break-all' }}>
          Secret manual: {estado.secret}
        </code>

        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          value={codigo}
          onChange={e => setCodigo(e.target.value.replace(/\D/g, ''))}
          style={{ ...inputStyle, letterSpacing: '0.3em', fontFamily: 'monospace' }}
        />

        <button onClick={verificar} disabled={pending || codigo.length !== 6} style={btnPrimary}>
          {pending ? 'Verificando…' : 'Confirmar e ativar'}
        </button>
      </div>
    )
  }

  // ─── Idle / erro ─────────────────────────────────────────
  return (
    <div>
      <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>
        Adicione uma camada extra de segurança usando um app autenticador.
      </p>
      <button onClick={iniciar} disabled={pending} style={btnPrimary}>
        {estado.kind === 'iniciando' ? 'Carregando…' : 'Ativar MFA'}
      </button>
      {estado.kind === 'erro' && (
        <p style={{ fontSize: 13, color: '#ef4444', marginTop: 8 }}>{estado.mensagem}</p>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.25)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: '10px 12px',
  color: '#f8fafc',
  fontSize: 18,
  outline: 'none',
  textAlign: 'center',
  width: 160,
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

const btnDanger: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(239,68,68,0.4)',
  borderRadius: 10,
  padding: '8px 16px',
  color: '#ef4444',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(admin\)/admin/configuracoes/conta/MfaCard.tsx
git commit -m "feat(conta): MfaCard com fluxo enroll → verify → enrolled"
git push
```

---

## Task 8: `SessoesCard` (client component)

**Files:**
- Create: `app/(admin)/admin/configuracoes/conta/SessoesCard.tsx`

- [ ] **Step 1: Criar o componente**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { encerrarOutrasSessoesAction } from '@/app/actions/configuracoes/conta'

export function SessoesCard() {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  function encerrar() {
    if (!confirm('Encerrar todas as outras sessões deste usuário?')) return
    setMsg(null)
    startTransition(async () => {
      const r = await encerrarOutrasSessoesAction()
      if ('error' in r && r.error) {
        setMsg({ tipo: 'erro', texto: r.error })
      } else {
        setMsg({ tipo: 'ok', texto: 'Outras sessões encerradas.' })
      }
    })
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>
        Encerra todas as outras sessões deste usuário em outros navegadores ou dispositivos.
        Esta sessão atual continua ativa.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={encerrar} disabled={pending} style={btnDanger}>
          {pending ? 'Encerrando…' : 'Encerrar outras sessões'}
        </button>
        {msg && (
          <span style={{ fontSize: 13, color: msg.tipo === 'ok' ? '#22c55e' : '#ef4444' }}>
            {msg.texto}
          </span>
        )}
      </div>
    </div>
  )
}

const btnDanger: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(239,68,68,0.4)',
  borderRadius: 10,
  padding: '8px 16px',
  color: '#ef4444',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
}
```

- [ ] **Step 2: Verificar tsc passa**

Run: `npx tsc --noEmit`
Expected: 0 erros (todos os 4 client components agora existem).

- [ ] **Step 3: Commit + push (com a página da Task 4 que ficou pendente)**

```bash
git add app/\(admin\)/admin/configuracoes/conta/SessoesCard.tsx app/\(admin\)/admin/configuracoes/conta/page.tsx
git commit -m "feat(conta): SessoesCard + página /admin/configuracoes/conta"
git push
```

---

## Task 9: Smoke test final

**Files:** nenhum

- [ ] **Step 1: Suite completa de testes**

Run: `npm test`
Expected: 19 testes passando (13 anteriores + 4 perfil + 6 MFA + 2 sessões = 25; corrija pra esse total).

> Total real após Task 1+2+3 = **13 + 4 + 6 + 2 = 25 testes**.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: sucesso. A rota `/admin/configuracoes/conta` deve aparecer na listagem.

- [ ] **Step 3: Smoke test manual**

Run: `npm run dev`

1. Login como admin → abrir `/admin/configuracoes/conta`
2. **Dados pessoais:** alterar nome → clicar Salvar → confirmar "Salvo!" verde
3. Recarregar página → confirmar que nome novo persistiu (lê de `user_metadata.nome`)
4. **Alterar senha:** preencher senha atual + nova válida → confirmar sucesso. Tentar de novo com senha atual errada → ver mensagem de erro. Tentar com confirmação diferente → ver erro client-side.
5. **MFA:** clicar "Ativar MFA" → QR aparece → escanear no app autenticador → digitar código de 6 dígitos → confirmar ativação. Depois clicar "Desativar MFA" → confirmar.
6. **Sessões:** clicar "Encerrar outras sessões" → confirmar mensagem de sucesso. (Pra testar real: logue em outro navegador antes; após clicar, esse outro deve ser deslogado.)

- [ ] **Step 4: Confirmar Vercel deploy ok**

A branch já tem push em todas as tarefas; o último push (Task 8) dispara o preview do Vercel. Verifique no PR (ou em vercel.com → projeto edu-store) que o deploy está ✓ Ready.

- [ ] **Step 5: Abrir PR**

Manual via GitHub (gh CLI não está instalado). Acesse:

`https://github.com/wsapao/EduStore/compare/main...feat/configuracoes-conta`

Título sugerido:

```
feat: Módulo Conta — perfil, senha, MFA e sessões
```

Body sugerido:

```markdown
## Summary

Implementa `/admin/configuracoes/conta` com 4 funcionalidades sobre a conta do usuário logado:

- **Dados pessoais:** editar nome (atualiza `user_metadata.nome`).
- **Alterar senha:** reutiliza a action `alterarSenhaAction` já existente em `app/actions/perfil.ts` (verifica senha atual via re-login).
- **MFA (TOTP):** fluxo completo enroll → verify → enrolled → unenroll via Supabase Auth MFA.
- **Encerrar outras sessões:** chama `signOut({ scope: 'others' })`.

Server actions em `app/actions/configuracoes/conta.ts` cobertas por **12 novos testes Vitest** (mock de Supabase Auth).

## Test plan

- [ ] Login admin → `/admin/configuracoes/conta` carrega com 4 cards
- [ ] Editar nome e salvar → recarregar e confirmar persistência
- [ ] Trocar senha com senha atual correta → sucesso
- [ ] Trocar senha com senha atual errada → erro "Senha atual incorreta"
- [ ] Senhas que não coincidem → erro client-side
- [ ] Ativar MFA → escanear QR → confirmar código → MFA ativo
- [ ] Desativar MFA → confirma → MFA inativo
- [ ] Encerrar outras sessões → confirma sucesso (validar abrindo segunda sessão antes)
- [ ] `npm test` → 25 passing
- [ ] `npm run build` → ok
```

---

## Definition of Done

- [ ] 4 cards renderizando em `/admin/configuracoes/conta`
- [ ] Editar nome funciona e persiste
- [ ] Alterar senha funciona (com verificação de senha atual)
- [ ] MFA: ativar com QR/código + desativar funcionam
- [ ] "Encerrar outras sessões" funciona
- [ ] 25 testes passando (`npm test`)
- [ ] `tsc --noEmit` limpo, `npm run build` sem erros
- [ ] PR aberto pra `main`

## Próximo plano após Conta

**Plano 3: Módulo Identidade & Personalização** (`/admin/configuracoes/loja`) — formulário pra editar nome/CNPJ/razão social/slogan/boas-vindas + upload de logo/banner/favicon + endereço fiscal.
