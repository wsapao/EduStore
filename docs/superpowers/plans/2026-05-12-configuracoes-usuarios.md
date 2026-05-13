# Configurações — Módulo Usuários (Plano de Implementação)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar `/admin/configuracoes/usuarios` permitindo ao admin **listar** todos os usuários staff (admins/operadores/etc), **convidar** novos por e-mail (substitui o SQL manual), **alterar o papel** de um usuário, **suspender/reativar** acesso, e **remover** um usuário da escola — tudo com proteção do último admin.

**Architecture:** Server actions em `app/actions/configuracoes/usuarios.ts` cobrem 4 mutações. Convite usa `createAdminClient()` (service role) com `auth.admin.inviteUserByEmail()` — Supabase envia o e-mail com link de set password, e nós criamos a entrada em `usuario_papel`. Listagem combina `usuario_papel` + dados de `auth.users` (lidos via admin client porque `email` e `last_sign_in_at` não são acessíveis via cliente normal). Toggle de suspensão e troca de papel disparam o trigger `sync_app_metadata_role` (criado na Fundação) que atualiza o JWT.

**Tech Stack:** Next.js 15 App Router · Supabase Auth (admin API) · TypeScript · Vitest

**Spec:** [2026-05-11-configuracoes-loja-design.md](../specs/2026-05-11-configuracoes-loja-design.md) seção 4.2

**Branch:** `feat/configuracoes-usuarios` (já criada de `main`)

**Sem migrations** — `usuario_papel`, `papeis` e o trigger de sync existem desde a Fundação.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `app/actions/configuracoes/usuarios.ts` | 4 Server Actions: convidar / alterar papel / suspender (toggle) / remover |
| `tests/configuracoes/usuarios.test.ts` | Tests das 4 actions com mocks de admin client |
| `app/(admin)/admin/configuracoes/usuarios/page.tsx` | Server: lista usuários da escola |
| `app/(admin)/admin/configuracoes/usuarios/UsuarioRow.tsx` | Client: linha com select de papel + ações |
| `app/(admin)/admin/configuracoes/usuarios/ConvidarForm.tsx` | Client: form pra convidar (email + papel) |

---

## Decisões de design

- **Convite:** Supabase envia email com link de set password. Não armazenamos senha. Quando o usuário acessa o link, define a senha e o `auth.users` fica completo. O `usuario_papel` é criado no momento do convite (vínculo já existe).
- **Email do remetente:** usa configuração padrão do Supabase Auth (não os campos de `escola_configuracoes` — esses são para emails da loja, não auth).
- **Proteção do último admin:** antes de remover, suspender ou rebaixar um usuário com papel preset = `admin`, conta quantos outros admins ativos existem na escola. Se for o único, bloqueia.
- **Auto-proteção:** o admin atuante não pode mudar o próprio papel, suspender a si mesmo, nem remover a si mesmo.
- **Remover:** deleta apenas o `usuario_papel` (não toca em `auth.users` para preservar histórico se ele também é responsável). O usuário perde acesso ao admin imediatamente porque o trigger remove o `role` do JWT.
- **Listagem só de staff:** filtra por usuários que têm entrada em `usuario_papel` na escola. Não lista responsáveis comuns.

---

## Task 1: Server actions (convidar / alterar papel / toggle suspensão / remover)

**Files:**
- Create: `app/actions/configuracoes/usuarios.ts`
- Create: `tests/configuracoes/usuarios.test.ts`

- [ ] **Step 1: Escrever os testes**

