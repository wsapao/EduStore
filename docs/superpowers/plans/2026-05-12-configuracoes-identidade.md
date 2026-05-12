# Configurações — Módulo Identidade & Personalização (Plano de Implementação)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar `/admin/configuracoes/loja` permitindo ao admin editar identidade da escola (nome, razão social, CNPJ, slogan, boas-vindas, cor primária), fazer upload de logo/banner/favicon e cadastrar endereço fiscal — tudo persistido na tabela `escolas` (estendida na Fundação).

**Architecture:** Página server-component carrega a `Escola` atual via `getEscolaIdParaAdmin()` (helper novo que prefere `usuario_papel` e cai pra `responsaveis` como fallback). Três blocos visuais (Identidade / Mídias / Endereço) cada um com seu client component e sua Server Action. Uploads usam o bucket `escola-assets` criado na Fundação e seguem o padrão de `app/actions/admin.ts` (timestamp + random no filename, `getPublicUrl` pra URL final). Após cada salvamento, `revalidatePath` invalida a página e a `/loja` pra atualizar a vitrine.

**Tech Stack:** Next.js 15 App Router · Supabase Auth & Storage · TypeScript · Vitest

**Spec:** [2026-05-11-configuracoes-loja-design.md](../specs/2026-05-11-configuracoes-loja-design.md) seção 4.1

**Branch:** `feat/configuracoes-loja` (já criada a partir de `main`)

**Convenção:** Após cada commit, `git push`. PR é aberto e merge é automatizado quando os checks ficarem verdes.

**Sem migrations** — todas as colunas necessárias já foram criadas pela Fundação (`razao_social`, `banner_url`, `slogan`, `texto_boas_vindas`, `favicon_url`, `endereco_*`).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/escola/getEscolaIdParaAdmin.ts` | Resolve `escola_id` pra um user admin (consulta `usuario_papel` primeiro, depois `responsaveis`) |
| `app/actions/configuracoes/identidade.ts` | 3 Server Actions: identidade, endereço, upload de asset |
| `tests/configuracoes/identidade.test.ts` | Tests das 3 actions com mock de Supabase |
| `app/(admin)/admin/configuracoes/loja/page.tsx` | Server component: busca escola, renderiza 3 cards |
| `app/(admin)/admin/configuracoes/loja/IdentidadeForm.tsx` | Client: nome / razão social / CNPJ / slogan / boas-vindas / cor primária |
| `app/(admin)/admin/configuracoes/loja/MidiasCard.tsx` | Client: 3 uploaders (logo, banner, favicon) |
| `app/(admin)/admin/configuracoes/loja/EnderecoForm.tsx` | Client: endereço fiscal (logradouro, número, bairro, cidade, UF, CEP) |

---

## Task 1: Helper `getEscolaIdParaAdmin`

**Files:**
- Create: `lib/escola/getEscolaIdParaAdmin.ts`
- Create: `tests/escola/getEscolaIdParaAdmin.test.ts`

- [ ] **Step 1: Escrever o teste**

`tests/escola/getEscolaIdParaAdmin.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'

function makeSupabase({ vinculo, responsavel }: { vinculo?: { escola_id: string } | null; responsavel?: { escola_id: string } | null }) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
    },
    from: vi.fn((table: string) => {
      if (table === 'usuario_papel') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: vinculo ?? null, error: null }),
            }),
          }),
        }
      }
      if (table === 'responsaveis') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: responsavel ?? null, error: null }),
            }),
          }),
        }
      }
      throw new Error('unexpected table ' + table)
    }),
  } as any
}

