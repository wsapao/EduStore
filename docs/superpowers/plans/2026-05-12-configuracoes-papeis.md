# Configurações — Módulo Papéis & Permissões (Plano de Implementação)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar `/admin/configuracoes/papeis` permitindo ao admin **listar** os 6 presets + papéis customizados, **criar** novos papéis customizados, **editar** (nome, descrição, checkboxes de permissões), **duplicar** um papel existente como base, e **excluir** papéis customizados que não estão em uso. Presets podem ter nome/descrição/permissões editados, mas não podem ser excluídos nem ter `chave_preset` alterada.

**Architecture:** Server actions em `app/actions/configuracoes/papeis.ts` cobrem as 4 mutações (`criarPapelAction`, `atualizarPapelAction`, `duplicarPapelAction`, `excluirPapelAction`). Página de listagem (`/papeis`) lê papéis + contagem de usuários e renderiza cards com ações. Páginas de editor (`/papeis/[id]` e `/papeis/novo`) compartilham um único `PapelEditor` (client) que mostra os checkboxes agrupados por módulo (usando `PERMISSION_GROUPS` da Fundação) com atalhos "marcar tudo do módulo" e "marcar só `.ver`".

**Tech Stack:** Next.js 15 App Router · Supabase · TypeScript · Vitest

**Spec:** [2026-05-11-configuracoes-loja-design.md](../specs/2026-05-11-configuracoes-loja-design.md) seção 4.3

**Branch:** `feat/configuracoes-papeis` (já criada de `main`)

**Sem migrations** — `papeis` e `papel_permissoes` já existem desde a Fundação. `PERMISSION_GROUPS`/`PERMISSION_KEYS`/`isValidPermissionKey` já existem em `lib/permissoes/keys.ts`.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `app/actions/configuracoes/papeis.ts` | 4 Server Actions: criar / atualizar / duplicar / excluir |
| `tests/configuracoes/papeis.test.ts` | Testes das 4 actions |
| `app/(admin)/admin/configuracoes/papeis/page.tsx` | Server: listagem com cards |
| `app/(admin)/admin/configuracoes/papeis/PapelCard.tsx` | Client: card de papel com botões (Editar/Duplicar/Excluir) |
| `app/(admin)/admin/configuracoes/papeis/PapelEditor.tsx` | Client: form compartilhado novo/editar (nome, descrição, checkboxes) |
| `app/(admin)/admin/configuracoes/papeis/novo/page.tsx` | Server: tela "novo papel" (PapelEditor sem id) |
| `app/(admin)/admin/configuracoes/papeis/[id]/page.tsx` | Server: tela "editar papel" (carrega papel + permissões) |

---

## Decisões de design

- **Editor é a página inteira** (não modal) — usa toda a largura, melhor pra muitos checkboxes.
- **Excluir** é hard delete com `ON DELETE CASCADE` em `papel_permissoes`. Papel `preset = true` ou em uso por algum `usuario_papel` recebe erro 400 antes do delete.
- **Editar preset:** permite alterar `nome`, `descricao` e permissões. Mas `preset` e `chave_preset` são **ignorados** no payload — admin não pode "tirar" um papel de preset.
- **Duplicar:** cria papel novo (`preset = false`, `chave_preset = null`) com nome `"<original> (cópia)"` e copia todas as chaves de `papel_permissoes`. Admin pode renomear depois.
- **Validação de chaves:** server side compara cada chave recebida contra `PERMISSION_KEYS`; chaves desconhecidas resultam em erro (não simplesmente filtradas — falha alta pra evitar drift).

---

## Task 1: Server actions (criar / atualizar / duplicar / excluir)

**Files:**
- Create: `app/actions/configuracoes/papeis.ts`
- Create: `tests/configuracoes/papeis.test.ts`

- [ ] **Step 1: Escrever os testes (full content)**