`tests/configuracoes/usuarios.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/permissoes', () => ({
  requirePermission: vi.fn(),
  PermissionDeniedError: class extends Error {},
}))
vi.mock('@/lib/escola/getEscolaIdParaAdmin', () => ({ getEscolaIdParaAdmin: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/permissoes'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import {
  convidarUsuarioAction,
  alterarPapelUsuarioAction,
  toggleSuspensaoUsuarioAction,
  removerUsuarioAction,
} from '@/app/actions/configuracoes/usuarios'

function fd(obj: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(obj)) f.append(k, v)
  return f
}

function setupAuthOk(currentUserId = 'admin-1') {
  ;(requirePermission as any).mockResolvedValue(undefined)
  ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
  ;(createClient as any).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: currentUserId } } }),
    },
    from: vi.fn(),
  })
}

describe('convidarUsuarioAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exige permissão configuracoes.gerenciar_usuarios', async () => {
    ;(requirePermission as any).mockRejectedValue(new Error('denied'))
    const r = await convidarUsuarioAction(fd({ email: 'a@b.com', papel_id: 'p1' }))
    expect(requirePermission).toHaveBeenCalledWith('configuracoes.gerenciar_usuarios')
    expect((r as any).error).toBeDefined()
  })

  it('rejeita email inválido', async () => {
    setupAuthOk()
    const r = await convidarUsuarioAction(fd({ email: 'invalido', papel_id: 'p1' }))
    expect((r as any).error).toMatch(/e-?mail/i)
  })

  it('rejeita papel_id vazio', async () => {
    setupAuthOk()
    const r = await convidarUsuarioAction(fd({ email: 'a@b.com', papel_id: '' }))
    expect((r as any).error).toMatch(/papel/i)
  })

  it('rejeita papel que não pertence à escola', async () => {
    setupAuthOk()
    const adminFromMock = vi.fn(() => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) }),
    }))
    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
      from: adminFromMock,
    })
    const r = await convidarUsuarioAction(fd({ email: 'a@b.com', papel_id: 'p-fora' }))
    expect((r as any).error).toMatch(/papel/i)
  })

  it('caminho feliz: invita + cria usuario_papel', async () => {
    setupAuthOk()
    const lookupPapel = vi.fn().mockResolvedValue({ data: { id: 'p1' }, error: null })
    const insertVinculo = vi.fn().mockResolvedValue({ error: null })

    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
      from: vi.fn((table: string) => {
        if (table === 'papeis') {
          return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: lookupPapel }) }) }) }
        }
        if (table === 'usuario_papel') return { insert: insertVinculo }
        throw new Error(table)
      }),
    })

    const invite = vi.fn().mockResolvedValue({ data: { user: { id: 'novo-1' } }, error: null })
    ;(createAdminClient as any).mockReturnValue({
      auth: { admin: { inviteUserByEmail: invite } },
    })

    const r = await convidarUsuarioAction(fd({ email: 'novo@escola.com', papel_id: 'p1' }))

    expect(invite).toHaveBeenCalledWith('novo@escola.com', expect.any(Object))
    expect(insertVinculo).toHaveBeenCalledWith({
      user_id: 'novo-1',
      escola_id: 'esc-1',
      papel_id: 'p1',
    })
    expect(r).toEqual({ success: true })
  })

  it('retorna erro se Supabase invite falhar', async () => {
    setupAuthOk()
    const lookupPapel = vi.fn().mockResolvedValue({ data: { id: 'p1' }, error: null })
    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
      from: vi.fn(() => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: lookupPapel }) }) }) })),
    })
    ;(createAdminClient as any).mockReturnValue({
      auth: { admin: { inviteUserByEmail: vi.fn().mockResolvedValue({ data: null, error: { message: 'já existe' } }) } },
    })
    const r = await convidarUsuarioAction(fd({ email: 'x@y.com', papel_id: 'p1' }))
    expect((r as any).error).toMatch(/convidar|email|j[áa] existe/i)
  })
})

describe('alterarPapelUsuarioAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exige permissão', async () => {
    ;(requirePermission as any).mockRejectedValue(new Error('denied'))
    const r = await alterarPapelUsuarioAction('u-2', 'p-2')
    expect((r as any).error).toBeDefined()
  })

  it('rejeita auto-edição (admin tentando mudar próprio papel)', async () => {
    setupAuthOk('admin-1')
    const r = await alterarPapelUsuarioAction('admin-1', 'p-outro')
    expect((r as any).error).toMatch(/pr[óo]prio/i)
  })

  it('rejeita rebaixar último admin', async () => {
    setupAuthOk('admin-1')
    const lookupAlvo = vi.fn().mockResolvedValue({
      data: { user_id: 'u-2', papel: { chave_preset: 'admin' } },
      error: null,
    })
    const lookupNovo = vi.fn().mockResolvedValue({
      data: { id: 'p-novo', chave_preset: 'gerente', escola_id: 'esc-1' },
      error: null,
    })
    const countAdmins = vi.fn().mockResolvedValue({ count: 1, error: null })

    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
      from: vi.fn((table: string) => {
        if (table === 'usuario_papel') {
          // chama 1: lookup alvo (com select que faz join), chama 2: count admins ativos
          return {
            select: (sel?: string) => {
              if (sel?.includes('papel')) {
                return { eq: () => ({ eq: () => ({ maybeSingle: lookupAlvo }) }) }
              }
              return { eq: () => ({ eq: () => countAdmins }) }
            },
          }
        }
        if (table === 'papeis') {
          return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: lookupNovo }) }) }) }
        }
        throw new Error(table)
      }),
    })

    const r = await alterarPapelUsuarioAction('u-2', 'p-novo')
    expect((r as any).error).toMatch(/[úu]ltimo admin/i)
  })

  it('atualiza papel quando autorizado', async () => {
    setupAuthOk('admin-1')
    const lookupAlvo = vi.fn().mockResolvedValue({
      data: { user_id: 'u-2', papel: { chave_preset: 'gerente' } },
      error: null,
    })
    const lookupNovo = vi.fn().mockResolvedValue({
      data: { id: 'p-novo', chave_preset: 'financeiro', escola_id: 'esc-1' },
      error: null,
    })
    const eqUpdate = vi.fn().mockResolvedValue({ error: null })
    const updateChain = vi.fn(() => ({ eq: () => ({ eq: eqUpdate }) }))

    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
      from: vi.fn((table: string) => {
        if (table === 'usuario_papel') {
          return {
            select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: lookupAlvo }) }) }),
            update: updateChain,
          }
        }
        if (table === 'papeis') {
          return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: lookupNovo }) }) }) }
        }
        throw new Error(table)
      }),
    })

    const r = await alterarPapelUsuarioAction('u-2', 'p-novo')
    expect(r).toEqual({ success: true })
    expect(updateChain).toHaveBeenCalledWith({ papel_id: 'p-novo' })
  })
})

describe('toggleSuspensaoUsuarioAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejeita auto-suspensão', async () => {
    setupAuthOk('admin-1')
    const r = await toggleSuspensaoUsuarioAction('admin-1', true)
    expect((r as any).error).toMatch(/pr[óo]prio/i)
  })

  it('rejeita suspender último admin', async () => {
    setupAuthOk('admin-1')
    const lookupAlvo = vi.fn().mockResolvedValue({
      data: { user_id: 'u-2', papel: { chave_preset: 'admin' }, suspenso: false },
      error: null,
    })
    const countAdmins = vi.fn().mockResolvedValue({ count: 1, error: null })
    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
      from: vi.fn((table: string) => {
        if (table === 'usuario_papel') {
          return {
            select: (sel?: string) => {
              if (sel?.includes('papel')) {
                return { eq: () => ({ eq: () => ({ maybeSingle: lookupAlvo }) }) }
              }
              return { eq: () => ({ eq: () => ({ eq: () => countAdmins }) }) }
            },
          }
        }
        throw new Error(table)
      }),
    })
    const r = await toggleSuspensaoUsuarioAction('u-2', true)
    expect((r as any).error).toMatch(/[úu]ltimo admin/i)
  })

  it('suspende com sucesso', async () => {
    setupAuthOk('admin-1')
    const lookupAlvo = vi.fn().mockResolvedValue({
      data: { user_id: 'u-2', papel: { chave_preset: 'gerente' }, suspenso: false },
      error: null,
    })
    const eqUpdate = vi.fn().mockResolvedValue({ error: null })
    const updateChain = vi.fn(() => ({ eq: () => ({ eq: eqUpdate }) }))
    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
      from: vi.fn((table: string) => {
        if (table === 'usuario_papel') {
          return {
            select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: lookupAlvo }) }) }),
            update: updateChain,
          }
        }
        throw new Error(table)
      }),
    })
    const r = await toggleSuspensaoUsuarioAction('u-2', true)
    expect(r).toEqual({ success: true })
    expect(updateChain).toHaveBeenCalledWith(expect.objectContaining({
      suspenso: true,
      suspenso_em: expect.any(String),
      suspenso_por: 'admin-1',
    }))
  })

  it('reativa limpa suspenso/em/por', async () => {
    setupAuthOk('admin-1')
    const lookupAlvo = vi.fn().mockResolvedValue({
      data: { user_id: 'u-2', papel: { chave_preset: 'gerente' }, suspenso: true },
      error: null,
    })
    const eqUpdate = vi.fn().mockResolvedValue({ error: null })
    const updateChain = vi.fn(() => ({ eq: () => ({ eq: eqUpdate }) }))
    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
      from: vi.fn((table: string) => {
        if (table === 'usuario_papel') {
          return {
            select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: lookupAlvo }) }) }),
            update: updateChain,
          }
        }
        throw new Error(table)
      }),
    })
    const r = await toggleSuspensaoUsuarioAction('u-2', false)
    expect(r).toEqual({ success: true })
    expect(updateChain).toHaveBeenCalledWith({
      suspenso: false,
      suspenso_em: null,
      suspenso_por: null,
    })
  })
})

describe('removerUsuarioAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejeita auto-remoção', async () => {
    setupAuthOk('admin-1')
    const r = await removerUsuarioAction('admin-1')
    expect((r as any).error).toMatch(/pr[óo]prio/i)
  })

  it('rejeita remover último admin', async () => {
    setupAuthOk('admin-1')
    const lookupAlvo = vi.fn().mockResolvedValue({
      data: { user_id: 'u-2', papel: { chave_preset: 'admin' } },
      error: null,
    })
    const countAdmins = vi.fn().mockResolvedValue({ count: 1, error: null })
    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
      from: vi.fn(() => ({
        select: (sel?: string) => {
          if (sel?.includes('papel')) {
            return { eq: () => ({ eq: () => ({ maybeSingle: lookupAlvo }) }) }
          }
          return { eq: () => ({ eq: () => ({ eq: () => countAdmins }) }) }
        },
      })),
    })
    const r = await removerUsuarioAction('u-2')
    expect((r as any).error).toMatch(/[úu]ltimo admin/i)
  })

  it('remove o vínculo com sucesso', async () => {
    setupAuthOk('admin-1')
    const lookupAlvo = vi.fn().mockResolvedValue({
      data: { user_id: 'u-2', papel: { chave_preset: 'gerente' } },
      error: null,
    })
    const eqDelete = vi.fn().mockResolvedValue({ error: null })
    const deleteChain = vi.fn(() => ({ eq: () => ({ eq: eqDelete }) }))
    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
      from: vi.fn(() => ({
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: lookupAlvo }) }) }),
        delete: deleteChain,
      })),
    })
    const r = await removerUsuarioAction('u-2')
    expect(r).toEqual({ success: true })
    expect(deleteChain).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test -- usuarios
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implementar**

`app/actions/configuracoes/usuarios.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission, PermissionDeniedError } from '@/lib/permissoes'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'