describe('getEscolaIdParaAdmin', () => {
  it('retorna escola_id de usuario_papel quando existe', async () => {
    const sb = makeSupabase({ vinculo: { escola_id: 'esc-1' } })
    expect(await getEscolaIdParaAdmin(sb)).toBe('esc-1')
  })

  it('cai pra responsaveis quando nao tem vinculo em usuario_papel', async () => {
    const sb = makeSupabase({ vinculo: null, responsavel: { escola_id: 'esc-2' } })
    expect(await getEscolaIdParaAdmin(sb)).toBe('esc-2')
  })

  it('retorna null quando nao encontra escola em nenhuma fonte', async () => {
    const sb = makeSupabase({ vinculo: null, responsavel: null })
    expect(await getEscolaIdParaAdmin(sb)).toBeNull()
  })

  it('retorna null quando nao ha usuario autenticado', async () => {
    const sb: any = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    }
    expect(await getEscolaIdParaAdmin(sb)).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- getEscolaIdParaAdmin`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

`lib/escola/getEscolaIdParaAdmin.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Resolve a escola_id do usuário autenticado para contexto admin.
 * Tenta usuario_papel primeiro (staff/admins); se não houver vínculo,
 * tenta responsaveis (legado/compatibilidade). Retorna null se nada bater.
 */
export async function getEscolaIdParaAdmin(supabase: SupabaseClient): Promise<string | null> {
  const { data: userRes } = await supabase.auth.getUser()
  const user = userRes?.user
  if (!user) return null

  const { data: vinculo } = await supabase
    .from('usuario_papel')
    .select('escola_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (vinculo?.escola_id) return vinculo.escola_id as string

  const { data: resp } = await supabase
    .from('responsaveis')
    .select('escola_id')
    .eq('id', user.id)
    .maybeSingle()

  return (resp?.escola_id as string | undefined) ?? null
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- getEscolaIdParaAdmin`
Expected: 4 passed.

- [ ] **Step 5: Commit + push**

```bash
git add lib/escola/getEscolaIdParaAdmin.ts tests/escola/getEscolaIdParaAdmin.test.ts
git commit -m "feat(escola): getEscolaIdParaAdmin com fallback usuario_papel → responsaveis"
git push -u origin feat/configuracoes-loja
```

---

## Task 2: Server action `atualizarIdentidadeAction`

**Files:**
- Create: `app/actions/configuracoes/identidade.ts`
- Create: `tests/configuracoes/identidade.test.ts`

- [ ] **Step 1: Escrever o teste**

`tests/configuracoes/identidade.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/permissoes', () => ({ requirePermission: vi.fn() }))
vi.mock('@/lib/escola/getEscolaIdParaAdmin', () => ({ getEscolaIdParaAdmin: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/permissoes'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { atualizarIdentidadeAction } from '@/app/actions/configuracoes/identidade'

function fd(obj: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(obj)) f.append(k, v)
  return f
}

function makeSupabase(updateImpl: ReturnType<typeof vi.fn>) {
  return {
    from: vi.fn(() => ({
      update: updateImpl,
    })),
  } as any
}

describe('atualizarIdentidadeAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('chama requirePermission(configuracoes.editar_identidade)', async () => {
    ;(requirePermission as any).mockRejectedValue(new Error('denied'))
    const r = await atualizarIdentidadeAction(fd({ nome: 'X' }))
    expect(requirePermission).toHaveBeenCalledWith('configuracoes.editar_identidade')
    expect(r.error).toBeDefined()
  })

  it('rejeita nome com menos de 2 caracteres', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    ;(createClient as any).mockResolvedValue(makeSupabase(vi.fn()))
    const r = await atualizarIdentidadeAction(fd({ nome: 'A' }))
    expect(r.error).toMatch(/nome/i)
  })

  it('rejeita slogan com mais de 120 caracteres', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    ;(createClient as any).mockResolvedValue(makeSupabase(vi.fn()))
    const r = await atualizarIdentidadeAction(fd({ nome: 'Escola', slogan: 'x'.repeat(121) }))
    expect(r.error).toMatch(/slogan/i)
  })

  it('rejeita boas_vindas com mais de 500 caracteres', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    ;(createClient as any).mockResolvedValue(makeSupabase(vi.fn()))
    const r = await atualizarIdentidadeAction(fd({ nome: 'Escola', texto_boas_vindas: 'x'.repeat(501) }))
    expect(r.error).toMatch(/boas/i)
  })

  it('atualiza a tabela escolas no caminho feliz', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn(() => ({ eq }))
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    ;(createClient as any).mockResolvedValue({ from: vi.fn(() => ({ update })) })

    const r = await atualizarIdentidadeAction(fd({
      nome: 'Colégio X',
      razao_social: 'Colégio X LTDA',
      cnpj: '12345678000190',
      slogan: 'Aprender',
      texto_boas_vindas: 'Bem-vindo!',
      cor_primaria: '#ff8800',
    }))

    expect(r).toEqual({ success: true })
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      nome: 'Colégio X',
      razao_social: 'Colégio X LTDA',
      cnpj: '12345678000190',
      slogan: 'Aprender',
      texto_boas_vindas: 'Bem-vindo!',
      cor_primaria: '#ff8800',
    }))
    expect(eq).toHaveBeenCalledWith('id', 'esc-1')
  })

  it('retorna erro se update falhar', async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: 'boom' } })
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    ;(createClient as any).mockResolvedValue({ from: vi.fn(() => ({ update: () => ({ eq }) })) })

    const r = await atualizarIdentidadeAction(fd({ nome: 'X' }))
    expect(r.error).toMatch(/salvar/i)
  })

  it('aceita cor_primaria vazia (sem alterar a existente)', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn(() => ({ eq }))
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    ;(createClient as any).mockResolvedValue({ from: vi.fn(() => ({ update })) })

    await atualizarIdentidadeAction(fd({ nome: 'X' }))
    const payload = update.mock.calls[0][0]
    expect(payload).not.toHaveProperty('cor_primaria')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- identidade`
Expected: FAIL — `Cannot find module '@/app/actions/configuracoes/identidade'`.

- [ ] **Step 3: Implementar**

`app/actions/configuracoes/identidade.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission, PermissionDeniedError } from '@/lib/permissoes'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'