`tests/configuracoes/papeis.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/permissoes', () => ({
  requirePermission: vi.fn(),
  PermissionDeniedError: class extends Error {},
}))
vi.mock('@/lib/escola/getEscolaIdParaAdmin', () => ({ getEscolaIdParaAdmin: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT') }) }))

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/permissoes'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import {
  criarPapelAction,
  atualizarPapelAction,
  duplicarPapelAction,
  excluirPapelAction,
} from '@/app/actions/configuracoes/papeis'

function fd(obj: Record<string, string | string[]>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) v.forEach(x => f.append(k, x))
    else f.append(k, v)
  }
  return f
}

function setupAuthOk(escolaId = 'esc-1') {
  ;(requirePermission as any).mockResolvedValue(undefined)
  ;(getEscolaIdParaAdmin as any).mockResolvedValue(escolaId)
}

describe('criarPapelAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exige permissão configuracoes.gerenciar_papeis', async () => {
    ;(requirePermission as any).mockRejectedValue(new Error('denied'))
    const r = await criarPapelAction(fd({ nome: 'X' }))
    expect(requirePermission).toHaveBeenCalledWith('configuracoes.gerenciar_papeis')
    expect(r.error).toBeDefined()
  })

  it('rejeita nome com menos de 2 caracteres', async () => {
    setupAuthOk()
    ;(createClient as any).mockResolvedValue({ from: vi.fn() })
    const r = await criarPapelAction(fd({ nome: 'A' }))
    expect(r.error).toMatch(/nome/i)
  })

  it('rejeita chaves de permissão desconhecidas', async () => {
    setupAuthOk()
    ;(createClient as any).mockResolvedValue({ from: vi.fn() })
    const r = await criarPapelAction(fd({ nome: 'Custom', chaves: ['produtos.ver', 'foo.bar'] }))
    expect(r.error).toMatch(/permiss[ãa]o|chave/i)
  })

  it('rejeita quando já existe outro papel com o mesmo nome na escola', async () => {
    setupAuthOk()
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'p9' }, error: null })
    ;(createClient as any).mockResolvedValue({
      from: vi.fn(() => ({
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }),
      })),
    })
    const r = await criarPapelAction(fd({ nome: 'Admin' }))
    expect(r.error).toMatch(/j[áa] existe/i)
  })

  it('cria papel + permissões e redireciona pra listagem', async () => {
    setupAuthOk()
    const insertPapel = vi.fn().mockReturnValue({ select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'novo-1' }, error: null }) }) })
    const insertPerms = vi.fn().mockResolvedValue({ error: null })
    const checkExisting = vi.fn().mockResolvedValue({ data: null, error: null })

    ;(createClient as any).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'papeis') {
          return {
            insert: insertPapel,
            select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: checkExisting }) }) }),
          }
        }
        if (table === 'papel_permissoes') return { insert: insertPerms }
        throw new Error('unexpected table ' + table)
      }),
    })

    const r = await criarPapelAction(fd({
      nome: 'Operador Custom',
      descricao: 'Variação interna',
      chaves: ['pdv.usar', 'pedidos.ver'],
    }))

    expect(insertPapel).toHaveBeenCalledWith(expect.objectContaining({
      escola_id: 'esc-1',
      nome: 'Operador Custom',
      descricao: 'Variação interna',
      preset: false,
      chave_preset: null,
    }))
    expect(insertPerms).toHaveBeenCalledWith([
      { papel_id: 'novo-1', chave: 'pdv.usar' },
      { papel_id: 'novo-1', chave: 'pedidos.ver' },
    ])
    expect(r).toEqual({ success: true, papelId: 'novo-1' })
  })

  it('aceita criação sem permissões marcadas (papel vazio)', async () => {
    setupAuthOk()
    const insertPapel = vi.fn().mockReturnValue({ select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'p2' }, error: null }) }) })
    const insertPerms = vi.fn().mockResolvedValue({ error: null })
    ;(createClient as any).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'papeis') {
          return {
            insert: insertPapel,
            select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) }),
          }
        }
        if (table === 'papel_permissoes') return { insert: insertPerms }
        throw new Error('unexpected table ' + table)
      }),
    })

    const r = await criarPapelAction(fd({ nome: 'Vazio' }))
    expect(r).toEqual({ success: true, papelId: 'p2' })
    expect(insertPerms).not.toHaveBeenCalled()
  })
})

describe('atualizarPapelAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exige permissão configuracoes.gerenciar_papeis', async () => {
    ;(requirePermission as any).mockRejectedValue(new Error('denied'))
    const r = await atualizarPapelAction('p1', fd({ nome: 'X' }))
    expect(r.error).toBeDefined()
  })

  it('rejeita papel não encontrado', async () => {
    setupAuthOk()
    ;(createClient as any).mockResolvedValue({
      from: vi.fn(() => ({
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) }),
      })),
    })
    const r = await atualizarPapelAction('p404', fd({ nome: 'X' }))
    expect(r.error).toMatch(/n[ãa]o encontrado/i)
  })

  it('rejeita nome duplicado em outro papel da mesma escola', async () => {
    setupAuthOk()
    const lookupPapel = vi.fn().mockResolvedValue({ data: { id: 'p1', preset: false, chave_preset: null }, error: null })
    const lookupDup = vi.fn().mockResolvedValue({ data: { id: 'p9' }, error: null })

    let papeisCount = 0
    ;(createClient as any).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'papeis') {
          papeisCount++
          // 1ª chamada = lookup do papel; 2ª = check de nome duplicado
          if (papeisCount === 1) {
            return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: lookupPapel }) }) }) }
          }
          return {
            select: () => ({
              eq: () => ({ eq: () => ({ neq: () => ({ maybeSingle: lookupDup }) }) }),
            }),
          }
        }
        throw new Error('unexpected table ' + table)
      }),
    })

    const r = await atualizarPapelAction('p1', fd({ nome: 'Existente' }))
    expect(r.error).toMatch(/j[áa] existe/i)
  })

  it('atualiza nome/descricao + substitui permissões em transação simulada', async () => {
    setupAuthOk()
    const lookupPapel = vi.fn().mockResolvedValue({ data: { id: 'p1', preset: false, chave_preset: null }, error: null })
    const lookupDup = vi.fn().mockResolvedValue({ data: null, error: null })
    const updatePapel = vi.fn().mockResolvedValue({ error: null })
    const deletePerms = vi.fn().mockResolvedValue({ error: null })
    const insertPerms = vi.fn().mockResolvedValue({ error: null })

    let papeisCount = 0
    ;(createClient as any).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'papeis') {
          papeisCount++
          if (papeisCount === 1) {
            return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: lookupPapel }) }) }) }
          }
          if (papeisCount === 2) {
            return { select: () => ({ eq: () => ({ eq: () => ({ neq: () => ({ maybeSingle: lookupDup }) }) }) }) }
          }
          return { update: () => ({ eq: updatePapel }) }
        }
        if (table === 'papel_permissoes') {
          return {
            delete: () => ({ eq: deletePerms }),
            insert: insertPerms,
          }
        }
        throw new Error('unexpected table ' + table)
      }),
    })

    const r = await atualizarPapelAction('p1', fd({
      nome: 'Atualizado',
      descricao: 'Nova descrição',
      chaves: ['produtos.ver', 'pedidos.ver'],
    }))

    expect(r).toEqual({ success: true })
    expect(updatePapel).toHaveBeenCalledWith('id', 'p1')
    expect(deletePerms).toHaveBeenCalledWith('papel_id', 'p1')
    expect(insertPerms).toHaveBeenCalledWith([
      { papel_id: 'p1', chave: 'produtos.ver' },
      { papel_id: 'p1', chave: 'pedidos.ver' },
    ])
  })

  it('em preset, ignora preset/chave_preset no update mas permite alterar nome/perms', async () => {
    setupAuthOk()
    const lookupPapel = vi.fn().mockResolvedValue({ data: { id: 'p1', preset: true, chave_preset: 'admin' }, error: null })
    const lookupDup = vi.fn().mockResolvedValue({ data: null, error: null })
    const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }))
    let papeisCount = 0
    ;(createClient as any).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'papeis') {
          papeisCount++
          if (papeisCount === 1) return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: lookupPapel }) }) }) }
          if (papeisCount === 2) return { select: () => ({ eq: () => ({ eq: () => ({ neq: () => ({ maybeSingle: lookupDup }) }) }) }) }
          return { update }
        }
        if (table === 'papel_permissoes') {
          return {
            delete: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            insert: vi.fn().mockResolvedValue({ error: null }),
          }
        }
        throw new Error(table)
      }),
    })

    await atualizarPapelAction('p1', fd({ nome: 'Admin renomeado', chaves: ['produtos.ver'] }))
    const payload = (update.mock.calls[0] as unknown[])[0] as any
    expect(payload).not.toHaveProperty('preset')
    expect(payload).not.toHaveProperty('chave_preset')
    expect(payload).toMatchObject({ nome: 'Admin renomeado' })
  })
})

describe('duplicarPapelAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('cria cópia com nome "<original> (cópia)" e copia permissões', async () => {
    setupAuthOk()
    const lookupOriginal = vi.fn().mockResolvedValue({
      data: { id: 'p1', escola_id: 'esc-1', nome: 'Gerente', descricao: 'desc' },
      error: null,
    })
    const listarPerms = vi.fn().mockResolvedValue({
      data: [{ chave: 'produtos.ver' }, { chave: 'pedidos.ver' }],
      error: null,
    })
    const insertPapel = vi.fn().mockReturnValue({ select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'p1-copy' }, error: null }) }) })
    const insertPerms = vi.fn().mockResolvedValue({ error: null })

    ;(createClient as any).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'papeis') {
          return {
            select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: lookupOriginal }) }) }),
            insert: insertPapel,
          }
        }
        if (table === 'papel_permissoes') {
          return {
            select: () => ({ eq: listarPerms }),
            insert: insertPerms,
          }
        }
        throw new Error(table)
      }),
    })

    const r = await duplicarPapelAction('p1')

    expect(insertPapel).toHaveBeenCalledWith(expect.objectContaining({
      escola_id: 'esc-1',
      nome: 'Gerente (cópia)',
      preset: false,
      chave_preset: null,
    }))
    expect(insertPerms).toHaveBeenCalledWith([
      { papel_id: 'p1-copy', chave: 'produtos.ver' },
      { papel_id: 'p1-copy', chave: 'pedidos.ver' },
    ])
    expect(r).toEqual({ success: true, papelId: 'p1-copy' })
  })
})

describe('excluirPapelAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejeita exclusão de preset', async () => {
    setupAuthOk()
    const lookup = vi.fn().mockResolvedValue({
      data: { id: 'p1', preset: true },
      error: null,
    })
    ;(createClient as any).mockResolvedValue({
      from: vi.fn(() => ({
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: lookup }) }) }),
      })),
    })
    const r = await excluirPapelAction('p1')
    expect(r.error).toMatch(/preset/i)
  })

  it('rejeita exclusão de papel em uso', async () => {
    setupAuthOk()
    const lookupPapel = vi.fn().mockResolvedValue({ data: { id: 'p1', preset: false }, error: null })
    const countUsos = vi.fn().mockResolvedValue({ count: 3, error: null })

    ;(createClient as any).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'papeis') {
          return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: lookupPapel }) }) }) }
        }
        if (table === 'usuario_papel') {
          return { select: () => ({ eq: countUsos }) }
        }
        throw new Error(table)
      }),
    })

    const r = await excluirPapelAction('p1')
    expect(r.error).toMatch(/em uso|usu[áa]rio/i)
  })

  it('exclui papel customizado sem usuários', async () => {
    setupAuthOk()
    const lookupPapel = vi.fn().mockResolvedValue({ data: { id: 'p1', preset: false }, error: null })
    const countUsos = vi.fn().mockResolvedValue({ count: 0, error: null })
    const del = vi.fn().mockResolvedValue({ error: null })

    ;(createClient as any).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'papeis') {
          return {
            select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: lookupPapel }) }) }),
            delete: () => ({ eq: del }),
          }
        }
        if (table === 'usuario_papel') {
          return { select: () => ({ eq: countUsos }) }
        }
        throw new Error(table)
      }),
    })

    const r = await excluirPapelAction('p1')
    expect(r).toEqual({ success: true })
    expect(del).toHaveBeenCalledWith('id', 'p1')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test -- papeis
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implementar (full content)**

`app/actions/configuracoes/papeis.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission, PermissionDeniedError, isValidPermissionKey } from '@/lib/permissoes'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'

