# Edição de Responsável (com sincronia do e-mail de login) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que um admin edite nome, e-mail e telefone de um responsável pela interface, mantendo o e-mail de login (`auth.users`) em sincronia com `public.responsaveis`, com auditoria e aviso de segurança por e-mail.

**Architecture:** Next.js Server Action usando o cliente service role (`createAdminClient`) para chamar a Admin API do Auth (`auth.admin.updateUserById` com `email_confirm: true`). UI em um client component (dialog) acoplado à tela de responsáveis já existente. Toda alteração passa por gate de permissão + isolamento por escola, é auditada e notifica os e-mails antigo e novo.

**Tech Stack:** Next.js (App Router, server actions), `@supabase/supabase-js` (Admin API), Resend (`lib/email`), Vitest, Tailwind/inline styles, `sonner` (toasts).

**Spec:** `docs/superpowers/specs/2026-06-03-edicao-responsavel-design.md`

---

## File Structure

- **Modify** `lib/email/templates.ts` — novo template `emailAvisoTrocaEmail` + tipo `EmailAvisoTrocaEmailParams`.
- **Modify** `lib/email/send.ts` — nova função `enviarEmailAvisoTrocaEmail`.
- **Create** `app/actions/responsaveis.ts` — server action `editarResponsavelAction`.
- **Create** `tests/responsaveis/editar-action.test.ts` — testes da action.
- **Create** `app/(admin)/admin/responsaveis/EditarResponsavelDialog.tsx` — client component (botão + modal + form).
- **Modify** `app/(admin)/admin/responsaveis/page.tsx` — renderiza o dialog em cada linha.

Convenções observadas no código (siga-as):
- Actions retornam `{ success: boolean; error?: string }` (ver `app/actions/admin.ts`).
- `createAdminClient()` de `@/lib/supabase/admin` para service role.
- `auditLog({ modulo, acao, descricao, metadata })` de `@/lib/auditoria/log` (best-effort, resolve user/escola/IP sozinho).
- Templates de e-mail usam `base(title, content)` e retornam `{ subject, html }`.
- Envio de e-mail é best-effort: `getResend()` retorna `null` sem `RESEND_API_KEY` e a função apenas retorna.

---

## Task 1: Template e envio do aviso de troca de e-mail

**Files:**
- Modify: `lib/email/templates.ts` (adicionar ao final, antes do último export se houver)
- Modify: `lib/email/send.ts` (adicionar import + função)
- Test: `tests/responsaveis/email-aviso-troca.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/responsaveis/email-aviso-troca.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { emailAvisoTrocaEmail } from '@/lib/email/templates'

describe('emailAvisoTrocaEmail', () => {
  it('inclui nome, e-mail antigo e novo no corpo', () => {
    const { subject, html } = emailAvisoTrocaEmail({
      responsavelNome: 'Maria Silva',
      emailAntigo: 'errado@exemplo.com',
      emailNovo: 'certo@exemplo.com',
    })
    expect(subject.toLowerCase()).toContain('e-mail')
    expect(html).toContain('Maria Silva')
    expect(html).toContain('errado@exemplo.com')
    expect(html).toContain('certo@exemplo.com')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/responsaveis/email-aviso-troca.test.ts`
Expected: FAIL — `emailAvisoTrocaEmail` is not exported.

- [ ] **Step 3: Add the template**

In `lib/email/templates.ts`, append:

```ts
export interface EmailAvisoTrocaEmailParams {
  responsavelNome: string
  emailAntigo: string
  emailNovo: string
}

export function emailAvisoTrocaEmail(
  p: EmailAvisoTrocaEmailParams,
): { subject: string; html: string } {
  const content = `
    <h2 style="margin:0 0 4px;font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-.02em;">
      ✉️ Seu e-mail de acesso foi alterado
    </h2>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.6;">
      Olá, <strong>${p.responsavelNome}</strong>! O e-mail de acesso da sua conta na Loja Escolar foi atualizado pela administração da escola.
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin-bottom:24px;font-size:13px;color:#334155;line-height:1.8;">
      <div>E-mail anterior: <strong>${p.emailAntigo}</strong></div>
      <div>Novo e-mail de acesso: <strong>${p.emailNovo}</strong></div>
    </div>

    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px 20px;margin-bottom:8px;">
      <div style="font-size:13px;color:#9a3412;line-height:1.7;">
        Se você não reconhece esta alteração, entre em contato imediatamente com a secretaria da escola.
      </div>
    </div>
  `

  return {
    subject: 'Seu e-mail de acesso à Loja Escolar foi alterado',
    html: base('E-mail de acesso alterado', content),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/responsaveis/email-aviso-troca.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the send function**

In `lib/email/send.ts`, add to the import block from `./templates`:

```ts
  emailAvisoTrocaEmail,
  type EmailAvisoTrocaEmailParams,