export async function atualizarIdentidadeAction(formData: FormData) {
  try {
    await requirePermission('configuracoes.editar_identidade')
  } catch (e) {
    if (e instanceof PermissionDeniedError) return { error: 'Sem permissão.' }
    return { error: 'Sem permissão.' }
  }

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const nome              = (formData.get('nome') as string | null)?.trim() ?? ''
  const razao_social      = (formData.get('razao_social') as string | null)?.trim() || null
  const cnpj              = (formData.get('cnpj') as string | null)?.replace(/\D/g, '') || null
  const slogan            = (formData.get('slogan') as string | null)?.trim() || null
  const texto_boas_vindas = (formData.get('texto_boas_vindas') as string | null)?.trim() || null
  const cor_primaria_raw  = (formData.get('cor_primaria') as string | null)?.trim() || ''

  if (!nome || nome.length < 2) return { error: 'Nome da escola é obrigatório (mín. 2 caracteres).' }
  if (slogan && slogan.length > 120) return { error: 'Slogan deve ter no máximo 120 caracteres.' }
  if (texto_boas_vindas && texto_boas_vindas.length > 500) {
    return { error: 'Texto de boas-vindas deve ter no máximo 500 caracteres.' }
  }
  if (cnpj && cnpj.length !== 14) return { error: 'CNPJ deve ter 14 dígitos.' }

  const payload: Record<string, unknown> = {
    nome,
    razao_social,
    cnpj,
    slogan,
    texto_boas_vindas,
  }
  if (cor_primaria_raw && /^#[0-9a-fA-F]{6}$/.test(cor_primaria_raw)) {
    payload.cor_primaria = cor_primaria_raw
  }

  const { error } = await supabase.from('escolas').update(payload).eq('id', escolaId)
  if (error) return { error: 'Erro ao salvar identidade.' }

  revalidatePath('/admin/configuracoes/loja')
  revalidatePath('/loja')
  return { success: true }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- identidade`
Expected: 7 passed.

- [ ] **Step 5: Commit + push**

```bash
git add app/actions/configuracoes/identidade.ts tests/configuracoes/identidade.test.ts
git commit -m "feat(loja): atualizarIdentidadeAction com validação Zod-like + testes"
git push
```

---

## Task 3: Server action `atualizarEnderecoAction`

**Files:**
- Modify: `app/actions/configuracoes/identidade.ts` (append)
- Modify: `tests/configuracoes/identidade.test.ts` (append)

- [ ] **Step 1: Adicionar teste**

Append:

```typescript
import { atualizarEnderecoAction } from '@/app/actions/configuracoes/identidade'

describe('atualizarEnderecoAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exige permissão configuracoes.editar_identidade', async () => {
    ;(requirePermission as any).mockRejectedValue(new Error('denied'))
    const r = await atualizarEnderecoAction(fd({}))
    expect(requirePermission).toHaveBeenCalledWith('configuracoes.editar_identidade')
    expect(r.error).toBeDefined()
  })

  it('rejeita CEP com formato inválido', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    const r = await atualizarEnderecoAction(fd({ endereco_cep: '123' }))
    expect(r.error).toMatch(/cep/i)
  })

  it('rejeita UF com mais de 2 caracteres', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    const r = await atualizarEnderecoAction(fd({ endereco_uf: 'SPP' }))
    expect(r.error).toMatch(/uf/i)
  })

  it('salva endereço completo com CEP e UF normalizados', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn(() => ({ eq }))
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    ;(createClient as any).mockResolvedValue({ from: vi.fn(() => ({ update })) })

    const r = await atualizarEnderecoAction(fd({
      endereco_logradouro: 'Rua das Flores',
      endereco_numero: '123',
      endereco_bairro: 'Centro',
      endereco_cidade: 'Recife',
      endereco_uf: 'pe',
      endereco_cep: '50000-000',
    }))

    expect(r).toEqual({ success: true })
    expect(update).toHaveBeenCalledWith({
      endereco_logradouro: 'Rua das Flores',
      endereco_numero: '123',
      endereco_bairro: 'Centro',
      endereco_cidade: 'Recife',
      endereco_uf: 'PE',
      endereco_cep: '50000000',
    })
  })

  it('aceita endereço parcial (campos vazios viram null)', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn(() => ({ eq }))
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    ;(createClient as any).mockResolvedValue({ from: vi.fn(() => ({ update })) })

    await atualizarEnderecoAction(fd({ endereco_cidade: 'Recife' }))
    expect(update).toHaveBeenCalledWith({
      endereco_logradouro: null,
      endereco_numero: null,
      endereco_bairro: null,
      endereco_cidade: 'Recife',
      endereco_uf: null,
      endereco_cep: null,
    })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- identidade`
Expected: 5 falhas novas (export não existe).

- [ ] **Step 3: Implementar (append)**

Append em `app/actions/configuracoes/identidade.ts`:

```typescript

export async function atualizarEnderecoAction(formData: FormData) {
  try {
    await requirePermission('configuracoes.editar_identidade')
  } catch {
    return { error: 'Sem permissão.' }
  }

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const logradouro = (formData.get('endereco_logradouro') as string | null)?.trim() || null
  const numero     = (formData.get('endereco_numero') as string | null)?.trim() || null
  const bairro     = (formData.get('endereco_bairro') as string | null)?.trim() || null
  const cidade     = (formData.get('endereco_cidade') as string | null)?.trim() || null
  const ufRaw      = (formData.get('endereco_uf') as string | null)?.trim() || null
  const cepRaw     = (formData.get('endereco_cep') as string | null)?.trim() || null

  let uf: string | null = null
  if (ufRaw) {
    const u = ufRaw.toUpperCase()
    if (u.length !== 2 || !/^[A-Z]{2}$/.test(u)) return { error: 'UF deve ter exatamente 2 letras.' }
    uf = u
  }

  let cep: string | null = null
  if (cepRaw) {
    const digits = cepRaw.replace(/\D/g, '')
    if (digits.length !== 8) return { error: 'CEP deve ter 8 dígitos.' }
    cep = digits
  }

  const { error } = await supabase
    .from('escolas')
    .update({
      endereco_logradouro: logradouro,
      endereco_numero: numero,
      endereco_bairro: bairro,
      endereco_cidade: cidade,
      endereco_uf: uf,
      endereco_cep: cep,
    })
    .eq('id', escolaId)

  if (error) return { error: 'Erro ao salvar endereço.' }

  revalidatePath('/admin/configuracoes/loja')
  return { success: true }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- identidade`
Expected: 12 passed.

- [ ] **Step 5: Commit + push**

```bash
git add app/actions/configuracoes/identidade.ts tests/configuracoes/identidade.test.ts
git commit -m "feat(loja): atualizarEnderecoAction com validação de CEP e UF"
git push
```

---

## Task 4: Server action `uploadAssetEscolaAction`

**Files:**
- Modify: `app/actions/configuracoes/identidade.ts` (append)
- Modify: `tests/configuracoes/identidade.test.ts` (append)

- [ ] **Step 1: Adicionar teste**

Append:

```typescript
import { uploadAssetEscolaAction } from '@/app/actions/configuracoes/identidade'

function makeFile(name: string, type: string, size = 1024): File {
  const blob = new Blob([new Uint8Array(size)], { type })
  return new File([blob], name, { type })
}

describe('uploadAssetEscolaAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejeita kind inválido', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    const r = await uploadAssetEscolaAction('invalido' as any, makeFile('a.png', 'image/png'))
    expect(r.error).toMatch(/tipo/i)
  })

  it('rejeita arquivo vazio', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    const r = await uploadAssetEscolaAction('logo', makeFile('a.png', 'image/png', 0))
    expect(r.error).toMatch(/arquivo/i)
  })

  it('rejeita MIME inválido', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    const r = await uploadAssetEscolaAction('logo', makeFile('a.exe', 'application/octet-stream'))
    expect(r.error).toMatch(/imagem/i)
  })

  it('rejeita arquivo maior que 2MB', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    const r = await uploadAssetEscolaAction('banner', makeFile('big.jpg', 'image/jpeg', 3 * 1024 * 1024))
    expect(r.error).toMatch(/2/)
  })

  it('faz upload no bucket escola-assets e atualiza coluna correspondente', async () => {
    const upload = vi.fn().mockResolvedValue({ data: { path: 'esc-1/logo-123.png' }, error: null })
    const getPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://supabase/.../logo-123.png' } })
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn(() => ({ eq }))

    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    ;(createClient as any).mockResolvedValue({
      storage: { from: vi.fn(() => ({ upload, getPublicUrl })) },
      from: vi.fn(() => ({ update })),
    })

    const r = await uploadAssetEscolaAction('logo', makeFile('logo.png', 'image/png'))
    expect(r).toEqual({ success: true, url: 'https://supabase/.../logo-123.png' })
    expect(upload).toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith({ logo_url: 'https://supabase/.../logo-123.png' })
  })

  it('atualiza banner_url quando kind=banner', async () => {
    const upload = vi.fn().mockResolvedValue({ data: { path: 'esc-1/banner.jpg' }, error: null })
    const getPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://x/banner.jpg' } })
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn(() => ({ eq }))

    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    ;(createClient as any).mockResolvedValue({
      storage: { from: vi.fn(() => ({ upload, getPublicUrl })) },
      from: vi.fn(() => ({ update })),
    })

    await uploadAssetEscolaAction('banner', makeFile('banner.jpg', 'image/jpeg'))
    expect(update).toHaveBeenCalledWith({ banner_url: 'https://x/banner.jpg' })
  })

  it('retorna erro se upload falhar', async () => {
    const upload = vi.fn().mockResolvedValue({ data: null, error: { message: 'storage err' } })
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    ;(createClient as any).mockResolvedValue({
      storage: { from: vi.fn(() => ({ upload, getPublicUrl: vi.fn() })) },
      from: vi.fn(),
    })

    const r = await uploadAssetEscolaAction('logo', makeFile('logo.png', 'image/png'))
    expect(r.error).toMatch(/upload/i)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- identidade`
Expected: 7 falhas (export não existe).

- [ ] **Step 3: Implementar (append)**

Append em `app/actions/configuracoes/identidade.ts`:

```typescript

export type AssetKind = 'logo' | 'banner' | 'favicon'

const MIMES_VALIDOS: Record<AssetKind, string[]> = {
  logo:    ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'],
  banner:  ['image/png', 'image/jpeg', 'image/webp'],
  favicon: ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon'],
}

const TAMANHO_MAX = 2 * 1024 * 1024 // 2MB

const COLUNAS: Record<AssetKind, 'logo_url' | 'banner_url' | 'favicon_url'> = {
  logo: 'logo_url',
  banner: 'banner_url',
  favicon: 'favicon_url',
}

export async function uploadAssetEscolaAction(kind: AssetKind, file: File) {
  try {
    await requirePermission('configuracoes.editar_identidade')
  } catch {
    return { error: 'Sem permissão.' }
  }

  if (!['logo', 'banner', 'favicon'].includes(kind)) {
    return { error: 'Tipo de asset inválido.' }
  }
  if (!file || file.size === 0) {
    return { error: 'Arquivo vazio.' }
  }
  if (!MIMES_VALIDOS[kind].includes(file.type)) {
    return { error: 'Formato de imagem não suportado para este campo.' }
  }
  if (file.size > TAMANHO_MAX) {
    return { error: 'Arquivo maior que 2 MB.' }
  }

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const extMatch = /\.([a-zA-Z0-9]+)$/.exec(file.name)
  const ext = (extMatch?.[1] ?? 'bin').toLowerCase()
  const fileName = `${escolaId}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { data: upData, error: upErr } = await supabase
    .storage
    .from('escola-assets')
    .upload(fileName, file, { upsert: false, contentType: file.type })

  if (upErr || !upData) return { error: 'Falha no upload do arquivo.' }

  const { data: pub } = supabase.storage.from('escola-assets').getPublicUrl(upData.path)
  const url = pub.publicUrl

  const { error: updErr } = await supabase
    .from('escolas')
    .update({ [COLUNAS[kind]]: url })
    .eq('id', escolaId)

  if (updErr) return { error: 'Upload OK, mas falhou ao atualizar a escola.' }

  revalidatePath('/admin/configuracoes/loja')
  revalidatePath('/loja')
  return { success: true, url }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- identidade`
Expected: 19 passed.

- [ ] **Step 5: Rodar TODA a suíte para garantir que nada quebrou**

Run: `npm test`
Expected: 4 + 6 + 12 = passing dos módulos anteriores + 19 novos. Some todos os arquivos de teste.

- [ ] **Step 6: Commit + push**

```bash
git add app/actions/configuracoes/identidade.ts tests/configuracoes/identidade.test.ts
git commit -m "feat(loja): uploadAssetEscolaAction (logo/banner/favicon) com validação de MIME e tamanho"
git push
```

---

## Task 5: Página `/admin/configuracoes/loja`

**Files:**
- Create: `app/(admin)/admin/configuracoes/loja/page.tsx`

- [ ] **Step 1: Criar a página (server component)**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { hasPermission } from '@/lib/permissoes'
import type { Escola } from '@/types/database'
import { IdentidadeForm } from './IdentidadeForm'
import { MidiasCard } from './MidiasCard'
import { EnderecoForm } from './EnderecoForm'

export default async function LojaConfigPage() {
  if (!(await hasPermission('configuracoes.editar_identidade'))) {
    redirect('/admin/configuracoes')
  }

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginBottom: 16 }}>
          Identidade & Personalização
        </h1>
        <p style={{ color: '#94a3b8' }}>
          Sua conta não está vinculada a uma escola.
        </p>
      </div>
    )
  }

  const { data: escola } = await supabase
    .from('escolas')
    .select('*')
    .eq('id', escolaId)
    .single<Escola>()

  if (!escola) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginBottom: 16 }}>
          Identidade & Personalização
        </h1>
        <p style={{ color: '#ef4444' }}>Escola não encontrada.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginBottom: 24 }}>
        Identidade & Personalização
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 820 }}>
        <Card titulo="Identidade da loja">
          <IdentidadeForm escola={escola} />
        </Card>

        <Card titulo="Logo, banner e favicon">
          <MidiasCard escola={escola} />
        </Card>

        <Card titulo="Endereço fiscal">
          <EnderecoForm escola={escola} />
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