const PERM_GUARD = 'configuracoes.gerenciar_papeis'

async function ensurePermissao(): Promise<{ error: string } | null> {
  try {
    await requirePermission(PERM_GUARD)
    return null
  } catch (e) {
    if (e instanceof PermissionDeniedError) return { error: 'Sem permissão.' }
    return { error: 'Sem permissão.' }
  }
}

function parseChavesValidando(formData: FormData): { chaves: string[]; error?: string } {
  const raw = formData.getAll('chaves').map(String)
  const chaves: string[] = []
  for (const c of raw) {
    if (!c) continue
    if (!isValidPermissionKey(c)) {
      return { chaves: [], error: `Chave de permissão desconhecida: ${c}` }
    }
    chaves.push(c)
  }
  return { chaves: Array.from(new Set(chaves)) }
}

// ── CRIAR ─────────────────────────────────────────────────────────────────────

export async function criarPapelAction(formData: FormData) {
  const denied = await ensurePermissao()
  if (denied) return denied

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const nome = (formData.get('nome') as string | null)?.trim() ?? ''
  const descricao = (formData.get('descricao') as string | null)?.trim() || null

  if (!nome || nome.length < 2) return { error: 'Nome do papel é obrigatório (mín. 2 caracteres).' }
  if (nome.length > 50) return { error: 'Nome do papel deve ter no máximo 50 caracteres.' }

  const { chaves, error: chavesErr } = parseChavesValidando(formData)
  if (chavesErr) return { error: chavesErr }

  const { data: existente } = await supabase
    .from('papeis')
    .select('id')
    .eq('escola_id', escolaId)
    .eq('nome', nome)
    .maybeSingle()

  if (existente) return { error: 'Já existe um papel com este nome nesta escola.' }

  const { data: novo, error: insertErr } = await supabase
    .from('papeis')
    .insert({
      escola_id: escolaId,
      nome,
      descricao,
      preset: false,
      chave_preset: null,
    })
    .select('id')
    .single()

  if (insertErr || !novo) return { error: 'Erro ao criar papel.' }

  if (chaves.length > 0) {
    const { error: permsErr } = await supabase
      .from('papel_permissoes')
      .insert(chaves.map(c => ({ papel_id: novo.id, chave: c })))
    if (permsErr) return { error: 'Papel criado, mas falhou ao gravar permissões.' }
  }

  revalidatePath('/admin/configuracoes/papeis')
  return { success: true, papelId: novo.id as string }
}