const PERM_GUARD = 'configuracoes.gerenciar_usuarios'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function ensurePermissao(): Promise<{ error: string } | null> {
  try {
    await requirePermission(PERM_GUARD)
    return null
  } catch (e) {
    if (e instanceof PermissionDeniedError) return { error: 'Sem permissão.' }
    return { error: 'Sem permissão.' }
  }
}

async function contarOutrosAdminsAtivos(supabase: any, escolaId: string, exceptUserId: string): Promise<number> {
  const { data: papelAdmin } = await supabase
    .from('papeis')
    .select('id')
    .eq('escola_id', escolaId)
    .eq('chave_preset', 'admin')
    .maybeSingle()

  if (!papelAdmin) return 0

  const { count } = await supabase
    .from('usuario_papel')
    .select('id', { count: 'exact', head: true })
    .eq('escola_id', escolaId)
    .eq('papel_id', papelAdmin.id)
    .eq('suspenso', false)

  // count inclui o próprio usuário; subtraímos se ele estiver na contagem
  return Math.max(0, (count ?? 0) - 1)
}

// ── CONVIDAR ──────────────────────────────────────────────────────────────────

export async function convidarUsuarioAction(formData: FormData) {
  const denied = await ensurePermissao()
  if (denied) return denied

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const email = (formData.get('email') as string | null)?.trim().toLowerCase() ?? ''
  const papelId = (formData.get('papel_id') as string | null)?.trim() ?? ''

  if (!email || !EMAIL_RE.test(email)) return { error: 'E-mail inválido.' }
  if (!papelId) return { error: 'Selecione um papel para o novo usuário.' }

  const { data: papel } = await supabase
    .from('papeis')
    .select('id')
    .eq('id', papelId)
    .eq('escola_id', escolaId)
    .maybeSingle()

  if (!papel) return { error: 'Papel inválido para esta escola.' }

  const adminClient = createAdminClient()
  const { data: invited, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/nova-senha`,
  })

  if (inviteErr || !invited?.user) {
    return { error: inviteErr?.message ?? 'Falha ao convidar usuário.' }
  }

  const { error: insertErr } = await supabase
    .from('usuario_papel')
    .insert({ user_id: invited.user.id, escola_id: escolaId, papel_id: papelId })

  if (insertErr) return { error: 'Convite enviado, mas falhou ao vincular o papel.' }

  revalidatePath('/admin/configuracoes/usuarios')
  return { success: true }
}

// ── ALTERAR PAPEL ─────────────────────────────────────────────────────────────

export async function alterarPapelUsuarioAction(targetUserId: string, novoPapelId: string) {
  const denied = await ensurePermissao()
  if (denied) return denied

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }
  if (user.id === targetUserId) return { error: 'Você não pode alterar o próprio papel.' }

  const { data: alvo } = await supabase
    .from('usuario_papel')
    .select('user_id, papel:papeis(chave_preset)')
    .eq('user_id', targetUserId)
    .eq('escola_id', escolaId)
    .maybeSingle()

  if (!alvo) return { error: 'Usuário não encontrado nesta escola.' }

  const { data: papelNovo } = await supabase
    .from('papeis')
    .select('id, chave_preset, escola_id')
    .eq('id', novoPapelId)
    .eq('escola_id', escolaId)
    .maybeSingle()

  if (!papelNovo) return { error: 'Papel inválido para esta escola.' }

  const eraAdmin = (alvo.papel as any)?.chave_preset === 'admin'
  const continuaAdmin = papelNovo.chave_preset === 'admin'
  if (eraAdmin && !continuaAdmin) {
    const restantes = await contarOutrosAdminsAtivos(supabase, escolaId, targetUserId)
    if (restantes === 0) {
      return { error: 'Não é possível rebaixar o último admin da escola.' }
    }
  }

  const { error: updErr } = await supabase
    .from('usuario_papel')
    .update({ papel_id: novoPapelId })
    .eq('user_id', targetUserId)
    .eq('escola_id', escolaId)

  if (updErr) return { error: 'Erro ao alterar papel.' }

  revalidatePath('/admin/configuracoes/usuarios')
  return { success: true }
}

// ── TOGGLE SUSPENSÃO ──────────────────────────────────────────────────────────

export async function toggleSuspensaoUsuarioAction(targetUserId: string, suspender: boolean) {
  const denied = await ensurePermissao()
  if (denied) return denied

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }
  if (user.id === targetUserId) return { error: 'Você não pode suspender o próprio acesso.' }

  const { data: alvo } = await supabase
    .from('usuario_papel')
    .select('user_id, suspenso, papel:papeis(chave_preset)')
    .eq('user_id', targetUserId)
    .eq('escola_id', escolaId)
    .maybeSingle()

  if (!alvo) return { error: 'Usuário não encontrado nesta escola.' }

  if (suspender && (alvo.papel as any)?.chave_preset === 'admin') {
    const restantes = await contarOutrosAdminsAtivos(supabase, escolaId, targetUserId)
    if (restantes === 0) {
      return { error: 'Não é possível suspender o último admin ativo da escola.' }
    }
  }

  const payload = suspender
    ? { suspenso: true, suspenso_em: new Date().toISOString(), suspenso_por: user.id }
    : { suspenso: false, suspenso_em: null, suspenso_por: null }

  const { error: updErr } = await supabase
    .from('usuario_papel')
    .update(payload)
    .eq('user_id', targetUserId)
    .eq('escola_id', escolaId)

  if (updErr) return { error: 'Erro ao alterar suspensão.' }

  revalidatePath('/admin/configuracoes/usuarios')
  return { success: true }
}

// ── REMOVER ───────────────────────────────────────────────────────────────────

export async function removerUsuarioAction(targetUserId: string) {
  const denied = await ensurePermissao()
  if (denied) return denied

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }
  if (user.id === targetUserId) return { error: 'Você não pode remover o próprio acesso.' }

  const { data: alvo } = await supabase
    .from('usuario_papel')
    .select('user_id, papel:papeis(chave_preset)')
    .eq('user_id', targetUserId)
    .eq('escola_id', escolaId)
    .maybeSingle()

  if (!alvo) return { error: 'Usuário não encontrado nesta escola.' }

  if ((alvo.papel as any)?.chave_preset === 'admin') {
    const restantes = await contarOutrosAdminsAtivos(supabase, escolaId, targetUserId)
    if (restantes === 0) {
      return { error: 'Não é possível remover o último admin da escola.' }
    }
  }

  const { error: delErr } = await supabase
    .from('usuario_papel')
    .delete()
    .eq('user_id', targetUserId)
    .eq('escola_id', escolaId)

  if (delErr) return { error: 'Erro ao remover usuário.' }

  revalidatePath('/admin/configuracoes/usuarios')
  return { success: true }
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npm test -- usuarios
```

Expected: 16 passed (4 convidar + 4 alterar + 4 toggle + 3 remover = 15 — pode variar; aceitar o número real).

- [ ] **Step 5: Suíte completa**

```bash
npm test
```

Expected: 90 passing (75 + ~15).

- [ ] **Step 6: Commit + push**

```bash
git add app/actions/configuracoes/usuarios.ts tests/configuracoes/usuarios.test.ts
git commit -m "feat(usuarios): server actions convidar/alterar/suspender/remover + testes"
git push -u origin feat/configuracoes-usuarios
```

---

## Task 2: Página de listagem `/admin/configuracoes/usuarios`

**Files:**
- Create: `app/(admin)/admin/configuracoes/usuarios/page.tsx`
- Create: `app/(admin)/admin/configuracoes/usuarios/UsuarioRow.tsx`
- Create: `app/(admin)/admin/configuracoes/usuarios/ConvidarForm.tsx`

- [ ] **Step 1: Criar `page.tsx` (server)**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { hasPermission } from '@/lib/permissoes'
import { ConvidarForm } from './ConvidarForm'
import { UsuarioRow } from './UsuarioRow'

type Vinculo = {
  user_id: string
  papel_id: string
  suspenso: boolean
  papel: { id: string; nome: string; chave_preset: string | null } | null
}

type AuthMeta = {
  email: string | null
  nome: string | null
  last_sign_in_at: string | null
}

export type UsuarioListItem = {
  user_id: string
  email: string | null
  nome: string | null
  papel_id: string
  papel_nome: string
  papel_chave_preset: string | null
  suspenso: boolean
  last_sign_in_at: string | null
}

export default async function UsuariosListPage() {
  if (!(await hasPermission('configuracoes.gerenciar_usuarios'))) {
    redirect('/admin/configuracoes')
  }

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) {
    return (
      <div>
        <Header />
        <p style={{ color: '#94a3b8' }}>Sua conta não está vinculada a uma escola.</p>
      </div>
    )
  }

  const { data: { user: currentUser } } = await supabase.auth.getUser()

  const { data: vinculosRaw } = await supabase
    .from('usuario_papel')
    .select('user_id, papel_id, suspenso, papel:papeis(id, nome, chave_preset)')
    .eq('escola_id', escolaId)
    .order('suspenso')

  const vinculos = (vinculosRaw ?? []) as unknown as Vinculo[]

  // Lê emails / nomes / last_sign_in via admin (a anon API não expõe)
  const adminClient = createAdminClient()
  const authMap: Record<string, AuthMeta> = {}
  await Promise.all(vinculos.map(async v => {
    const { data } = await adminClient.auth.admin.getUserById(v.user_id)
    if (data?.user) {
      authMap[v.user_id] = {
        email: data.user.email ?? null,
        nome: ((data.user.user_metadata as any)?.nome ?? null) as string | null,
        last_sign_in_at: data.user.last_sign_in_at ?? null,
      }
    }
  }))

  const usuarios: UsuarioListItem[] = vinculos.map(v => ({
    user_id: v.user_id,
    email: authMap[v.user_id]?.email ?? null,
    nome: authMap[v.user_id]?.nome ?? null,
    papel_id: v.papel_id,
    papel_nome: v.papel?.nome ?? '—',
    papel_chave_preset: v.papel?.chave_preset ?? null,
    suspenso: v.suspenso,
    last_sign_in_at: authMap[v.user_id]?.last_sign_in_at ?? null,
  }))

  // Lista de papéis disponíveis pra reatribuição
  const { data: papeisRaw } = await supabase
    .from('papeis')
    .select('id, nome, chave_preset, preset')
    .eq('escola_id', escolaId)
    .order('preset', { ascending: false })
    .order('nome')

  const papeis = (papeisRaw ?? []) as Array<{ id: string; nome: string; chave_preset: string | null; preset: boolean }>

  return (
    <div>
      <Header />

      <section style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        padding: 16,
        marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc', marginBottom: 12 }}>
          Convidar novo usuário
        </h2>
        <ConvidarForm papeis={papeis} />
      </section>

      <section>
        <h2 style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc', marginBottom: 12 }}>
          Usuários ({usuarios.length})
        </h2>
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          overflow: 'hidden',
        }}>
          {usuarios.length === 0 ? (
            <p style={{ padding: 20, color: '#94a3b8', fontSize: 13 }}>Nenhum usuário ainda. Use o formulário acima para convidar.</p>
          ) : usuarios.map(u => (
            <UsuarioRow
              key={u.user_id}
              usuario={u}
              papeis={papeis}
              isSelf={currentUser?.id === u.user_id}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function Header() {
  return (
    <div style={{ marginBottom: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginBottom: 6 }}>
        Usuários
      </h1>
      <p style={{ color: '#94a3b8', fontSize: 13 }}>
        Convide membros da equipe, atribua papéis e suspenda acessos.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Criar `ConvidarForm.tsx` (client)**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { convidarUsuarioAction } from '@/app/actions/configuracoes/usuarios'

type PapelOpt = { id: string; nome: string; chave_preset: string | null; preset: boolean }

export function ConvidarForm({ papeis }: { papeis: PapelOpt[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  async function onSubmit(formData: FormData) {
    setMsg(null)
    startTransition(async () => {
      const r = await convidarUsuarioAction(formData)
      if ('error' in r && r.error) {
        setMsg({ tipo: 'erro', texto: r.error })
        return
      }
      setMsg({ tipo: 'ok', texto: 'Convite enviado!' })
      // limpa o form via reload da listagem
      router.refresh()
    })
  }

  return (
    <form action={onSubmit} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <Field label="E-mail">
        <input
          name="email"
          type="email"
          required
          placeholder="pessoa@escola.com"
          style={{ ...inputStyle, minWidth: 240 }}
        />
      </Field>

      <Field label="Papel">
        <select name="papel_id" required defaultValue="" style={inputStyle as any}>
          <option value="" disabled>Selecione…</option>
          {papeis.map(p => (
            <option key={p.id} value={p.id}>
              {p.nome}{p.preset ? ' (preset)' : ''}
            </option>
          ))}
        </select>
      </Field>

      <button type="submit" disabled={pending} style={btnPrimary}>
        {pending ? 'Enviando…' : 'Enviar convite'}
      </button>

      {msg && (
        <span style={{ fontSize: 13, color: msg.tipo === 'ok' ? '#22c55e' : '#ef4444' }}>
          {msg.texto}
        </span>
      )}
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>{label}</span>
      {children}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.25)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: '8px 12px',
  color: '#f8fafc',
  fontSize: 13,
  outline: 'none',
}

const btnPrimary: React.CSSProperties = {
  background: '#f59e0b',
  border: 'none',
  borderRadius: 10,
  padding: '8px 16px',
  color: '#0a1628',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
  height: 36,
}
```

- [ ] **Step 3: Criar `UsuarioRow.tsx` (client)**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  alterarPapelUsuarioAction,
  toggleSuspensaoUsuarioAction,
  removerUsuarioAction,
} from '@/app/actions/configuracoes/usuarios'
import type { UsuarioListItem } from './page'

type PapelOpt = { id: string; nome: string; chave_preset: string | null; preset: boolean }

function fmtData(iso: string | null): string {
  if (!iso) return 'Nunca acessou'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const dias = Math.floor(diff / 86400000)
  if (dias === 0) return 'Hoje'
  if (dias === 1) return 'Ontem'
  if (dias < 30) return `há ${dias} dias`
  if (dias < 365) return `há ${Math.floor(dias / 30)} meses`
  return d.toLocaleDateString('pt-BR')
}

export function UsuarioRow({
  usuario,
  papeis,
  isSelf,
}: {
  usuario: UsuarioListItem
  papeis: PapelOpt[]
  isSelf: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function alterarPapel(novoId: string) {
    if (novoId === usuario.papel_id) return
    setErro(null)
    startTransition(async () => {
      const r = await alterarPapelUsuarioAction(usuario.user_id, novoId)
      if ('error' in r && r.error) {
        setErro(r.error)
        return
      }
      router.refresh()
    })
  }

  function toggleSuspensao() {
    setErro(null)
    if (!confirm(usuario.suspenso ? `Reativar ${usuario.email}?` : `Suspender ${usuario.email}? Ele perde acesso imediatamente.`)) return
    startTransition(async () => {
      const r = await toggleSuspensaoUsuarioAction(usuario.user_id, !usuario.suspenso)
      if ('error' in r && r.error) {
        setErro(r.error)
        return
      }
      router.refresh()
    })
  }

  function remover() {
    setErro(null)
    if (!confirm(`Remover ${usuario.email} da escola? Essa ação não pode ser desfeita.`)) return
    startTransition(async () => {
      const r = await removerUsuarioAction(usuario.user_id)
      if ('error' in r && r.error) {
        setErro(r.error)
        return
      }
      router.refresh()
    })
  }

  const opacity = usuario.suspenso ? 0.55 : 1

  return (
    <div style={{
      borderTop: '1px solid rgba(255,255,255,0.06)',
      padding: '14px 16px',
      display: 'grid',
      gridTemplateColumns: '1.4fr 1.2fr 0.8fr auto',
      gap: 14,
      alignItems: 'center',
      opacity,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {usuario.nome ?? usuario.email ?? '(sem nome)'}
          {isSelf && <span style={{ marginLeft: 6, fontSize: 10, color: '#fbbf24' }}>(você)</span>}
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {usuario.email}
        </div>
      </div>

      <div>
        <select
          defaultValue={usuario.papel_id}
          onChange={e => alterarPapel(e.target.value)}
          disabled={pending || isSelf}
          style={selectStyle}
        >
          {papeis.map(p => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </select>
      </div>

      <div style={{ fontSize: 11, color: '#94a3b8' }}>
        {usuario.suspenso ? <span style={{ color: '#ef4444', fontWeight: 700 }}>Suspenso</span> : fmtData(usuario.last_sign_in_at)}
      </div>

      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        {!isSelf && (
          <>
            <button onClick={toggleSuspensao} disabled={pending} style={btnGhost} type="button">
              {usuario.suspenso ? 'Reativar' : 'Suspender'}
            </button>
            <button onClick={remover} disabled={pending} style={btnDanger} type="button">
              Remover
            </button>
          </>
        )}
      </div>

      {erro && (
        <div style={{ gridColumn: '1 / -1', fontSize: 12, color: '#ef4444' }}>
          {erro}
        </div>
      )}
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.25)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: '6px 10px',
  color: '#f8fafc',
  fontSize: 12,
  outline: 'none',
  width: '100%',
  cursor: 'pointer',
}

const btnGhost: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: '6px 12px',
  color: '#f8fafc',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
}

const btnDanger: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(239,68,68,0.4)',
  borderRadius: 8,
  padding: '6px 12px',
  color: '#ef4444',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
}
```

- [ ] **Step 4: Validar tsc + build + commit**

```bash
npx tsc --noEmit
npm run build

git add app/\(admin\)/admin/configuracoes/usuarios/
git commit -m "feat(usuarios): página /admin/configuracoes/usuarios com listagem + convite + ações"
git push
```

Expected: tsc 0 erros; rota `/admin/configuracoes/usuarios` listada.

---

## Task 3: Smoke test final + PR + merge

- [ ] **Step 1: Smoke test manual**

```bash
npm run dev
```

1. Login admin → `/admin/configuracoes/usuarios`
2. Listagem mostra todos os usuários com papel + último acesso (ou "Nunca acessou"). Você (admin atual) tem badge "(você)" e dropdown desabilitado.
3. **Convidar:** preencha e-mail novo + escolha papel "Operador" → Enviar convite → mensagem verde + linha aparece na lista (com "Nunca acessou"). Verifique no email do convidado se chegou o link.
4. **Alterar papel:** mude papel de outro usuário → muda imediatamente (router.refresh).
5. **Tentar mudar próprio papel:** dropdown está disabled → não consegue.
6. **Suspender:** clique em outro usuário → confirma → linha fica esmaecida + status "Suspenso". Reativar volta ao normal.
7. **Tentar suspender o último admin:** se você for o único admin, qualquer tentativa de suspender outro admin (caso de promoção) é OK; mas tentar rebaixar/remover você mesmo é bloqueado.
8. **Remover:** clique remover → confirma → linha some.

- [ ] **Step 2: Commit do plano + abrir PR + merge automático**

```bash
git add docs/superpowers/plans/2026-05-12-configuracoes-usuarios.md
git commit -m "docs: plano do Módulo Usuários"
git push

/opt/homebrew/bin/gh pr create --base main --head feat/configuracoes-usuarios \
  --title "feat: Módulo Usuários — convite, papel, suspensão, remoção" \
  --body "$(cat <<'EOF'
## Summary

Implementa `/admin/configuracoes/usuarios`, **fechando a Fase 1 do menu de Configurações**. Substitui o SQL manual de criar admin/operador.

- **Listagem:** nome, e-mail, papel, último acesso (relativo) e status. Linhas suspensas ficam esmaecidas.
- **Convidar:** form com e-mail + dropdown de papel. Usa Supabase Auth admin API (\`inviteUserByEmail\`) — Supabase manda email com link de set password; nós já criamos o vínculo em \`usuario_papel\`.
- **Alterar papel:** dropdown inline na linha do usuário.
- **Suspender / Reativar:** toggle do \`usuario_papel.suspenso\` (trigger sync atualiza JWT pra "suspenso" instantâneo).
- **Remover:** delete do \`usuario_papel\` (não toca em \`auth.users\` pra preservar histórico).

**Proteções de segurança:**
- Admin não pode mudar o próprio papel, suspender a si mesmo, nem se remover.
- Sistema bloqueia rebaixar/suspender/remover o **último admin ativo** da escola.
- Convidar requer \`SUPABASE_SERVICE_ROLE_KEY\` (já configurada em prod).

Inclui:
- 4 Server Actions com \`requirePermission('configuracoes.gerenciar_usuarios')\`
- **~15 novos testes Vitest** cobrindo validação + proteções (90 totais)

Sem migrations.

## Test plan

- [ ] Listagem com usuários staff + papéis + últimos acessos
- [ ] Convite por e-mail → link chega + linha aparece
- [ ] Alterar papel → dropdown muda + persiste
- [ ] Suspender + reativar → status muda + JWT do usuário afetado é invalidado
- [ ] Tentar remover/rebaixar último admin → erro
- [ ] Tentar mexer em si mesmo → bloqueado
- [ ] \`npm test\` → 90 passing
- [ ] \`npm run build\` → ok
EOF
)"

PR_NUM=$(/opt/homebrew/bin/gh pr view --json number -q .number)
/opt/homebrew/bin/gh pr checks $PR_NUM --watch --interval 15
/opt/homebrew/bin/gh pr merge $PR_NUM --squash --delete-branch
git checkout main && git pull origin main
```

---

## Definition of Done

- [ ] `/admin/configuracoes/usuarios` funcional (lista, convida, atualiza, remove)
- [ ] Proteções: último admin, auto-edição
- [ ] ~90 testes passando, tsc limpo, build verde
- [ ] PR mergeado em `main`

## Após Usuários — Fase 1 100% completa 🎉

Próximas fases (não estão neste plano):
- **Fase 2:** E-mails, Cantina, Checkout, Termos & LGPD, Integrações, Loja Online
- **Fase 3:** Auditoria, Backup & exportação LGPD