```

Then append at the end of the file:

```ts
// ── Aviso de troca de e-mail de acesso ────────────────────────────────────────
export async function enviarEmailAvisoTrocaEmail(
  to: string,
  params: EmailAvisoTrocaEmailParams,
) {
  const resend = getResend()
  if (!resend) return

  const { subject, html } = emailAvisoTrocaEmail(params)

  try {
    await resend.emails.send({ from: EMAIL_FROM, to, subject, html })
  } catch (err) {
    console.error('[Email] Erro ao enviar aviso de troca de e-mail:', err)
  }
}
```

- [ ] **Step 6: Verify build of the module compiles**

Run: `npx tsc --noEmit`
Expected: no new type errors related to `lib/email`.

- [ ] **Step 7: Commit**

```bash
git add lib/email/templates.ts lib/email/send.ts tests/responsaveis/email-aviso-troca.test.ts
git commit -m "feat(email): template e envio de aviso de troca de e-mail"
```

---

## Task 2: Server action `editarResponsavelAction`

**Files:**
- Create: `app/actions/responsaveis.ts`
- Test: `tests/responsaveis/editar-action.test.ts`

**Behavior contract:**
- Gate: usuário autenticado E (`app_metadata.role === 'admin'` OU permissão `responsaveis.editar`).
- Isolamento: só edita responsável da mesma `escola_id` do admin.
- Bloqueia se `excluido_em` preenchido.
- Valida nome (não vazio) e e-mail (regex). Telefone opcional (vazio → `null`).
- Se e-mail mudou: rejeita duplicado (em `responsaveis`), atualiza `responsaveis`, então `auth.admin.updateUserById(id, { email, email_confirm: true })`; se o Auth falhar, **reverte** `responsaveis`.
- Sempre: `auditLog` com de→para. Se e-mail mudou: envia aviso para e-mail antigo e novo.
- Retorna `{ success: boolean; error?: string }`.

- [ ] **Step 1: Write the failing test**

Create `tests/responsaveis/editar-action.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/permissoes/getUserPermissions', () => ({ getUserPermissions: vi.fn() }))
vi.mock('@/lib/auditoria/log', () => ({ auditLog: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/email/send', () => ({ enviarEmailAvisoTrocaEmail: vi.fn().mockResolvedValue(undefined) }))

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserPermissions } from '@/lib/permissoes/getUserPermissions'
import { auditLog } from '@/lib/auditoria/log'
import { enviarEmailAvisoTrocaEmail } from '@/lib/email/send'
import { editarResponsavelAction } from '@/app/actions/responsaveis'

// Builder thenable: cada chamada terminal (single/maybeSingle) ou await consome
// o próximo resultado da fila, na ordem em que o código chama.
function queueBuilder(results: any[]) {
  let i = 0
  const next = () => results[i++] ?? { data: null, error: null }
  const builder: any = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') return (resolve: any) => resolve(next())
        if (prop === 'single' || prop === 'maybeSingle') return () => Promise.resolve(next())
        return () => builder
      },
    },
  )
  return builder
}

function makeForm(data: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(data)) fd.set(k, v)
  return fd
}

const ADMIN_USER = { id: 'admin-1', app_metadata: { role: 'admin' } }
const ALVO = {
  id: 'resp-9',
  nome: 'Maria',
  email: 'errado@exemplo.com',
  telefone: '11999999999',
  escola_id: 'esc-1',
  excluido_em: null,
}

function setupServerClient(user: any = ADMIN_USER, escolaId = 'esc-1') {
  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => queueBuilder([{ data: { escola_id: escolaId } }])),
  }
  ;(createClient as any).mockResolvedValue(supabase)
  return supabase
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(getUserPermissions as any).mockResolvedValue([])
})