- [ ] **Step 2: tsc falha esperado (3 componentes faltando)**

Run: `npx tsc --noEmit`
Expected: erros sobre IdentidadeForm, MidiasCard, EnderecoForm.

> Não commita ainda — vamos criar os 3 nas próximas tarefas.

---

## Task 6: `IdentidadeForm` (client)

**Files:**
- Create: `app/(admin)/admin/configuracoes/loja/IdentidadeForm.tsx`

- [ ] **Step 1: Criar**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { atualizarIdentidadeAction } from '@/app/actions/configuracoes/identidade'
import type { Escola } from '@/types/database'

export function IdentidadeForm({ escola }: { escola: Escola }) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [cor, setCor] = useState(escola.cor_primaria || '#1a2f5a')

  async function onSubmit(formData: FormData) {
    setMsg(null)
    startTransition(async () => {
      const r = await atualizarIdentidadeAction(formData)
      if ('error' in r && r.error) setMsg({ tipo: 'erro', texto: r.error })
      else setMsg({ tipo: 'ok', texto: 'Identidade atualizada!' })
    })
  }

  return (
    <form action={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Field label="Nome fantasia *">
        <input name="nome" defaultValue={escola.nome ?? ''} required minLength={2} style={inputStyle} />
      </Field>

      <Field label="Razão social">
        <input name="razao_social" defaultValue={escola.razao_social ?? ''} style={inputStyle} />
      </Field>

      <Field label="CNPJ (somente números ou com máscara)">
        <input name="cnpj" defaultValue={escola.cnpj ?? ''} maxLength={18} style={inputStyle} />
      </Field>

      <Field label="Slogan (máx. 120 caracteres)">
        <input name="slogan" defaultValue={escola.slogan ?? ''} maxLength={120} style={inputStyle} />
      </Field>

      <Field label="Texto de boas-vindas (máx. 500 caracteres)">
        <textarea
          name="texto_boas_vindas"
          defaultValue={escola.texto_boas_vindas ?? ''}
          maxLength={500}
          rows={3}
          style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
        />
      </Field>

      <Field label="Cor primária">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="color"
            name="cor_primaria"
            value={cor}
            onChange={e => setCor(e.target.value)}
            style={{ width: 56, height: 40, border: 'none', borderRadius: 8, background: 'none', cursor: 'pointer' }}
          />
          <code style={{ fontSize: 13, color: '#94a3b8' }}>{cor}</code>
        </div>
      </Field>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="submit" disabled={pending} style={btnPrimary}>
          {pending ? 'Salvando…' : 'Salvar identidade'}
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

- [ ] **Step 2: Commit (tsc ainda incompleto)**

```bash
git add app/\(admin\)/admin/configuracoes/loja/IdentidadeForm.tsx
git commit -m "feat(loja): IdentidadeForm com nome, CNPJ, slogan e cor primária"
git push
```

---

## Task 7: `MidiasCard` (client com 3 uploaders)

**Files:**
- Create: `app/(admin)/admin/configuracoes/loja/MidiasCard.tsx`

- [ ] **Step 1: Criar**

```typescript
'use client'

import { useState, useTransition, useRef } from 'react'
import { uploadAssetEscolaAction, type AssetKind } from '@/app/actions/configuracoes/identidade'
import type { Escola } from '@/types/database'

export function MidiasCard({ escola }: { escola: Escola }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Uploader kind="logo"    label="Logo"    descricao="PNG, JPG, SVG ou WebP (máx. 2 MB)." atualUrl={escola.logo_url} />
      <Uploader kind="banner"  label="Banner principal" descricao="Recomendado 1920×600. PNG/JPG/WebP (máx. 2 MB)." atualUrl={escola.banner_url} />
      <Uploader kind="favicon" label="Favicon" descricao="PNG ou ICO (máx. 2 MB)." atualUrl={escola.favicon_url} />
    </div>
  )
}

function Uploader({
  kind,
  label,
  descricao,
  atualUrl,
}: {
  kind: AssetKind
  label: string
  descricao: string
  atualUrl: string | null
}) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [preview, setPreview] = useState<string | null>(atualUrl)
  const inputRef = useRef<HTMLInputElement>(null)

  function escolher() {
    inputRef.current?.click()
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setMsg(null)
    startTransition(async () => {
      const r = await uploadAssetEscolaAction(kind, file)
      if ('error' in r && r.error) {
        setMsg({ tipo: 'erro', texto: r.error })
        return
      }
      setPreview(r.url ?? null)
      setMsg({ tipo: 'ok', texto: 'Atualizado!' })
    })
    e.target.value = ''
  }

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <div
        style={{
          width: 120,
          height: 80,
          borderRadius: 10,
          background: 'rgba(0,0,0,0.25)',
          border: '1px dashed rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={label} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        ) : (
          <span style={{ fontSize: 11, color: '#64748b' }}>(vazio)</span>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>{label}</span>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{descricao}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
          <input ref={inputRef} type="file" accept="image/*" onChange={onPick} style={{ display: 'none' }} />
          <button onClick={escolher} disabled={pending} style={btnSecondary} type="button">
            {pending ? 'Enviando…' : 'Escolher arquivo'}
          </button>
          {msg && (
            <span style={{ fontSize: 12, color: msg.tipo === 'ok' ? '#22c55e' : '#ef4444' }}>
              {msg.texto}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

const btnSecondary: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: '8px 14px',
  color: '#f8fafc',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(admin\)/admin/configuracoes/loja/MidiasCard.tsx
git commit -m "feat(loja): MidiasCard com 3 uploaders (logo/banner/favicon)"
git push
```

---

## Task 8: `EnderecoForm` (client)

**Files:**
- Create: `app/(admin)/admin/configuracoes/loja/EnderecoForm.tsx`

- [ ] **Step 1: Criar**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { atualizarEnderecoAction } from '@/app/actions/configuracoes/identidade'
import type { Escola } from '@/types/database'

const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]

export function EnderecoForm({ escola }: { escola: Escola }) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  async function onSubmit(formData: FormData) {
    setMsg(null)
    startTransition(async () => {
      const r = await atualizarEnderecoAction(formData)
      if ('error' in r && r.error) setMsg({ tipo: 'erro', texto: r.error })
      else setMsg({ tipo: 'ok', texto: 'Endereço atualizado!' })
    })
  }

  return (
    <form action={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
        <Field label="Logradouro">
          <input name="endereco_logradouro" defaultValue={escola.endereco_logradouro ?? ''} style={inputStyle} />
        </Field>
        <Field label="Número">
          <input name="endereco_numero" defaultValue={escola.endereco_numero ?? ''} style={inputStyle} />
        </Field>
      </div>

      <Field label="Bairro">
        <input name="endereco_bairro" defaultValue={escola.endereco_bairro ?? ''} style={inputStyle} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 14 }}>
        <Field label="Cidade">
          <input name="endereco_cidade" defaultValue={escola.endereco_cidade ?? ''} style={inputStyle} />
        </Field>
        <Field label="UF">
          <select name="endereco_uf" defaultValue={escola.endereco_uf ?? ''} style={inputStyle as any}>
            <option value="">—</option>
            {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </Field>
        <Field label="CEP">
          <input
            name="endereco_cep"
            defaultValue={escola.endereco_cep ?? ''}
            maxLength={9}
            placeholder="00000-000"
            style={inputStyle}
          />
        </Field>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="submit" disabled={pending} style={btnPrimary}>
          {pending ? 'Salvando…' : 'Salvar endereço'}
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

- [ ] **Step 2: tsc deve passar agora (3 componentes existem)**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 3: Build deve listar a rota**

Run: `npm run build`
Expected: `/admin/configuracoes/loja` aparece na listagem.

- [ ] **Step 4: Commit (com a página da Task 5 que ficou pendente)**

```bash
git add app/\(admin\)/admin/configuracoes/loja/EnderecoForm.tsx app/\(admin\)/admin/configuracoes/loja/page.tsx
git commit -m "feat(loja): EnderecoForm + página /admin/configuracoes/loja"
git push
```

---

## Task 9: Renderizar banner e slogan na loja online

**Files:**
- Modify: `app/(loja)/loja/page.tsx` (ou onde for o hero — verificar)

- [ ] **Step 1: Localizar o hero da loja**

Run: `grep -rn "cor_primaria\|escola.nome\|escolaThemeStyle" app/\(loja\)/loja/ 2>/dev/null | head -5`

Identifique o arquivo da página da loja (provavelmente `app/(loja)/loja/page.tsx`) e a região onde o nome da escola e a cor são usadas.

- [ ] **Step 2: Adicionar banner e slogan no topo**

No arquivo identificado, logo no topo do conteúdo principal (acima do grid de produtos), adicionar:

```tsx
{escola.banner_url && (
  <div style={{
    width: '100%',
    height: 240,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    background: '#0a1628',
  }}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src={escola.banner_url}
      alt={escola.nome}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  </div>
)}

{(escola.slogan || escola.texto_boas_vindas) && (
  <div style={{ marginBottom: 24 }}>
    {escola.slogan && (
      <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand, #1a2f5a)', marginBottom: 4 }}>
        {escola.slogan}
      </h2>
    )}
    {escola.texto_boas_vindas && (
      <p style={{ fontSize: 14, color: '#475569' }}>
        {escola.texto_boas_vindas}
      </p>
    )}
  </div>
)}
```

> **Não invente estilos novos.** Use os tokens existentes (`var(--brand)` já é injetado). Se o arquivo tiver classes Tailwind ou CSS módulos, mantenha a coerência local.

- [ ] **Step 3: Validar**

Run: `npx tsc --noEmit` (0 erros) + `npm run build` (sucesso).

- [ ] **Step 4: Commit + push**

```bash
git add app/\(loja\)/loja/page.tsx
git commit -m "feat(loja): renderiza banner, slogan e boas-vindas na vitrine"
git push
```

---

## Task 10: Smoke test final + PR

**Files:** nenhum

- [ ] **Step 1: Suite completa**

Run: `npm test`
Expected: 25 + 19 = 44 testes passando.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: sucesso, rotas `/admin/configuracoes/loja` e `/loja` listadas.

- [ ] **Step 3: Smoke test manual**

Run: `npm run dev`

1. Login como admin → abrir `/admin/configuracoes/loja`
2. **Identidade:** alterar nome / slogan / cor primária → Salvar → confirmar feedback "Identidade atualizada!". Recarregar e ver persistência. Abrir `/loja` em outra aba → slogan deve aparecer.
3. **Mídias:** clicar "Escolher arquivo" para Logo → escolher um PNG ≤ 2 MB → preview atualiza após upload e mensagem verde "Atualizado!". Tentar arquivo > 2 MB → mensagem de erro.
4. **Banner:** subir um banner (1920×600 idealmente) → abrir `/loja` → banner aparece no topo.
5. **Endereço:** preencher tudo e Salvar → recarregar e confirmar persistência.

- [ ] **Step 4: Abrir PR via gh**

```bash
/opt/homebrew/bin/gh pr create --base main --head feat/configuracoes-loja --title "feat: Módulo Identidade & Personalização da loja" --body "$(cat <<'EOF'
## Summary

Implementa `/admin/configuracoes/loja` com 3 blocos:

- **Identidade da loja:** nome fantasia, razão social, CNPJ, slogan (≤120), texto de boas-vindas (≤500) e color picker pra cor primária.
- **Logo, banner e favicon:** uploads pro bucket `escola-assets` com validação de MIME e tamanho (≤2 MB).
- **Endereço fiscal:** logradouro, número, bairro, cidade, UF (select) e CEP normalizado.

Inclui:
- Helper `getEscolaIdParaAdmin` (prefere `usuario_papel`, fallback pra `responsaveis`)
- 3 Server Actions com `requirePermission('configuracoes.editar_identidade')`
- **19 novos testes Vitest** (validação + uploads mockados)
- Banner e slogan agora aparecem na vitrine `/loja`

Sem migrations — todas as colunas já existem desde a Fundação.

## Test plan

- [ ] `/admin/configuracoes/loja` carrega com 3 cards
- [ ] Identidade: alterar nome/slogan/cor → salvar → persiste após reload
- [ ] Upload de logo ≤ 2 MB → preview atualiza
- [ ] Upload > 2 MB → erro
- [ ] Banner sobe → aparece em `/loja`
- [ ] Endereço com UF inválida → erro
- [ ] CEP < 8 dígitos → erro
- [ ] `npm test` → 44 passing
- [ ] `npm run build` → ok
EOF
)"
```

- [ ] **Step 5: Aguardar checks do Vercel**

Run: `/opt/homebrew/bin/gh pr checks <NUM>` (substituir `<NUM>` pelo número retornado pelo create).
Expected: todos `pass` em 1-3 min.

- [ ] **Step 6: Merge automático**

Quando checks passarem:

```bash
/opt/homebrew/bin/gh pr merge <NUM> --squash --delete-branch
```

---

## Definition of Done

- [ ] `/admin/configuracoes/loja` com 3 blocos (Identidade / Mídias / Endereço)
- [ ] Edição de nome, razão social, CNPJ, slogan, boas-vindas, cor funciona e persiste
- [ ] Upload de logo, banner e favicon funciona com validação
- [ ] Endereço fiscal completo (com UF normalizada e CEP em 8 dígitos)
- [ ] Banner e slogan aparecem na vitrine `/loja`
- [ ] 44 testes passando
- [ ] tsc limpo, build verde
- [ ] PR mergeado pra `main`

## Próximo plano após Identidade

**Plano 4: Módulo Pagamentos** (`/admin/configuracoes/pagamentos`) — métodos aceitos, max parcelas, expiração PIX, webhook secret, chave PIX recebedora, status do `ASAAS_API_KEY` (env).