// ── ATUALIZAR ─────────────────────────────────────────────────────────────────

export async function atualizarPapelAction(papelId: string, formData: FormData) {
  const denied = await ensurePermissao()
  if (denied) return denied

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const nome = (formData.get('nome') as string | null)?.trim() ?? ''
  const descricao = (formData.get('descricao') as string | null)?.trim() || null

  if (!nome || nome.length < 2) return { error: 'Nome do papel é obrigatório (mín. 2 caracteres).' }
  if (nome.length > 50) return { error: 'Nome do papel deve ter no máximo 50 caracteres.' }

  const { chaves, error: chavesErr } = parseChavesValidando(formData)
  if (chavesErr) return { error: chavesErr }

  // Confirma papel existe e pertence à escola
  const { data: papel } = await supabase
    .from('papeis')
    .select('id, preset, chave_preset')
    .eq('id', papelId)
    .eq('escola_id', escolaId)
    .maybeSingle()

  if (!papel) return { error: 'Papel não encontrado.' }

  // Nome único na escola (ignorando o próprio papel)
  const { data: dup } = await supabase
    .from('papeis')
    .select('id')
    .eq('escola_id', escolaId)
    .eq('nome', nome)
    .neq('id', papelId)
    .maybeSingle()

  if (dup) return { error: 'Já existe outro papel com este nome.' }

  const { error: updErr } = await supabase
    .from('papeis')
    .update({ nome, descricao })
    .eq('id', papelId)

  if (updErr) return { error: 'Erro ao salvar papel.' }

  // Substitui permissões: delete + insert
  const { error: delErr } = await supabase
    .from('papel_permissoes')
    .delete()
    .eq('papel_id', papelId)
  if (delErr) return { error: 'Erro ao limpar permissões antigas.' }

  if (chaves.length > 0) {
    const { error: insErr } = await supabase
      .from('papel_permissoes')
      .insert(chaves.map(c => ({ papel_id: papelId, chave: c })))
    if (insErr) return { error: 'Erro ao gravar novas permissões.' }
  }

  revalidatePath('/admin/configuracoes/papeis')
  revalidatePath(`/admin/configuracoes/papeis/${papelId}`)
  return { success: true }
}