describe('editarResponsavelAction', () => {
  it('nega acesso para usuário sem role admin e sem permissão', async () => {
    setupServerClient({ id: 'u', app_metadata: {} })
    ;(getUserPermissions as any).mockResolvedValue([])
    const res = await editarResponsavelAction(
      makeForm({ responsavel_id: 'resp-9', nome: 'Maria', email: 'a@b.com' }),
    )
    expect(res).toEqual({ success: false, error: 'Acesso negado.' })
  })

  it('troca o e-mail: atualiza tabela, chama Auth confirmado, audita e avisa', async () => {
    setupServerClient()
    const updateUserById = vi.fn().mockResolvedValue({ error: null })
    const admin = {
      from: vi.fn(() =>
        queueBuilder([
          { data: ALVO },          // select alvo .single()
          { data: null },          // checagem de duplicidade .maybeSingle()
          { error: null },         // update responsaveis (await)
        ]),
      ),
      auth: { admin: { updateUserById } },
    }
    ;(createAdminClient as any).mockReturnValue(admin)

    const res = await editarResponsavelAction(
      makeForm({
        responsavel_id: 'resp-9',
        nome: 'Maria Silva',
        email: 'certo@exemplo.com',
        telefone: '11988887777',
      }),
    )

    expect(res).toEqual({ success: true })
    expect(updateUserById).toHaveBeenCalledWith('resp-9', {
      email: 'certo@exemplo.com',
      email_confirm: true,
    })
    expect(auditLog).toHaveBeenCalledTimes(1)
    expect(enviarEmailAvisoTrocaEmail).toHaveBeenCalledTimes(2)
  })

  it('não chama o Auth quando o e-mail não muda', async () => {
    setupServerClient()
    const updateUserById = vi.fn()
    const admin = {
      from: vi.fn(() => queueBuilder([{ data: ALVO }, { error: null }])),
      auth: { admin: { updateUserById } },
    }
    ;(createAdminClient as any).mockReturnValue(admin)

    const res = await editarResponsavelAction(
      makeForm({ responsavel_id: 'resp-9', nome: 'Maria', email: 'errado@exemplo.com' }),
    )

    expect(res).toEqual({ success: true })
    expect(updateUserById).not.toHaveBeenCalled()
    expect(enviarEmailAvisoTrocaEmail).not.toHaveBeenCalled()
  })

  it('rejeita e-mail duplicado antes de tocar o Auth', async () => {
    setupServerClient()
    const updateUserById = vi.fn()
    const admin = {
      from: vi.fn(() =>
        queueBuilder([
          { data: ALVO },                 // alvo
          { data: { id: 'outro' } },      // duplicado encontrado
        ]),
      ),
      auth: { admin: { updateUserById } },
    }
    ;(createAdminClient as any).mockReturnValue(admin)

    const res = await editarResponsavelAction(
      makeForm({ responsavel_id: 'resp-9', nome: 'Maria', email: 'certo@exemplo.com' }),
    )

    expect(res.success).toBe(false)
    expect(updateUserById).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/responsaveis/editar-action.test.ts`
Expected: FAIL — `editarResponsavelAction` not found / module missing.

- [ ] **Step 3: Implement the action**

Create `app/actions/responsaveis.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserPermissions } from '@/lib/permissoes/getUserPermissions'
import { auditLog } from '@/lib/auditoria/log'
import { enviarEmailAvisoTrocaEmail } from '@/lib/email/send'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type ActionResult = { success: boolean; error?: string }

export async function editarResponsavelAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Acesso negado.' }

  const isAdmin = user.app_metadata?.role === 'admin'
  const perms = await getUserPermissions(supabase)
  if (!isAdmin && !perms.includes('responsaveis.editar')) {
    return { success: false, error: 'Acesso negado.' }
  }

  const responsavelId = (formData.get('responsavel_id') as string | null)?.trim()
  const nome = (formData.get('nome') as string | null)?.trim()
  const emailRaw = (formData.get('email') as string | null)?.trim().toLowerCase()
  const telefoneRaw = (formData.get('telefone') as string | null)?.trim()
  const telefone = telefoneRaw ? telefoneRaw : null

  if (!responsavelId) return { success: false, error: 'Responsável não informado.' }
  if (!nome) return { success: false, error: 'Nome é obrigatório.' }
  if (!emailRaw || !EMAIL_RE.test(emailRaw)) return { success: false, error: 'E-mail inválido.' }
  const email = emailRaw

  // escola do admin (isolamento multi-tenant)
  const { data: adminResp } = await supabase
    .from('responsaveis')
    .select('escola_id')
    .eq('id', user.id)
    .single()
  if (!adminResp?.escola_id) return { success: false, error: 'Admin sem escola vinculada.' }

  const admin = createAdminClient()

  const { data: alvo } = await admin
    .from('responsaveis')
    .select('id, nome, email, telefone, escola_id, excluido_em')
    .eq('id', responsavelId)
    .single()

  if (!alvo) return { success: false, error: 'Responsável não encontrado.' }
  if (alvo.escola_id !== adminResp.escola_id) return { success: false, error: 'Acesso negado.' }
  if (alvo.excluido_em) return { success: false, error: 'Não é possível editar uma conta removida.' }

  const emailAntigo = (alvo.email ?? '').toLowerCase()
  const emailMudou = email !== emailAntigo

  if (emailMudou) {
    const { data: dup } = await admin
      .from('responsaveis')
      .select('id')
      .eq('email', email)
      .neq('id', responsavelId)
      .maybeSingle()
    if (dup) return { success: false, error: 'Já existe um responsável com esse e-mail.' }
  }

  const { error: updErr } = await admin
    .from('responsaveis')
    .update({ nome, email, telefone })
    .eq('id', responsavelId)
  if (updErr) return { success: false, error: 'Falha ao atualizar os dados.' }

  if (emailMudou) {
    const { error: authErr } = await admin.auth.admin.updateUserById(responsavelId, {
      email,
      email_confirm: true,
    })
    if (authErr) {
      // rollback do update na tabela para nunca divergir de auth.users
      await admin
        .from('responsaveis')
        .update({ nome: alvo.nome, email: alvo.email, telefone: alvo.telefone })
        .eq('id', responsavelId)
      return {
        success: false,
        error: 'Não foi possível atualizar o e-mail de login. Tente outro e-mail.',
      }
    }
  }

  await auditLog({
    modulo: 'responsaveis',
    acao: 'editar',
    descricao: `Editou o responsável ${nome}`,
    metadata: {
      responsavel_id: responsavelId,
      de: { nome: alvo.nome, email: alvo.email, telefone: alvo.telefone },
      para: { nome, email, telefone },
    },
  })

  if (emailMudou) {
    await enviarEmailAvisoTrocaEmail(emailAntigo, {
      responsavelNome: nome,
      emailAntigo,
      emailNovo: email,
    })
    await enviarEmailAvisoTrocaEmail(email, {
      responsavelNome: nome,
      emailAntigo,
      emailNovo: email,
    })
  }

  revalidatePath('/admin/responsaveis')
  return { success: true }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/responsaveis/editar-action.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors in `app/actions/responsaveis.ts`.

- [ ] **Step 6: Commit**

```bash
git add app/actions/responsaveis.ts tests/responsaveis/editar-action.test.ts
git commit -m "feat(responsaveis): server action de edição com sincronia do e-mail de login"
```

---

## Task 3: UI de edição na tela de responsáveis

**Files:**
- Create: `app/(admin)/admin/responsaveis/EditarResponsavelDialog.tsx`
- Modify: `app/(admin)/admin/responsaveis/page.tsx`

- [ ] **Step 1: Create the client dialog component**

Create `app/(admin)/admin/responsaveis/EditarResponsavelDialog.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { editarResponsavelAction } from '@/app/actions/responsaveis'

interface Props {
  responsavel: {
    id: string
    nome: string
    email: string
    cpf: string
    telefone: string | null
  }
}

export function EditarResponsavelDialog({ responsavel }: Props) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await editarResponsavelAction(formData)
      if (res.success) {
        toast.success('Responsável atualizado.')
        setOpen(false)
      } else {
        toast.error(res.error ?? 'Falha ao atualizar.')
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          padding: '6px 12px',
          fontSize: 12,
          fontWeight: 700,
          borderRadius: 8,
          border: '1px solid #cbd5e1',
          background: '#fff',
          color: '#334155',
          cursor: 'pointer',
        }}
      >
        Editar
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 16,
          }}
          onClick={() => !pending && setOpen(false)}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: 24,
              width: '100%',
              maxWidth: 420,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
              Editar responsável
            </h3>

            <input type="hidden" name="responsavel_id" value={responsavel.id} />

            <label style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
              Nome
              <input
                name="nome"
                defaultValue={responsavel.nome}
                required
                style={inputStyle}
              />
            </label>

            <label style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
              E-mail (login)
              <input
                name="email"
                type="email"
                defaultValue={responsavel.email}
                required
                style={inputStyle}
              />
            </label>

            <label style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
              Telefone
              <input
                name="telefone"
                defaultValue={responsavel.telefone ?? ''}
                style={inputStyle}
              />
            </label>

            <label style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8' }}>
              CPF (não editável)
              <input value={responsavel.cpf} disabled style={{ ...inputStyle, background: '#f1f5f9' }} />
            </label>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                style={{ ...btnStyle, background: '#fff', color: '#334155', border: '1px solid #cbd5e1' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending}
                style={{ ...btnStyle, background: '#4f46e5', color: '#fff', border: 'none' }}
              >
                {pending ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 6,
  padding: '10px 12px',
  fontSize: 14,
  fontWeight: 500,
  borderRadius: 10,
  border: '1px solid #cbd5e1',
  color: '#0f172a',
}

const btnStyle: React.CSSProperties = {
  padding: '10px 18px',
  fontSize: 13,
  fontWeight: 700,
  borderRadius: 10,
  cursor: 'pointer',
}
```

- [ ] **Step 2: Wire the dialog into the page**

In `app/(admin)/admin/responsaveis/page.tsx`:

1. Add the import near the top (after the existing action imports):

```tsx
import { EditarResponsavelDialog } from './EditarResponsavelDialog'
```

2. Find where the row action button for `resetSenhaResponsavelAction` is rendered (search the file for `resetSenhaResponsavelAction`). In that same actions container, for the current row variable (the `.map((responsavel) => ...)` item), render the dialog:

```tsx
<EditarResponsavelDialog
  responsavel={{
    id: responsavel.id,
    nome: responsavel.nome,
    email: responsavel.email,
    cpf: responsavel.cpf,
    telefone: responsavel.telefone,
  }}
/>
```

> Note: the page already restricts access to `app_metadata.role === 'admin'` (redirect at the top), so the button is only reachable by admins. The action itself re-checks permission server-side.

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 4: Visual/manual verification (dev server)**

Run: `npm run dev`, log in as admin, open `/admin/responsaveis`, click **Editar** on a test row, change the telefone only, save → expect a success toast and the value updated after refresh. Then change the e-mail of a **test** account and confirm the toast + that the row reflects the new e-mail.

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/admin/responsaveis/EditarResponsavelDialog.tsx" "app/(admin)/admin/responsaveis/page.tsx"
git commit -m "feat(responsaveis): UI de edição (nome, e-mail, telefone) na tela admin"
```

---

## Task 4: Verificação ponta-a-ponta e correção do caso real

**Files:** nenhum (operacional)

- [ ] **Step 1: Rodar a suíte completa**

Run: `npm test`
Expected: todos os testes passam (incluindo os novos em `tests/responsaveis/`).

- [ ] **Step 2: Teste manual da troca de e-mail num usuário de teste**

Com um responsável de teste: trocar o e-mail pelo painel, depois deslogar e tentar **login** com o novo e-mail (a senha original deve funcionar) e o fluxo de **recuperar senha** deve enviar para o novo e-mail. Conferir uma linha nova em `auditoria_log` (`modulo='responsaveis'`, `acao='editar'`) e a chegada dos dois e-mails de aviso (se `RESEND_API_KEY` estiver configurado no ambiente).

- [ ] **Step 3: Corrigir a conta da responsável real**

Pelo painel `/admin/responsaveis`: localizar a conta com o e-mail digitado errado, clicar **Editar**, corrigir o e-mail para o correto, salvar. Confirmar com a responsável que ela consegue logar / recuperar a senha.

- [ ] **Step 4: Merge / deploy**

Seguir o fluxo do projeto (commit + push para o Vercel subir automaticamente). Abrir PR a partir de `feat/edicao-responsavel` ou fazer merge conforme a convenção da equipe.

---

## Self-Review (preenchido na escrita do plano)

- **Cobertura do spec:** gate de permissão (Task 2), isolamento por escola (Task 2), bloqueio de conta removida (Task 2), validação + duplicidade (Task 2), sincronia `auth.users` com `email_confirm:true` (Task 2), rollback em falha parcial (Task 2), auditoria (Task 2), aviso de e-mail antigo+novo (Task 1+2), UI com CPF read-only (Task 3), caso urgente (Task 4). ✔ Todas as seções do spec têm tarefa correspondente.
- **Placeholders:** nenhum "TBD/TODO"; todo passo de código mostra o código completo.
- **Consistência de tipos:** `editarResponsavelAction(formData: FormData) => { success, error? }` usado igual no teste, na action e na UI; `EmailAvisoTrocaEmailParams { responsavelNome, emailAntigo, emailNovo }` idêntico em template, send e chamadas.