// ── DUPLICAR ──────────────────────────────────────────────────────────────────

export async function duplicarPapelAction(papelId: string) {
  const denied = await ensurePermissao()
  if (denied) return denied

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const { data: original } = await supabase
    .from('papeis')
    .select('id, escola_id, nome, descricao')
    .eq('id', papelId)
    .eq('escola_id', escolaId)
    .maybeSingle()

  if (!original) return { error: 'Papel não encontrado.' }

  const { data: perms } = await supabase
    .from('papel_permissoes')
    .select('chave')
    .eq('papel_id', papelId)

  const novoNome = `${original.nome} (cópia)`

  const { data: novo, error: insertErr } = await supabase
    .from('papeis')
    .insert({
      escola_id: escolaId,
      nome: novoNome,
      descricao: original.descricao,
      preset: false,
      chave_preset: null,
    })
    .select('id')
    .single()

  if (insertErr || !novo) return { error: 'Erro ao duplicar papel.' }

  const chaves = (perms ?? []).map((p: { chave: string }) => p.chave)
  if (chaves.length > 0) {
    const { error: permsErr } = await supabase
      .from('papel_permissoes')
      .insert(chaves.map(c => ({ papel_id: novo.id, chave: c })))
    if (permsErr) return { error: 'Cópia criada, mas falhou ao copiar permissões.' }
  }

  revalidatePath('/admin/configuracoes/papeis')
  return { success: true, papelId: novo.id as string }
}

// ── EXCLUIR ───────────────────────────────────────────────────────────────────

export async function excluirPapelAction(papelId: string) {
  const denied = await ensurePermissao()
  if (denied) return denied

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const { data: papel } = await supabase
    .from('papeis')
    .select('id, preset')
    .eq('id', papelId)
    .eq('escola_id', escolaId)
    .maybeSingle()

  if (!papel) return { error: 'Papel não encontrado.' }
  if (papel.preset) return { error: 'Papéis preset não podem ser excluídos.' }

  const { count } = await supabase
    .from('usuario_papel')
    .select('id', { count: 'exact', head: true })
    .eq('papel_id', papelId)

  if ((count ?? 0) > 0) {
    return { error: `Este papel está em uso por ${count} usuário(s). Reatribua antes de excluir.` }
  }

  const { error: delErr } = await supabase
    .from('papeis')
    .delete()
    .eq('id', papelId)

  if (delErr) return { error: 'Erro ao excluir papel.' }

  revalidatePath('/admin/configuracoes/papeis')
  return { success: true }
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npm test -- papeis
```

Expected: 16 passed.

- [ ] **Step 5: Suíte completa**

```bash
npm test
```

Expected: 76 passed (60 + 16).

- [ ] **Step 6: Commit + push**

```bash
git add app/actions/configuracoes/papeis.ts tests/configuracoes/papeis.test.ts
git commit -m "feat(papeis): server actions criar/atualizar/duplicar/excluir + 16 testes"
git push -u origin feat/configuracoes-papeis
```

---

## Task 2: Página de listagem `/admin/configuracoes/papeis`

**Files:**
- Create: `app/(admin)/admin/configuracoes/papeis/page.tsx`
- Create: `app/(admin)/admin/configuracoes/papeis/PapelCard.tsx`

- [ ] **Step 1: Criar `page.tsx` (server)**

```typescript
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { hasPermission } from '@/lib/permissoes'
import { PapelCard } from './PapelCard'

type PapelComMeta = {
  id: string
  nome: string
  descricao: string | null
  preset: boolean
  chave_preset: string | null
  qtd_usuarios: number
  qtd_permissoes: number
}

export default async function PapeisListPage() {
  if (!(await hasPermission('configuracoes.gerenciar_papeis'))) {
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

  const { data: papeisRaw } = await supabase
    .from('papeis')
    .select('id, nome, descricao, preset, chave_preset')
    .eq('escola_id', escolaId)
    .order('preset', { ascending: false })
    .order('nome')

  const papeis = (papeisRaw ?? []) as Array<{
    id: string; nome: string; descricao: string | null; preset: boolean; chave_preset: string | null
  }>

  // Contagem de usuários e permissões por papel (queries separadas pra simplicidade)
  const ids = papeis.map(p => p.id)

  const [usosRes, permsRes] = await Promise.all([
    ids.length > 0
      ? supabase.from('usuario_papel').select('papel_id').in('papel_id', ids)
      : Promise.resolve({ data: [] as Array<{ papel_id: string }> }),
    ids.length > 0
      ? supabase.from('papel_permissoes').select('papel_id').in('papel_id', ids)
      : Promise.resolve({ data: [] as Array<{ papel_id: string }> }),
  ])

  const usosMap: Record<string, number> = {}
  for (const r of (usosRes.data ?? []) as Array<{ papel_id: string }>) {
    usosMap[r.papel_id] = (usosMap[r.papel_id] ?? 0) + 1
  }
  const permsMap: Record<string, number> = {}
  for (const r of (permsRes.data ?? []) as Array<{ papel_id: string }>) {
    permsMap[r.papel_id] = (permsMap[r.papel_id] ?? 0) + 1
  }

  const enriched: PapelComMeta[] = papeis.map(p => ({
    ...p,
    qtd_usuarios: usosMap[p.id] ?? 0,
    qtd_permissoes: permsMap[p.id] ?? 0,
  }))

  return (
    <div>
      <Header />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Link href="/admin/configuracoes/papeis/novo" style={btnPrimary}>
          + Novo papel
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {enriched.map(papel => (
          <PapelCard key={papel.id} papel={papel} />
        ))}
      </div>
    </div>
  )
}

function Header() {
  return (
    <div style={{ marginBottom: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginBottom: 6 }}>
        Papéis & Permissões
      </h1>
      <p style={{ color: '#94a3b8', fontSize: 13 }}>
        Defina quem acessa o quê. 6 presets de fábrica + papéis customizados.
      </p>
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  background: '#f59e0b',
  border: 'none',
  borderRadius: 10,
  padding: '8px 16px',
  color: '#0a1628',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-block',
}
```

- [ ] **Step 2: Criar `PapelCard.tsx` (client)**

```typescript
'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { duplicarPapelAction, excluirPapelAction } from '@/app/actions/configuracoes/papeis'

type Papel = {
  id: string
  nome: string
  descricao: string | null
  preset: boolean
  chave_preset: string | null
  qtd_usuarios: number
  qtd_permissoes: number
}

export function PapelCard({ papel }: { papel: Papel }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const podeExcluir = !papel.preset && papel.qtd_usuarios === 0

  function duplicar() {
    if (!confirm(`Duplicar "${papel.nome}"?`)) return
    startTransition(async () => {
      const r = await duplicarPapelAction(papel.id)
      if ('error' in r && r.error) {
        alert(r.error)
        return
      }
      if (r.papelId) router.push(`/admin/configuracoes/papeis/${r.papelId}`)
    })
  }

  function excluir() {
    if (!confirm(`Excluir o papel "${papel.nome}"? Essa ação não pode ser desfeita.`)) return
    startTransition(async () => {
      const r = await excluirPapelAction(papel.id)
      if ('error' in r && r.error) {
        alert(r.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <article style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc', marginBottom: 2 }}>
            {papel.nome}
          </h3>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>
            {papel.qtd_permissoes} permissão(ões) · {papel.qtd_usuarios} usuário(s)
          </span>
        </div>
        <span style={{
          fontSize: 10,
          fontWeight: 800,
          padding: '3px 8px',
          borderRadius: 999,
          background: papel.preset ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.18)',
          color: papel.preset ? '#f59e0b' : '#a5b4fc',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}>
          {papel.preset ? 'Preset' : 'Custom'}
        </span>
      </header>

      {papel.descricao && (
        <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.4 }}>{papel.descricao}</p>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
        <Link href={`/admin/configuracoes/papeis/${papel.id}`} style={btnSecondary}>Editar</Link>
        <button onClick={duplicar} disabled={pending} style={btnSecondary} type="button">Duplicar</button>
        {podeExcluir && (
          <button onClick={excluir} disabled={pending} style={btnDanger} type="button">Excluir</button>
        )}
      </div>
    </article>
  )
}

const btnSecondary: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: '6px 12px',
  color: '#f8fafc',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  textDecoration: 'none',
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

- [ ] **Step 3: Validar tsc + commit**

```bash
npx tsc --noEmit
git add app/\(admin\)/admin/configuracoes/papeis/page.tsx app/\(admin\)/admin/configuracoes/papeis/PapelCard.tsx
git commit -m "feat(papeis): listagem /admin/configuracoes/papeis com cards e ações"
git push
```

---

## Task 3: Editor de papel (`/papeis/novo` e `/papeis/[id]`)

**Files:**
- Create: `app/(admin)/admin/configuracoes/papeis/PapelEditor.tsx`
- Create: `app/(admin)/admin/configuracoes/papeis/novo/page.tsx`
- Create: `app/(admin)/admin/configuracoes/papeis/[id]/page.tsx`

- [ ] **Step 1: Criar `PapelEditor.tsx` (client)**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PERMISSION_GROUPS } from '@/lib/permissoes/keys'
import { criarPapelAction, atualizarPapelAction } from '@/app/actions/configuracoes/papeis'

export type PapelEditorInitial = {
  papelId?: string
  nome: string
  descricao: string
  preset: boolean
  chavesAtuais: string[]
}

export function PapelEditor({ initial }: { initial: PapelEditorInitial }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [chaves, setChaves] = useState<Set<string>>(new Set(initial.chavesAtuais))

  const isEditing = !!initial.papelId
  const isPreset = initial.preset

  function toggleChave(c: string) {
    setChaves(prev => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  }

  function marcarTodasDoModulo(modulo: string) {
    const novas = PERMISSION_GROUPS.find(g => g.modulo === modulo)?.permissoes.map(p => p.chave) ?? []
    setChaves(prev => {
      const next = new Set(prev)
      const todasMarcadas = novas.every(k => next.has(k))
      if (todasMarcadas) novas.forEach(k => next.delete(k))
      else novas.forEach(k => next.add(k))
      return next
    })
  }

  function marcarSoVer() {
    setChaves(() => {
      const next = new Set<string>()
      for (const g of PERMISSION_GROUPS) {
        for (const p of g.permissoes) {
          if (p.chave.endsWith('.ver')) next.add(p.chave)
        }
      }
      return next
    })
  }

  async function onSubmit(formData: FormData) {
    setMsg(null)
    Array.from(chaves).forEach(c => formData.append('chaves', c))
    startTransition(async () => {
      const r = isEditing
        ? await atualizarPapelAction(initial.papelId!, formData)
        : await criarPapelAction(formData)
      if ('error' in r && r.error) {
        setMsg({ tipo: 'erro', texto: r.error })
        return
      }
      const novoId = ('papelId' in r ? r.papelId : initial.papelId)!
      router.push(`/admin/configuracoes/papeis`)
      router.refresh()
      void novoId
    })
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link href="/admin/configuracoes/papeis" style={{ fontSize: 12, color: '#94a3b8', textDecoration: 'none' }}>
          ← Voltar para papéis
        </Link>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginTop: 6 }}>
          {isEditing ? 'Editar papel' : 'Novo papel customizado'}
        </h1>
        {isPreset && (
          <p style={{ fontSize: 12, color: '#fbbf24', marginTop: 6 }}>
            ⚠️ Este é um papel padrão. Alterações afetam todos os usuários que o utilizam.
          </p>
        )}
      </div>

      <form action={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 820 }}>
        <Field label="Nome *">
          <input
            name="nome"
            defaultValue={initial.nome}
            required
            minLength={2}
            maxLength={50}
            style={inputStyle}
          />
        </Field>

        <Field label="Descrição">
          <input
            name="descricao"
            defaultValue={initial.descricao}
            maxLength={200}
            placeholder="Para que serve este papel?"
            style={inputStyle}
          />
        </Field>

        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc' }}>
              Permissões ({chaves.size})
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={marcarSoVer} style={btnGhost}>Marcar só "ver"</button>
              <button type="button" onClick={() => setChaves(new Set())} style={btnGhost}>Limpar tudo</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {PERMISSION_GROUPS.map(group => {
              const todas = group.permissoes.map(p => p.chave)
              const todasMarcadas = todas.every(k => chaves.has(k))
              return (
                <div key={group.modulo} style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc' }}>{group.rotulo}</span>
                    <button
                      type="button"
                      onClick={() => marcarTodasDoModulo(group.modulo)}
                      style={{ ...btnGhost, fontSize: 10, padding: '2px 8px' }}
                    >
                      {todasMarcadas ? 'Desmarcar' : 'Marcar todas'}
                    </button>
                  </div>
                  {group.permissoes.map(perm => (
                    <label key={perm.chave} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={chaves.has(perm.chave)}
                        onChange={() => toggleChave(perm.chave)}
                        style={{ width: 14, height: 14, accentColor: '#f59e0b', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: 12, color: '#cbd5e1' }}>{perm.rotulo}</span>
                    </label>
                  ))}
                </div>
              )
            })}
          </div>
        </section>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="submit" disabled={pending} style={btnPrimary}>
            {pending ? 'Salvando…' : (isEditing ? 'Salvar alterações' : 'Criar papel')}
          </button>
          <Link href="/admin/configuracoes/papeis" style={{ ...btnGhost, padding: '10px 18px' }}>
            Cancelar
          </Link>
          {msg && (
            <span style={{ fontSize: 13, color: msg.tipo === 'ok' ? '#22c55e' : '#ef4444' }}>
              {msg.texto}
            </span>
          )}
        </div>
      </form>
    </div>
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

const btnGhost: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: '6px 12px',
  color: '#cbd5e1',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-block',
}
```

- [ ] **Step 2: Criar `novo/page.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { hasPermission } from '@/lib/permissoes'
import { PapelEditor } from '../PapelEditor'

export default async function NovoPapelPage() {
  if (!(await hasPermission('configuracoes.gerenciar_papeis'))) {
    redirect('/admin/configuracoes')
  }
  return (
    <PapelEditor
      initial={{
        nome: '',
        descricao: '',
        preset: false,
        chavesAtuais: [],
      }}
    />
  )
}
```

- [ ] **Step 3: Criar `[id]/page.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { hasPermission } from '@/lib/permissoes'
import { PapelEditor } from '../PapelEditor'

export default async function EditarPapelPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await hasPermission('configuracoes.gerenciar_papeis'))) {
    redirect('/admin/configuracoes')
  }

  const { id } = await params
  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) redirect('/admin/configuracoes/papeis')

  const { data: papel } = await supabase
    .from('papeis')
    .select('id, nome, descricao, preset, chave_preset')
    .eq('id', id)
    .eq('escola_id', escolaId)
    .maybeSingle()

  if (!papel) redirect('/admin/configuracoes/papeis')

  const { data: perms } = await supabase
    .from('papel_permissoes')
    .select('chave')
    .eq('papel_id', id)

  return (
    <PapelEditor
      initial={{
        papelId: papel.id,
        nome: papel.nome,
        descricao: papel.descricao ?? '',
        preset: papel.preset,
        chavesAtuais: (perms ?? []).map((p: { chave: string }) => p.chave),
      }}
    />
  )
}
```

- [ ] **Step 4: Validar tsc + build**

```bash
npx tsc --noEmit
npm run build
```

Expected: 0 erros tsc; rotas `/admin/configuracoes/papeis`, `/admin/configuracoes/papeis/novo`, e `/admin/configuracoes/papeis/[id]` aparecem na listagem.

- [ ] **Step 5: Commit + push**

```bash
git add app/\(admin\)/admin/configuracoes/papeis/
git commit -m "feat(papeis): editor de papel (criar/editar) com checkboxes agrupados por módulo"
git push
```

---

## Task 4: Smoke test final + PR + merge

**Files:** nenhum

- [ ] **Step 1: Smoke test manual**

```bash
npm run dev
```

1. Login admin → `/admin/configuracoes/papeis`
2. Listagem mostra 6 presets + papéis customizados (se houver). Cada card tem nome, descrição, contagem de permissões e usuários, badge "Preset"/"Custom", botões Editar/Duplicar/Excluir.
3. **Editar preset Admin:** click Editar → editor abre com aviso amarelo "papel padrão". Tente alterar nome → erro de duplicado se nome bater com outro. Toggle alguma permissão → Salvar → volta pra listagem com qtd_permissoes atualizada.
4. **Novo papel:** click "+ Novo papel" → editor vazio. Digite nome "Custom Test", marque algumas permissões, click Criar → volta pra listagem com novo card.
5. **Duplicar:** click "Duplicar" no card "Custom Test" → confirma → vai pro editor da cópia chamada "Custom Test (cópia)".
6. **Excluir:** botão Excluir só aparece em papéis custom sem usuários. Click → confirma → card some.
7. **Atalhos do editor:** "Marcar só 'ver'" deixa só as 11 chaves `.ver`. "Marcar todas" no header de cada módulo alterna o módulo todo.

- [ ] **Step 2: Commit do plano + abrir PR**

```bash
git add docs/superpowers/plans/2026-05-12-configuracoes-papeis.md
git commit -m "docs: plano do Módulo Papéis & Permissões"
git push

/opt/homebrew/bin/gh pr create --base main --head feat/configuracoes-papeis \
  --title "feat: Módulo Papéis & Permissões" \
  --body "$(cat <<'EOF'
## Summary

Implementa `/admin/configuracoes/papeis` com listagem + editor de papéis. Conclui o tripé de acesso (Fundação criou as tabelas, este PR cria a UI de gestão).

- **Listagem:** cards mostrando os 6 presets + papéis customizados, cada um com badge, contagem de permissões/usuários, botões Editar / Duplicar / Excluir.
- **Editor:** página dedicada (\`/papeis/[id]\` e \`/papeis/novo\`) com nome, descrição e checkboxes agrupados por módulo (29 chaves em 13 grupos). Atalhos "Marcar só \`.ver\`" e "Marcar/desmarcar todas" por grupo.
- **Aviso ao editar preset:** banner amarelo informando que mudanças afetam usuários.
- **Excluir:** só permitido para papéis custom sem usuários (presets bloqueados sempre).

Inclui:
- 4 Server Actions (criar / atualizar / duplicar / excluir) com \`requirePermission('configuracoes.gerenciar_papeis')\`
- **16 novos testes Vitest** cobrindo validação, duplicação, exclusão bloqueada (76 totais)

Sem migrations.

## Test plan

- [ ] Listagem com presets + custom carregando + contagens corretas
- [ ] Criar papel custom → aparece na lista
- [ ] Editar preset → aviso aparece, mudanças persistem
- [ ] Duplicar → cria cópia com nome "<original> (cópia)"
- [ ] Excluir custom sem usuários → some
- [ ] Tentar excluir preset → erro
- [ ] Tentar excluir custom em uso → erro com contagem
- [ ] \`npm test\` → 76 passing
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

- [ ] `/admin/configuracoes/papeis` carrega listagem
- [ ] Editor cria, edita, duplica e exclui corretamente
- [ ] Validações: nome único, presets protegidos contra exclusão, papel em uso protegido
- [ ] 76 testes passando, tsc limpo, build verde
- [ ] PR mergeado em `main`

## Próximo após Papéis

**Plano 6: Módulo Usuários** (`/admin/configuracoes/usuarios`) — listagem de usuários, convite por e-mail (Supabase Invite), atribuição de papel, suspender/reativar, remover (soft delete protegendo último admin).
