# Concurso de Bolsas Esportivas 2027 — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Landing page pública com identidade da ESJT + formulário de inscrição (18 campos) + pagamento Pix R$ 25 sem cadastro + seção de admin com relatórios.

**Architecture:** Tudo dentro do app da Loja (Next.js App Router). Tabela nova `inscricoes_concurso` (service-role only). Server actions gravam e chamam `getGateway()` (Asaas) com `externalReference='concurso:<id>'`; o webhook existente roteia pelo prefixo. Admin novo em `/admin/concurso` com permissão própria.

**Tech Stack:** Next.js (App Router, server actions), Supabase (Postgres + RLS), Asaas via `lib/pagamentos/gateway.ts`, Resend via `lib/email`, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-01-concurso-bolsas-esportivas-design.md`

**Regras do usuário (memória):**
- NUNCA subir dev server local (trava a máquina). Provar por `npx vitest run` + `npx tsc --noEmit`.
- Ao final de tudo: commit + push (deploy automático Vercel).

**Constantes do projeto:**
- Supabase project: `rstsomdurwksoqxbypty`
- `escola_id` ESJT: `5d4b0ca0-b55b-4c7b-a41f-08b83e3ec350`
- Valor: R$ 25,00 · Modalidades: futsal, volei, judo, ginastica, natacao
- Janela: inscrições 2026-07-06 → 2026-08-23 23:59 (America/Recife); pagamento até 2026-08-26 23:59

---

### Task 0: Branch dedicada

**Files:** nenhum (git)

- [ ] **Step 1: Criar branch a partir de `main`**

```bash
cd "/Users/webertsantos/Documents/Hub/Loja virtual/app"
git stash --include-untracked -m "wip-pre-concurso" || true   # só se houver sujeira
git checkout main && git pull
git checkout -b feat/concurso-bolsas-esportivas
```

Nota: o repositório estava em `fix/tsc-test-types`. NÃO misturar. Se `git status` mostrar arquivos modificados não relacionados, deixá-los no stash.

- [ ] **Step 2: Sanidade da suíte no ponto de partida**

Run: `npx vitest run --reporter=dot 2>&1 | tail -5`
Expected: suíte verde (memória: 279/279 na última consolidação; número pode ter crescido).

---

### Task 1: Migração — tabela `inscricoes_concurso`

**Files:**
- Create: `supabase/migrations/20260701_concurso_bolsas_inscricoes.sql`

- [ ] **Step 1: Escrever a migração**

```sql
-- Concurso de Bolsas – Seletivas Esportivas 2027 (ESJT)
-- Tabela de inscrições públicas (sem login). Escrita/leitura APENAS via
-- service role (server actions + webhook). RLS ligada sem policies = nega
-- anon/authenticated; service role bypassa RLS.

CREATE TABLE public.inscricoes_concurso (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id           uuid NOT NULL REFERENCES public.escolas(id),
  numero              text NOT NULL UNIQUE,

  -- Aluno candidato (Q1–Q6)
  aluno_nome          text NOT NULL,
  aluno_nascimento    date NOT NULL,
  turno               text NOT NULL DEFAULT 'tarde',
  serie_2026          text NOT NULL,
  modalidade          text NOT NULL CHECK (modalidade IN ('futsal','volei','judo','ginastica','natacao')),
  instituicao_atual   text NOT NULL,

  -- Responsável 1 (Q7–Q11 + CPF/e-mail p/ Pix e comprovante)
  resp1_nome          text NOT NULL,
  resp1_cpf           text NOT NULL,
  resp1_email         text NOT NULL,
  resp1_telefone      text,
  resp1_endereco      text,
  resp1_profissao     text,
  resp1_parentesco    text,

  -- Responsável 2 (Q12–Q16, opcional)
  resp2_nome          text,
  resp2_endereco      text,
  resp2_telefone      text,
  resp2_profissao     text,
  resp2_parentesco    text,

  -- Irmãos (Q17–Q18)
  tem_irmaos          boolean,
  irmaos_series_2026  text,

  -- LGPD
  consentimento_em    timestamptz,

  -- Pagamento
  valor               numeric(10,2) NOT NULL,
  status_pagamento    text NOT NULL DEFAULT 'pendente'
                        CHECK (status_pagamento IN ('pendente','pago','expirado','cancelado')),
  gateway_id          text,
  pix_qr_code         text,
  pix_qr_code_imagem  text,
  pix_tx_id           text,
  pix_expiracao       timestamptz,
  pago_em             timestamptz,
  valor_liquido       numeric(10,2),

  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inscricoes_concurso_escola_idx     ON public.inscricoes_concurso (escola_id);
CREATE INDEX inscricoes_concurso_status_idx     ON public.inscricoes_concurso (status_pagamento);
CREATE INDEX inscricoes_concurso_modalidade_idx ON public.inscricoes_concurso (modalidade);
CREATE INDEX inscricoes_concurso_gateway_idx    ON public.inscricoes_concurso (gateway_id);

-- Numeração amigável CB2027-0001 via sequence (atômica, imune a RLS —
-- mesmo padrão de 20260603_fix_numero_pedido_rls_sequence.sql)
CREATE SEQUENCE IF NOT EXISTS public.inscricoes_concurso_numero_seq;

CREATE OR REPLACE FUNCTION public.gerar_numero_inscricao_concurso()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
begin
  new.numero := 'CB2027-' ||
                lpad(nextval('public.inscricoes_concurso_numero_seq')::text, 4, '0');
  return new;
end;
$function$;

CREATE TRIGGER trg_gerar_numero_inscricao_concurso
  BEFORE INSERT ON public.inscricoes_concurso
  FOR EACH ROW EXECUTE FUNCTION public.gerar_numero_inscricao_concurso();

-- Hardening: RLS ligada sem policies + revogar do PUBLIC (herança!) —
-- ver lição em project_loja_rpc_execute_hardening: revogar só de
-- anon/authenticated é inócuo, eles herdam de PUBLIC.
ALTER TABLE public.inscricoes_concurso ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.inscricoes_concurso FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.inscricoes_concurso TO service_role;
REVOKE ALL ON SEQUENCE public.inscricoes_concurso_numero_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SEQUENCE public.inscricoes_concurso_numero_seq TO service_role;
REVOKE EXECUTE ON FUNCTION public.gerar_numero_inscricao_concurso() FROM PUBLIC, anon, authenticated;
```

- [ ] **Step 2: Aplicar no Supabase** via MCP `apply_migration` (project `rstsomdurwksoqxbypty`, name `concurso_bolsas_inscricoes`) com o SQL acima.

- [ ] **Step 3: Verificar** via MCP `execute_sql`:

```sql
insert into inscricoes_concurso (escola_id, aluno_nome, aluno_nascimento, serie_2026, modalidade,
  instituicao_atual, resp1_nome, resp1_cpf, resp1_email, valor)
values ('5d4b0ca0-b55b-4c7b-a41f-08b83e3ec350','TESTE','2015-01-01','5º ano','futsal',
  'Escola X','Resp Teste','52998224725','t@t.com',25.00)
returning numero;  -- Expected: CB2027-0001
delete from inscricoes_concurso where aluno_nome = 'TESTE';
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260701_concurso_bolsas_inscricoes.sql
git commit -m "feat(concurso): tabela inscricoes_concurso + sequence + RLS service-role only"
```

---

### Task 2: Validador de CPF compartilhado

**Files:**
- Create: `lib/validacao/cpf.ts`
- Modify: `app/actions/auth.ts` (remover duplicata, importar do novo módulo)
- Test: `tests/lib/validacao-cpf.test.ts`

- [ ] **Step 1: Teste que falha**

```ts
// tests/lib/validacao-cpf.test.ts
import { describe, expect, it } from 'vitest'
import { limparCPF, validarCPF } from '@/lib/validacao/cpf'

describe('validarCPF', () => {
  it('aceita CPF válido com e sem máscara', () => {
    expect(validarCPF('529.982.247-25')).toBe(true)
    expect(validarCPF('52998224725')).toBe(true)
  })
  it('rejeita dígitos repetidos, tamanho errado e verificador inválido', () => {
    expect(validarCPF('111.111.111-11')).toBe(false)
    expect(validarCPF('123')).toBe(false)
    expect(validarCPF('529.982.247-26')).toBe(false)
  })
  it('limparCPF remove tudo que não for dígito', () => {
    expect(limparCPF('529.982.247-25')).toBe('52998224725')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run tests/lib/validacao-cpf.test.ts` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar** movendo o código de `app/actions/auth.ts:20-39` (funções `limparCPF`/`validarCPF`, mesmíssima lógica) para `lib/validacao/cpf.ts` com `export`. Em `auth.ts`, apagar as duas funções privadas e adicionar `import { limparCPF, validarCPF } from '@/lib/validacao/cpf'`.

- [ ] **Step 4: Verificar** — `npx vitest run tests/lib/validacao-cpf.test.ts` PASS e `npx vitest run --reporter=dot 2>&1 | tail -3` (nada quebrou em auth).

- [ ] **Step 5: Commit** — `git commit -m "refactor: extrai validador de CPF para lib/validacao/cpf"`

---

### Task 3: Config do concurso

**Files:**
- Create: `lib/concurso/config.ts`
- Test: `tests/concurso/config.test.ts`

- [ ] **Step 1: Teste que falha**

```ts
// tests/concurso/config.test.ts
import { describe, expect, it } from 'vitest'
import { CONCURSO, inscricoesAbertas, MODALIDADES } from '@/lib/concurso/config'

describe('config do concurso', () => {
  it('expõe valores acordados', () => {
    expect(CONCURSO.escolaId).toBe('5d4b0ca0-b55b-4c7b-a41f-08b83e3ec350')
    expect(CONCURSO.valorInscricao).toBe(25)
    expect(MODALIDADES.map(m => m.slug)).toEqual(['futsal', 'volei', 'judo', 'ginastica', 'natacao'])
  })
  it('inscricoesAbertas respeita a janela 06/07–23/08/2026', () => {
    expect(inscricoesAbertas(new Date('2026-07-05T00:00:00-03:00'))).toBe(false)
    expect(inscricoesAbertas(new Date('2026-07-06T08:00:00-03:00'))).toBe(true)
    expect(inscricoesAbertas(new Date('2026-08-23T23:00:00-03:00'))).toBe(true)
    expect(inscricoesAbertas(new Date('2026-08-24T00:01:00-03:00'))).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar** — FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

```ts
// lib/concurso/config.ts
/** Configuração do Concurso de Bolsas – Seletivas Esportivas 2027 (ESJT). */

export const MODALIDADES = [
  { slug: 'futsal',    nome: 'Futsal',    icone: '⚽' },
  { slug: 'volei',     nome: 'Vôlei',     icone: '🏐' },
  { slug: 'judo',      nome: 'Judô',      icone: '🥋' },
  { slug: 'ginastica', nome: 'Ginástica', icone: '🤸' },
  { slug: 'natacao',   nome: 'Natação',   icone: '🏊' },
] as const

export type ModalidadeSlug = (typeof MODALIDADES)[number]['slug']

export const SERIES_2026 = [
  '1º ano EF', '2º ano EF', '3º ano EF', '4º ano EF', '5º ano EF',
  '6º ano EF', '7º ano EF', '8º ano EF',
  '9º ano EF', '1ª série EM', '2ª série EM',
] as const // série ATUAL (2026); em 2027 cursará a seguinte (2º EF à 3ª EM)

export const CONCURSO = {
  escolaId: '5d4b0ca0-b55b-4c7b-a41f-08b83e3ec350',
  valorInscricao: 25,
  // Janela em America/Recife (UTC-3, sem horário de verão)
  inscricoesAbertura:     new Date('2026-07-06T00:00:00-03:00'),
  inscricoesEncerramento: new Date('2026-08-23T23:59:59-03:00'),
  pagamentoLimite:        new Date('2026-08-26T23:59:59-03:00'),
  editalPdfUrl: '/concurso/edital-bolsas-esportivas-2027.pdf',
} as const

export function inscricoesAbertas(agora: Date = new Date()): boolean {
  return agora >= CONCURSO.inscricoesAbertura && agora <= CONCURSO.inscricoesEncerramento
}
```

- [ ] **Step 4: Rodar** — PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(concurso): config central (valor, janela, modalidades)"`

---

### Task 4: Validação do formulário

**Files:**
- Create: `lib/concurso/validacao.ts`
- Test: `tests/concurso/validacao.test.ts`

- [ ] **Step 1: Teste que falha**

```ts
// tests/concurso/validacao.test.ts
import { describe, expect, it } from 'vitest'
import { validarInscricao, type InscricaoInput } from '@/lib/concurso/validacao'

const valida: InscricaoInput = {
  aluno_nome: 'João Pedro Silva', aluno_nascimento: '2015-03-10',
  serie_2026: '5º ano EF', modalidade: 'futsal', instituicao_atual: 'Escola ABC',
  resp1_nome: 'Maria Silva', resp1_cpf: '529.982.247-25', resp1_email: 'maria@email.com',
  resp1_telefone: '(81) 99999-0000', resp1_profissao: 'Enfermeira', resp1_parentesco: 'Mãe',
  resp1_endereco: 'Rua X, 1', resp2_nome: '', resp2_endereco: '', resp2_telefone: '',
  resp2_profissao: '', resp2_parentesco: '', tem_irmaos: false, irmaos_series_2026: '',
  consentimento: true,
}

describe('validarInscricao', () => {
  it('aceita input completo', () => {
    expect(validarInscricao(valida)).toEqual({ ok: true })
  })
  it('exige obrigatórios do aluno e do responsável 1', () => {
    const r = validarInscricao({ ...valida, aluno_nome: ' ', resp1_email: 'x' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.erros).toContain('Informe o nome do estudante.')
      expect(r.erros).toContain('E-mail do responsável inválido.')
    }
  })
  it('rejeita CPF inválido e modalidade desconhecida', () => {
    const r = validarInscricao({ ...valida, resp1_cpf: '111.111.111-11', modalidade: 'xadrez' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.erros).toContain('CPF do responsável inválido.')
      expect(r.erros).toContain('Modalidade inválida.')
    }
  })
  it('exige consentimento LGPD', () => {
    const r = validarInscricao({ ...valida, consentimento: false })
    expect(r.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar**

```ts
// lib/concurso/validacao.ts
import { validarCPF } from '@/lib/validacao/cpf'
import { MODALIDADES } from './config'

export interface InscricaoInput {
  aluno_nome: string; aluno_nascimento: string; serie_2026: string
  modalidade: string; instituicao_atual: string
  resp1_nome: string; resp1_cpf: string; resp1_email: string
  resp1_telefone: string; resp1_endereco: string; resp1_profissao: string; resp1_parentesco: string
  resp2_nome: string; resp2_endereco: string; resp2_telefone: string
  resp2_profissao: string; resp2_parentesco: string
  tem_irmaos: boolean; irmaos_series_2026: string
  consentimento: boolean
}

export type ResultadoValidacao = { ok: true } | { ok: false; erros: string[] }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validarInscricao(i: InscricaoInput): ResultadoValidacao {
  const erros: string[] = []
  if (!i.aluno_nome?.trim()) erros.push('Informe o nome do estudante.')
  if (!i.aluno_nascimento || isNaN(Date.parse(i.aluno_nascimento))) erros.push('Data de nascimento inválida.')
  if (!i.serie_2026?.trim()) erros.push('Informe a série em 2026.')
  if (!MODALIDADES.some(m => m.slug === i.modalidade)) erros.push('Modalidade inválida.')
  if (!i.instituicao_atual?.trim()) erros.push('Informe a instituição de ensino atual.')
  if (!i.resp1_nome?.trim()) erros.push('Informe o nome do responsável.')
  if (!validarCPF(i.resp1_cpf ?? '')) erros.push('CPF do responsável inválido.')
  if (!EMAIL_RE.test(i.resp1_email ?? '')) erros.push('E-mail do responsável inválido.')
  if (!i.consentimento) erros.push('É necessário aceitar o tratamento dos dados (LGPD).')
  return erros.length ? { ok: false, erros } : { ok: true }
}
```

- [ ] **Step 4: Rodar** — PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(concurso): validação server-side da inscrição"`

---

### Task 5: Server actions — criar inscrição + Pix, consultar status, novo Pix

**Files:**
- Create: `app/actions/concurso.ts`
- Test: `tests/concurso/actions.test.ts`

- [ ] **Step 1: Testes que falham**

```ts
// tests/concurso/actions.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const criarPagamento = vi.fn()
vi.mock('@/lib/pagamentos/gateway', () => ({ getGateway: () => ({ criarPagamento }) }))

// Mock encadeável mínimo do supabase-js (padrão da suíte: sempre incluir .select)
const single = vi.fn()
const insertSelect = vi.fn(() => ({ single }))
const insert = vi.fn(() => ({ select: insertSelect }))
const updateEq = vi.fn(() => Promise.resolve({ error: null }))
const update = vi.fn(() => ({ eq: updateEq }))
const maybeSingle = vi.fn()
const selectEq = vi.fn(() => ({ maybeSingle, single: maybeSingle }))
const select = vi.fn(() => ({ eq: selectEq }))
const from = vi.fn(() => ({ insert, update, select }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from }) }))

import { criarInscricaoConcurso, consultarStatusInscricao } from '@/app/actions/concurso'

const INPUT = {
  aluno_nome: 'João', aluno_nascimento: '2015-03-10', serie_2026: '5º ano EF',
  modalidade: 'futsal', instituicao_atual: 'Escola ABC',
  resp1_nome: 'Maria Silva', resp1_cpf: '529.982.247-25', resp1_email: 'maria@email.com',
  resp1_telefone: '', resp1_endereco: '', resp1_profissao: '', resp1_parentesco: 'Mãe',
  resp2_nome: '', resp2_endereco: '', resp2_telefone: '', resp2_profissao: '', resp2_parentesco: '',
  tem_irmaos: false, irmaos_series_2026: '', consentimento: true,
}

describe('criarInscricaoConcurso', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-15T12:00:00-03:00')) // dentro da janela
    single.mockResolvedValue({ data: { id: 'insc-1', numero: 'CB2027-0001' }, error: null })
    criarPagamento.mockResolvedValue({
      metodo: 'pix', gateway_id: 'pay_1', qr_code: 'copiaecola', qr_code_imagem: 'data:image/png;base64,x',
      tx_id: 'tx1', expiracao: '2026-07-15T16:00:00.000Z', status: 'aguardando',
    })
  })

  it('grava inscrição, cria Pix com referencia concurso:<id> e persiste dados do Pix', async () => {
    const r = await criarInscricaoConcurso(INPUT)
    expect(r.success).toBe(true)
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      modalidade: 'futsal', resp1_cpf: '52998224725', valor: 25, status_pagamento: 'pendente',
    }))
    expect(criarPagamento).toHaveBeenCalledWith(expect.objectContaining({
      metodo: 'pix', total: 25, referencia: 'concurso:insc-1',
      responsavel: { nome: 'Maria Silva', email: 'maria@email.com', cpf: '52998224725' },
    }))
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ gateway_id: 'pay_1' }))
    if (r.success) expect(r.pix.qr_code).toBe('copiaecola')
  })

  it('rejeita fora da janela de inscrições', async () => {
    vi.setSystemTime(new Date('2026-09-01T12:00:00-03:00'))
    const r = await criarInscricaoConcurso(INPUT)
    expect(r.success).toBe(false)
    expect(insert).not.toHaveBeenCalled()
  })

  it('rejeita input inválido sem tocar o banco', async () => {
    const r = await criarInscricaoConcurso({ ...INPUT, resp1_cpf: '111.111.111-11' })
    expect(r.success).toBe(false)
    expect(insert).not.toHaveBeenCalled()
    expect(criarPagamento).not.toHaveBeenCalled()
  })
})

describe('consultarStatusInscricao', () => {
  it('retorna o status atual', async () => {
    vi.clearAllMocks()
    maybeSingle.mockResolvedValue({ data: { status_pagamento: 'pago' }, error: null })
    const r = await consultarStatusInscricao('insc-1')
    expect(r).toEqual({ status: 'pago' })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar**

```ts
// app/actions/concurso.ts
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getGateway } from '@/lib/pagamentos/gateway'
import { limparCPF } from '@/lib/validacao/cpf'
import { validarInscricao, type InscricaoInput } from '@/lib/concurso/validacao'
import { CONCURSO, MODALIDADES, inscricoesAbertas } from '@/lib/concurso/config'
import type { ResultadoPix } from '@/lib/pagamentos/types'

export interface PixInfo {
  qr_code: string
  qr_code_imagem: string
  expiracao: string
}

export type CriarInscricaoResult =
  | { success: true; inscricao_id: string; numero: string; pix: PixInfo }
  | { success: false; error: string }

export async function criarInscricaoConcurso(input: InscricaoInput): Promise<CriarInscricaoResult> {
  if (!inscricoesAbertas()) {
    return { success: false, error: 'As inscrições estão encerradas ou ainda não abriram.' }
  }

  const validacao = validarInscricao(input)
  if (!validacao.ok) return { success: false, error: validacao.erros.join(' ') }

  const supabase = createAdminClient()
  const cpf = limparCPF(input.resp1_cpf)

  const { data: inscricao, error: insertErr } = await supabase
    .from('inscricoes_concurso')
    .insert({
      escola_id: CONCURSO.escolaId,
      aluno_nome: input.aluno_nome.trim(),
      aluno_nascimento: input.aluno_nascimento,
      turno: 'tarde',
      serie_2026: input.serie_2026,
      modalidade: input.modalidade,
      instituicao_atual: input.instituicao_atual.trim(),
      resp1_nome: input.resp1_nome.trim(),
      resp1_cpf: cpf,
      resp1_email: input.resp1_email.trim().toLowerCase(),
      resp1_telefone: input.resp1_telefone?.trim() || null,
      resp1_endereco: input.resp1_endereco?.trim() || null,
      resp1_profissao: input.resp1_profissao?.trim() || null,
      resp1_parentesco: input.resp1_parentesco?.trim() || null,
      resp2_nome: input.resp2_nome?.trim() || null,
      resp2_endereco: input.resp2_endereco?.trim() || null,
      resp2_telefone: input.resp2_telefone?.trim() || null,
      resp2_profissao: input.resp2_profissao?.trim() || null,
      resp2_parentesco: input.resp2_parentesco?.trim() || null,
      tem_irmaos: input.tem_irmaos ?? null,
      irmaos_series_2026: input.irmaos_series_2026?.trim() || null,
      consentimento_em: new Date().toISOString(),
      valor: CONCURSO.valorInscricao,
      status_pagamento: 'pendente',
    })
    .select('id, numero')
    .single()

  if (insertErr || !inscricao) {
    console.error('[concurso] Erro ao gravar inscrição:', insertErr?.message)
    return { success: false, error: 'Não foi possível registrar a inscrição. Tente novamente.' }
  }

  const modalidadeNome = MODALIDADES.find(m => m.slug === input.modalidade)?.nome ?? input.modalidade

  let pix: ResultadoPix
  try {
    const resultado = await getGateway().criarPagamento({
      metodo: 'pix',
      total: CONCURSO.valorInscricao,
      responsavel: { nome: input.resp1_nome.trim(), email: input.resp1_email.trim(), cpf },
      descricao: `Inscrição Concurso de Bolsas 2027 – ${modalidadeNome} – ${input.aluno_nome.trim()}`,
      referencia: `concurso:${inscricao.id}`,
    })
    if (resultado.metodo !== 'pix') throw new Error('Gateway não retornou Pix.')
    pix = resultado
  } catch (err) {
    console.error('[concurso] Erro ao criar cobrança Pix:', err)
    return { success: false, error: 'Inscrição registrada, mas houve falha ao gerar o Pix. Tente novamente em instantes.' }
  }

  await supabase
    .from('inscricoes_concurso')
    .update({
      gateway_id: pix.gateway_id,
      pix_qr_code: pix.qr_code,
      pix_qr_code_imagem: pix.qr_code_imagem,
      pix_tx_id: pix.tx_id,
      pix_expiracao: pix.expiracao,
    })
    .eq('id', inscricao.id)

  return {
    success: true,
    inscricao_id: inscricao.id,
    numero: inscricao.numero,
    pix: { qr_code: pix.qr_code, qr_code_imagem: pix.qr_code_imagem, expiracao: pix.expiracao },
  }
}

export async function consultarStatusInscricao(id: string): Promise<{ status: string } | { error: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('inscricoes_concurso')
    .select('status_pagamento')
    .eq('id', id)
    .maybeSingle<{ status_pagamento: string }>()
  if (error || !data) return { error: 'Inscrição não encontrada.' }
  return { status: data.status_pagamento }
}

export type NovoPixResult = { success: true; pix: PixInfo } | { success: false; error: string }

export async function gerarNovoPixInscricao(id: string): Promise<NovoPixResult> {
  const supabase = createAdminClient()
  const { data: insc, error } = await supabase
    .from('inscricoes_concurso')
    .select('id, aluno_nome, modalidade, resp1_nome, resp1_email, resp1_cpf, status_pagamento, valor')
    .eq('id', id)
    .maybeSingle<{ id: string; aluno_nome: string; modalidade: string; resp1_nome: string;
      resp1_email: string; resp1_cpf: string; status_pagamento: string; valor: number }>()

  if (error || !insc) return { success: false, error: 'Inscrição não encontrada.' }
  if (insc.status_pagamento === 'pago') return { success: false, error: 'Esta inscrição já está paga.' }

  const modalidadeNome = MODALIDADES.find(m => m.slug === insc.modalidade)?.nome ?? insc.modalidade
  try {
    const pix = await getGateway().criarPagamento({
      metodo: 'pix',
      total: Number(insc.valor),
      responsavel: { nome: insc.resp1_nome, email: insc.resp1_email, cpf: insc.resp1_cpf },
      descricao: `Inscrição Concurso de Bolsas 2027 – ${modalidadeNome} – ${insc.aluno_nome}`,
      referencia: `concurso:${insc.id}`,
    })
    if (pix.metodo !== 'pix') throw new Error('Gateway não retornou Pix.')
    await supabase
      .from('inscricoes_concurso')
      .update({
        status_pagamento: 'pendente',
        gateway_id: pix.gateway_id,
        pix_qr_code: pix.qr_code,
        pix_qr_code_imagem: pix.qr_code_imagem,
        pix_tx_id: pix.tx_id,
        pix_expiracao: pix.expiracao,
      })
      .eq('id', insc.id)
    return { success: true, pix: { qr_code: pix.qr_code, qr_code_imagem: pix.qr_code_imagem, expiracao: pix.expiracao } }
  } catch (err) {
    console.error('[concurso] Erro ao gerar novo Pix:', err)
    return { success: false, error: 'Falha ao gerar novo Pix. Tente novamente.' }
  }
}
```

Nota: se o mock encadeável do teste não bater com as chamadas reais (ex.: `.select().eq().maybeSingle()`), ajustar o MOCK (não a implementação) — manter o padrão da suíte de sempre incluir `.select` nos mocks (ver memória project_loja_pre_existing_test_failures).

- [ ] **Step 4: Rodar** — `npx vitest run tests/concurso/actions.test.ts` PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(concurso): server actions de inscrição + Pix (sem cadastro)"`

---

### Task 6: E-mail de confirmação

**Files:**
- Modify: `lib/email/templates.ts` (novo template no fim do arquivo)
- Modify: `lib/email/send.ts` (nova função)
- Test: `tests/concurso/email.test.ts`

- [ ] **Step 1: Teste que falha**

```ts
// tests/concurso/email.test.ts
import { describe, expect, it } from 'vitest'
import { emailInscricaoConcurso } from '@/lib/email/templates'

describe('emailInscricaoConcurso', () => {
  it('inclui número, aluno, modalidade e lembretes do edital', () => {
    const { subject, html } = emailInscricaoConcurso({
      responsavelNome: 'Maria', alunoNome: 'João', numero: 'CB2027-0001', modalidade: 'Futsal',
    })
    expect(subject).toContain('CB2027-0001')
    expect(html).toContain('João')
    expect(html).toContain('Futsal')
    expect(html).toContain('30/08')          // prova pedagógica
    expect(html).toContain('declaração de saúde')
    expect(html).toContain('boletim')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar template** (seguir o estilo dos templates existentes — usar o helper `base(...)` do próprio arquivo):

```ts
// lib/email/templates.ts — adicionar no fim
export interface EmailInscricaoConcursoParams {
  responsavelNome: string
  alunoNome: string
  numero: string
  modalidade: string
}

export function emailInscricaoConcurso(p: EmailInscricaoConcursoParams): { subject: string; html: string } {
  const content = `
    <h2 style="margin:0 0 4px;font-size:22px;font-weight:900;color:#34436B;letter-spacing:-.02em;">
      ✅ Inscrição confirmada!
    </h2>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.6;">
      Olá, <strong>${p.responsavelNome}</strong>! Recebemos o pagamento da inscrição de
      <strong>${p.alunoNome}</strong> no Concurso de Bolsas – Seletivas Esportivas 2027
      (modalidade <strong>${p.modalidade}</strong>).
    </p>
    <div style="background:#EDF3FF;border:1px solid #C0CEEA;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
      <div style="font-size:12px;color:#34436B;font-weight:600;">INSCRIÇÃO</div>
      <div style="font-size:16px;font-weight:800;color:#34436B;font-family:monospace;">${p.numero}</div>
    </div>
    <div style="background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:14px 16px;margin-bottom:16px;font-size:13px;color:#7c2d12;line-height:1.7;">
      <strong>Próximos passos:</strong><br>
      • Prova pedagógica: <strong>30/08/2026 (domingo), 08h30–11h30</strong>, na sede do Educandário São Judas Tadeu.<br>
      • Seletiva técnica: 09 a 19/09/2026 (calendário divulgado dia 31/08 nas redes oficiais).<br>
      • No dia da seletiva, levar <strong>declaração de saúde</strong> (apto à prática esportiva) e o <strong>boletim escolar</strong> do ano vigente.
    </div>
    <p style="font-size:12px;color:#94a3b8;">Guarde este e-mail — o número da inscrição será solicitado no dia da prova.</p>
  `
  return {
    subject: `Inscrição ${p.numero} confirmada — Concurso de Bolsas 2027`,
    html: base(`Inscrição confirmada — ${p.numero}`, content),
  }
}
```

```ts
// lib/email/send.ts — adicionar no fim (mesmo padrão das demais: falha não quebra o fluxo)
export async function enviarEmailInscricaoConcurso(
  to: string,
  params: EmailInscricaoConcursoParams
) {
  const resend = getResend()
  if (!resend) return
  const { subject, html } = emailInscricaoConcurso(params)
  try {
    await resend.emails.send({ from: EMAIL_FROM, to, subject, html })
  } catch (err) {
    console.error('[Email] Erro ao enviar confirmação de inscrição do concurso:', err)
  }
}
```

Atualizar o import no topo de `send.ts` para incluir `emailInscricaoConcurso` e `type EmailInscricaoConcursoParams`.

- [ ] **Step 4: Rodar** — PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(concurso): e-mail de confirmação de inscrição"`

---

### Task 7: Webhook — rotear `concurso:` e confirmar pagamento

**Files:**
- Create: `lib/concurso/confirmarPagamento.ts`
- Modify: `app/api/webhook/asaas/route.ts`
- Test: `tests/concurso/webhook.test.ts`

- [ ] **Step 1: Teste que falha**

```ts
// tests/concurso/webhook.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const enviarEmail = vi.fn()
vi.mock('@/lib/email/send', () => ({
  enviarEmailInscricaoConcurso: enviarEmail,
  enviarEmailIngresso: vi.fn(),
}))

const updateSelectSingle = vi.fn()
const updateSelect = vi.fn(() => ({ single: updateSelectSingle }))
const updateEq2 = vi.fn(() => ({ select: updateSelect }))
const updateEq1 = vi.fn(() => ({ eq: updateEq2 }))
const update = vi.fn(() => ({ eq: updateEq1 }))
const from = vi.fn(() => ({ update }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from }) }))

import { confirmarPagamentoConcurso, expirarPagamentoConcurso } from '@/lib/concurso/confirmarPagamento'

describe('confirmarPagamentoConcurso', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marca pago (idempotente) e dispara e-mail', async () => {
    updateSelectSingle.mockResolvedValue({
      data: { id: 'i1', numero: 'CB2027-0001', aluno_nome: 'João', modalidade: 'futsal',
              resp1_nome: 'Maria', resp1_email: 'm@m.com' },
      error: null,
    })
    const r = await confirmarPagamentoConcurso('i1', 24.01)
    expect(r.confirmado).toBe(true)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status_pagamento: 'pago', valor_liquido: 24.01 }))
    expect(updateEq2).toHaveBeenCalledWith('status_pagamento', 'pendente') // idempotência
    expect(enviarEmail).toHaveBeenCalledWith('m@m.com', expect.objectContaining({ numero: 'CB2027-0001' }))
  })

  it('não reenvia e-mail se já estava pago (update não afeta linha)', async () => {
    updateSelectSingle.mockResolvedValue({ data: null, error: { message: 'No rows' } })
    const r = await confirmarPagamentoConcurso('i1')
    expect(r.confirmado).toBe(false)
    expect(enviarEmail).not.toHaveBeenCalled()
  })
})

describe('expirarPagamentoConcurso', () => {
  it('marca expirado apenas se pendente', async () => {
    vi.clearAllMocks()
    updateSelectSingle.mockResolvedValue({ data: { id: 'i1' }, error: null })
    await expirarPagamentoConcurso('i1')
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status_pagamento: 'expirado' }))
    expect(updateEq2).toHaveBeenCalledWith('status_pagamento', 'pendente')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar**

```ts
// lib/concurso/confirmarPagamento.ts
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarEmailInscricaoConcurso } from '@/lib/email/send'
import { MODALIDADES } from './config'

interface InscricaoConfirmada {
  id: string; numero: string; aluno_nome: string; modalidade: string
  resp1_nome: string; resp1_email: string
}

/** Marca a inscrição como paga (idempotente) e dispara o e-mail de confirmação. */
export async function confirmarPagamentoConcurso(
  inscricaoId: string,
  netValue?: number,
): Promise<{ confirmado: boolean }> {
  const supabase = createAdminClient()
  const updateData: Record<string, unknown> = {
    status_pagamento: 'pago',
    pago_em: new Date().toISOString(),
  }
  if (netValue !== undefined && netValue > 0) updateData.valor_liquido = netValue

  const { data, error } = await supabase
    .from('inscricoes_concurso')
    .update(updateData)
    .eq('id', inscricaoId)
    .eq('status_pagamento', 'pendente') // idempotência
    .select('id, numero, aluno_nome, modalidade, resp1_nome, resp1_email')
    .single<InscricaoConfirmada>()

  if (error || !data) return { confirmado: false }

  const modalidadeNome = MODALIDADES.find(m => m.slug === data.modalidade)?.nome ?? data.modalidade
  void enviarEmailInscricaoConcurso(data.resp1_email, {
    responsavelNome: data.resp1_nome,
    alunoNome: data.aluno_nome,
    numero: data.numero,
    modalidade: modalidadeNome,
  })
  return { confirmado: true }
}

/** Marca a inscrição como expirada (apenas se ainda pendente). */
export async function expirarPagamentoConcurso(inscricaoId: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase
    .from('inscricoes_concurso')
    .update({ status_pagamento: 'expirado' })
    .eq('id', inscricaoId)
    .eq('status_pagamento', 'pendente')
    .select('id')
    .single()
}
```

- [ ] **Step 4: Rodar testes da lib** — PASS.

- [ ] **Step 5: Ligar no webhook.** Em `app/api/webhook/asaas/route.ts`:

(a) Import no topo:
```ts
import { confirmarPagamentoConcurso, expirarPagamentoConcurso } from '@/lib/concurso/confirmarPagamento'
```

(b) Logo APÓS o bloco de estorno (`PAYMENT_REFUNDED`) e ANTES do filtro `EVENTOS_CONFIRMACAO`, tratar OVERDUE do concurso:
```ts
  // Concurso de bolsas — Pix vencido
  if (event === 'PAYMENT_OVERDUE' && payment.externalReference?.startsWith('concurso:')) {
    await expirarPagamentoConcurso(payment.externalReference.slice('concurso:'.length))
    return Response.json({ ok: true })
  }
```

(c) Logo APÓS o bloco `recarga:` (dentro dos EVENTOS_CONFIRMACAO), antes da busca de `pagamentos`:
```ts
  // Concurso de bolsas — confirmação de pagamento de inscrição
  if (payment.externalReference?.startsWith('concurso:')) {
    const inscricaoId = payment.externalReference.slice('concurso:'.length)
    const { confirmado } = await confirmarPagamentoConcurso(inscricaoId, payment.netValue)
    console.log(`[webhook/asaas] Inscrição concurso ${inscricaoId} — confirmado=${confirmado}`)
    return Response.json({ ok: true })
  }
```

- [ ] **Step 6: Rodar suíte inteira** — `npx vitest run --reporter=dot 2>&1 | tail -3` (webhook de pedidos/recargas intacto).
- [ ] **Step 7: Commit** — `git commit -m "feat(concurso): webhook roteia externalReference concurso: e confirma inscrição"`

---

### Task 8: Expiração automática (cron)

**Files:**
- Create: `lib/concurso/expirePix.ts`
- Modify: `app/api/cron/expire-pix/route.ts`
- Test: `tests/concurso/expire.test.ts`

- [ ] **Step 1: Teste que falha**

```ts
// tests/concurso/expire.test.ts
import { describe, expect, it, vi } from 'vitest'

const rows = [{ id: 'a' }, { id: 'b' }]
const limit = vi.fn(() => Promise.resolve({ data: rows, error: null }))
const lt = vi.fn(() => ({ limit }))
const eq = vi.fn(() => ({ lt }))
const select = vi.fn(() => ({ eq }))
const updateSingle = vi.fn(() => Promise.resolve({ data: { id: 'x' }, error: null }))
const updateSelect = vi.fn(() => ({ single: updateSingle }))
const updEq2 = vi.fn(() => ({ select: updateSelect }))
const updEq1 = vi.fn(() => ({ eq: updEq2 }))
const update = vi.fn(() => ({ eq: updEq1 }))
const from = vi.fn(() => ({ select, update }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from }) }))

import { expirarPixInscricoesConcurso } from '@/lib/concurso/expirePix'

describe('expirarPixInscricoesConcurso', () => {
  it('expira todas as inscrições pendentes com pix vencido', async () => {
    const r = await expirarPixInscricoesConcurso()
    expect(r.expiradas).toBe(2)
    expect(update).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar**

```ts
// lib/concurso/expirePix.ts
import { createAdminClient } from '@/lib/supabase/admin'

/** Expira inscrições do concurso com Pix vencido e ainda pendentes. */
export async function expirarPixInscricoesConcurso(limite = 200) {
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('inscricoes_concurso')
    .select('id')
    .eq('status_pagamento', 'pendente')
    .lt('pix_expiracao', now)
    .limit(limite)

  if (error) throw new Error(`Erro ao buscar inscrições com Pix expirado: ${error.message}`)

  let expiradas = 0
  for (const row of data ?? []) {
    const { data: updated } = await supabase
      .from('inscricoes_concurso')
      .update({ status_pagamento: 'expirado' })
      .eq('id', row.id)
      .eq('status_pagamento', 'pendente')
      .select('id')
      .single()
    if (updated) expiradas += 1
  }
  return { expiradas, encontradas: data?.length ?? 0 }
}
```

- [ ] **Step 4: Ligar no cron.** Ler `app/api/cron/expire-pix/route.ts`; após a chamada de `executarExpiracaoPixJob(...)`, adicionar:

```ts
import { expirarPixInscricoesConcurso } from '@/lib/concurso/expirePix'
// ... dentro do handler, após o job existente:
const concurso = await expirarPixInscricoesConcurso()
// incluir `concurso` no JSON de resposta ao lado do resultado existente
```

(Adaptar ao formato de resposta que o handler já usa — não alterar o comportamento existente.)

- [ ] **Step 5: Rodar** teste novo + suíte. PASS.
- [ ] **Step 6: Commit** — `git commit -m "feat(concurso): expiração automática de Pix de inscrições no cron"`

---

### Task 9: Página pública — layout + landing

**Files:**
- Create: `app/concurso-bolsas-2027/layout.tsx`
- Create: `app/concurso-bolsas-2027/page.tsx`
- Create: `app/concurso-bolsas-2027/esjt-theme.ts` (tokens)
- Create: `public/concurso/.gitkeep` (o PDF do edital entra aqui quando o usuário enviar)

Identidade (tokens REAIS extraídos do site esjt.com.br — tema Elementor):
navy `#34436B`, vermelho `#C1161A`, azul-claro `#EDF3FF`/`#C0CEEA`/`#D7DFEC`, cinza `#6E7A98`, amarelo `#FFC402`. Títulos **Roboto Slab**, texto **Roboto**. O restante do app NÃO deve ser afetado (fontes só neste segmento de rota).

- [ ] **Step 1: Tokens**

```ts
// app/concurso-bolsas-2027/esjt-theme.ts
export const ESJT = {
  navy: '#34436B',
  red: '#C1161A',
  blueBg: '#EDF3FF',
  blueBorder: '#C0CEEA',
  blueLine: '#D7DFEC',
  gray: '#6E7A98',
  yellow: '#FFC402',
  footer: '#2b3858',
} as const
```

- [ ] **Step 2: Layout do segmento com as fontes (next/font, só aqui)**

```tsx
// app/concurso-bolsas-2027/layout.tsx
import type { Metadata } from 'next'
import { Roboto, Roboto_Slab } from 'next/font/google'

const roboto = Roboto({ subsets: ['latin'], weight: ['400', '500', '700', '900'], variable: '--font-esjt-text' })
const robotoSlab = Roboto_Slab({ subsets: ['latin'], weight: ['500', '700', '800'], variable: '--font-esjt-title' })

export const metadata: Metadata = {
  title: 'Concurso de Bolsas Esportivas 2027 — Educandário São Judas Tadeu',
  description: 'Bolsas de até 100% para alunos atletas. Inscrições de 06/07 a 23/08/2026. Taxa R$ 25,00 via Pix.',
}

export default function ConcursoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${roboto.variable} ${robotoSlab.variable}`}
         style={{ fontFamily: 'var(--font-esjt-text), sans-serif', background: '#fff', minHeight: '100dvh' }}>
      {children}
    </div>
  )
}
```

- [ ] **Step 3: Landing (server component).** Implementar `page.tsx` seguindo EXATAMENTE o mockup aprovado (arquivo de referência: `~/Documents/Hub/.superpowers/brainstorm/78065-1782925982/content/landing-v2.html`). Estrutura e conteúdo (usar `ESJT.*` para cores e `fontFamily: 'var(--font-esjt-title)'` nos títulos):

  1. **Faixa superior** navy: `📞 (81) 3458-1047 · Camaragibe/PE` à esquerda, `Facebook · Instagram` à direita.
  2. **Header** branco: logo (usar `/concurso/logo-esjt.png` se o arquivo existir em `public/concurso/`; senão, monograma "ESJT" em navy como fallback — mesmo fallback do mockup), âncoras `O Concurso · Modalidades · Etapas · Bolsas`, botão vermelho "Inscreva-se" → link `#inscricao`.
  3. **Hero** navy (gradiente escuro sobre navy): selo vermelho "SELETIVAS ESPORTIVAS 2027", H1 "Concurso de Bolsas de até **100%** para atletas" (100% em amarelo), subtítulo com público (2º ano EF à 3ª série EM, turno tarde) e datas (06/07 a 23/08/2026), CTA vermelho "Fazer inscrição — R$ 25,00" → `/concurso-bolsas-2027/inscricao` e botão ghost "📄 Baixar edital" → `CONCURSO.editalPdfUrl`.
  4. **Faixa de destaques** azul-claro: `até 100% de bolsa` · `5 modalidades` · `R$ 25 taxa (Pix)`.
  5. **O Concurso**: texto institucional (do edital, §preâmbulo + 1.2/1.3).
  6. **Modalidades** (fundo azul-claro): 5 cards com ícone+nome de `MODALIDADES` (map).
  7. **Como funciona**: 4 cards numerados (círculo vermelho): Inscrição+Pix (06/07–23/08, pgto até 26/08) · Prova pedagógica (30/08, 08h30–11h30, sede ESJT) · Seletiva técnica (09–19/09) · Resultado (até 30/09, matrícula até 03/10).
  8. **Tabela de bolsas**: header navy "Média final / Desconto", linhas 10→100%, 9,0–9,9→50%, 8,0–8,9→30%, 7,0–7,9→8% (percentuais em vermelho).
  9. **Faixa CTA** vermelha: "Garanta a vaga do seu filho" + botão branco → `/concurso-bolsas-2027/inscricao`.
  10. **Rodapé** `ESJT.footer`: endereço (Rua Amaro Albino Pimentel, 79B — Bairro Novo do Carmo — Camaragibe/PE), telefone, © 2026.

  Se `inscricoesAbertas()` for falso, os CTAs viram aviso "Inscrições encerradas" (cinza, sem link).
  Estilos: inline styles (padrão já usado no app — ver `app/(admin)`), responsivo com flex-wrap.

- [ ] **Step 4: Verificar build** — `npx tsc --noEmit` e `npx vitest run --reporter=dot 2>&1 | tail -3`. (NÃO subir dev server.)
- [ ] **Step 5: Commit** — `git commit -m "feat(concurso): landing pública com identidade ESJT"`

---

### Task 10: Página pública — formulário (wizard) + tela Pix

**Files:**
- Create: `app/concurso-bolsas-2027/inscricao/page.tsx` (server: checa janela, renderiza client)
- Create: `app/concurso-bolsas-2027/inscricao/InscricaoClient.tsx` (client: wizard 3 passos + tela Pix)
- Test: `tests/concurso/inscricao-client.test.ts` (helpers puros)

Fluxo aprovado no brainstorm: Passo 1 **Aluno** → Passo 2 **Responsáveis** → Passo 3 **Revisão+consentimento** → submit → **tela Pix** (QR + copia-e-cola + contador + polling).

- [ ] **Step 1: `page.tsx`**

```tsx
// app/concurso-bolsas-2027/inscricao/page.tsx
import { inscricoesAbertas } from '@/lib/concurso/config'
import { InscricaoClient } from './InscricaoClient'
import Link from 'next/link'

export const metadata = { title: 'Inscrição — Concurso de Bolsas Esportivas 2027' }

export default function InscricaoPage() {
  if (!inscricoesAbertas()) {
    return (
      <main style={{ maxWidth: 560, margin: '80px auto', textAlign: 'center', padding: 24 }}>
        <h1 style={{ color: '#34436B', fontFamily: 'var(--font-esjt-title)' }}>Inscrições encerradas</h1>
        <p style={{ color: '#6E7A98' }}>O período de inscrições foi de 06/07 a 23/08/2026.</p>
        <Link href="/concurso-bolsas-2027" style={{ color: '#C1161A', fontWeight: 700 }}>← Voltar</Link>
      </main>
    )
  }
  return <InscricaoClient />
}
```

- [ ] **Step 2: `InscricaoClient.tsx`.** Client component (`'use client'`). Especificação:

  - **Estado:** `passo: 1|2|3`, um objeto `form` com TODOS os campos de `InscricaoInput` (strings controladas; `tem_irmaos` boolean; `consentimento` boolean), `enviando`, `erro`, e `resultado: CriarInscricaoResult | null`.
  - **Stepper** visual (3 bolinhas: Aluno / Responsáveis / Pagamento — círculo ativo vermelho, concluído navy com ✓, futuro cinza; como no mockup `form-pix.html`).
  - **Passo 1 (Aluno):** nome completo*, data de nascimento* (input date), turno (select travado em "Tarde"), série em 2026* (select com `SERIES_2026`), modalidade* (radio cards com ícone, escolha única, de `MODALIDADES`), instituição de ensino atual*.
  - **Passo 2 (Responsáveis):** Resp. 1: nome*, CPF* (com máscara `000.000.000-00` e hint "necessário para gerar o Pix"), e-mail*, telefone, endereço, profissão, parentesco. Bloco colapsável "Responsável 2 (opcional)": nome, endereço, telefone, profissão, parentesco. Bloco irmãos: checkbox "Possui irmã(os) em idade escolar" que revela textarea "Série do(s) irmão(s) em 2026".
  - **Passo 3 (Revisão):** resumo dos dados em cartão + valor R$ 25,00 + checkbox de consentimento LGPD (texto: "Autorizo o tratamento dos dados informados para fins de inscrição e comunicação sobre o Concurso de Bolsas 2027, conforme o edital e a LGPD.") + botão vermelho "Confirmar e gerar Pix".
  - **Validação por passo** (client, mensagens amigáveis): não avançar sem obrigatórios do passo; validação final é sempre a do servidor.
  - **Submit:** chama `criarInscricaoConcurso(form)`. Erro → mostra `erro` acima do botão. Sucesso → troca para a **tela Pix**.
  - **Tela Pix:** número da inscrição (`CB2027-XXXX`), valor, `<img src={pix.qr_code_imagem}>`, campo readonly com `pix.qr_code` + botão "Copiar" (`navigator.clipboard.writeText`; feedback "Copiado ✓"), contador regressivo até `pix.expiracao` (mm:ss), texto "A confirmação é automática".
  - **Polling:** `useEffect` com `setInterval` 5s chamando `consultarStatusInscricao(inscricao_id)`. `status==='pago'` → limpar intervalo e mostrar tela de sucesso (✅ "Inscrição confirmada! Enviamos o comprovante para o seu e-mail." + número + lembrete da prova 30/08). `status==='expirado'` OU contador zerado → parar polling e mostrar botão "Gerar novo Pix" que chama `gerarNovoPixInscricao(inscricao_id)` e reidrata a tela Pix.
  - Reaproveitar como referência de estilo/polling o `AguardandoClient.tsx` da cantina (`app/(loja)/cantina/[aluno_id]/recarga/[recarga_id]/AguardandoClient.tsx`), adaptando cores ESJT.
  - **Helpers puros exportados** (para teste): `mascararCPF(v: string): string` (aplica máscara progressiva) e `formatarContador(msRestantes: number): string` (`'29:41'`; nunca negativo → `'00:00'`).

- [ ] **Step 3: Teste dos helpers**

```ts
// tests/concurso/inscricao-client.test.ts
import { describe, expect, it } from 'vitest'
import { mascararCPF, formatarContador } from '@/app/concurso-bolsas-2027/inscricao/InscricaoClient'

describe('helpers do formulário', () => {
  it('mascara CPF progressivamente', () => {
    expect(mascararCPF('529')).toBe('529')
    expect(mascararCPF('5299822')).toBe('529.982.2')
    expect(mascararCPF('52998224725')).toBe('529.982.247-25')
    expect(mascararCPF('529982247259999')).toBe('529.982.247-25') // trunca em 11 dígitos
  })
  it('formata contador mm:ss e não fica negativo', () => {
    expect(formatarContador(29 * 60_000 + 41_000)).toBe('29:41')
    expect(formatarContador(0)).toBe('00:00')
    expect(formatarContador(-5000)).toBe('00:00')
  })
})
```

Nota: exportar os helpers como funções nomeadas no topo do arquivo client (antes do componente). Se o import de um arquivo `'use client'` no vitest der problema, mover os helpers para `app/concurso-bolsas-2027/inscricao/helpers.ts` e importar de lá em ambos.

- [ ] **Step 4: Rodar** — teste helpers PASS + `npx tsc --noEmit` limpo.
- [ ] **Step 5: Commit** — `git commit -m "feat(concurso): formulário de inscrição em 3 passos + tela Pix com polling"`

---

### Task 11: Permissão + menu do admin

**Files:**
- Modify: `lib/permissoes/keys.ts` (novo grupo/chave `concurso.ver`)
- Modify: componente de navegação do admin (`app/(admin)/AdminShell.tsx` — localizar onde os itens de menu são declarados e seguir o padrão)

- [ ] **Step 1:** Em `keys.ts`, adicionar (seguindo o formato dos grupos existentes):

```ts
{
  grupo: 'Concurso de Bolsas',
  permissoes: [
    { chave: 'concurso.ver', rotulo: 'Ver inscrições do concurso' },
  ],
},
```

(Adaptar à estrutura literal do arquivo — abrir e copiar o shape exato de um grupo vizinho.)

- [ ] **Step 2:** Conceder a permissão aos papéis de admin. Verificar como as permissões são atribuídas (tabela de papéis/permissões no banco ou constante). Se for via banco, rodar `execute_sql` concedendo `concurso.ver` ao papel admin da ESJT; se for constante, editar. Documentar no commit o que foi feito.

- [ ] **Step 3:** Adicionar item "Concurso" no menu do `AdminShell` (ícone 🏆), visível quando `permissoes.includes('concurso.ver')`, apontando para `/admin/concurso`.

- [ ] **Step 4:** `npx tsc --noEmit` + suíte. Commit — `git commit -m "feat(concurso): permissão concurso.ver + item de menu no admin"`

---

### Task 12: Admin — lista, filtros, detalhe, financeiro e CSV

**Files:**
- Create: `lib/concurso/relatorio.ts` (agregações puras — testáveis)
- Create: `app/(admin)/admin/concurso/page.tsx` (server: busca + filtros via searchParams)
- Create: `app/(admin)/admin/concurso/ConcursoClient.tsx` (client: tabela, filtros, export CSV)
- Create: `app/(admin)/admin/concurso/[id]/page.tsx` (detalhe da inscrição)
- Test: `tests/concurso/relatorio.test.ts`

- [ ] **Step 1: Teste das agregações**

```ts
// tests/concurso/relatorio.test.ts
import { describe, expect, it } from 'vitest'
import { resumoFinanceiro, gerarCSV, type InscricaoRow } from '@/lib/concurso/relatorio'

const rows: InscricaoRow[] = [
  { numero: 'CB2027-0001', aluno_nome: 'A', serie_2026: '5º ano EF', modalidade: 'futsal',
    resp1_nome: 'R1', resp1_cpf: '1', resp1_email: 'a@a.com', resp1_telefone: null,
    status_pagamento: 'pago', valor: 25, valor_liquido: 24.01, created_at: '2026-07-10T12:00:00Z',
    pago_em: '2026-07-10T12:05:00Z' },
  { numero: 'CB2027-0002', aluno_nome: 'B', serie_2026: '6º ano EF', modalidade: 'judo',
    resp1_nome: 'R2', resp1_cpf: '2', resp1_email: 'b@b.com', resp1_telefone: null,
    status_pagamento: 'pendente', valor: 25, valor_liquido: null, created_at: '2026-07-11T12:00:00Z',
    pago_em: null },
]

describe('resumoFinanceiro', () => {
  it('soma apenas pagos e conta por status/modalidade', () => {
    const r = resumoFinanceiro(rows)
    expect(r.totalBruto).toBe(25)
    expect(r.totalLiquido).toBe(24.01)
    expect(r.porStatus).toEqual({ pago: 1, pendente: 1 })
    expect(r.porModalidade).toEqual({ futsal: 1, judo: 1 })
  })
})

describe('gerarCSV', () => {
  it('gera cabeçalho + linhas com separador ; e valores escapados', () => {
    const csv = gerarCSV(rows)
    const linhas = csv.split('\n')
    expect(linhas[0]).toContain('numero;aluno_nome')
    expect(linhas).toHaveLength(3)
    expect(linhas[1]).toContain('CB2027-0001')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar `lib/concurso/relatorio.ts`**

```ts
// lib/concurso/relatorio.ts
export interface InscricaoRow {
  numero: string; aluno_nome: string; serie_2026: string; modalidade: string
  resp1_nome: string; resp1_cpf: string; resp1_email: string; resp1_telefone: string | null
  status_pagamento: string; valor: number; valor_liquido: number | null
  created_at: string; pago_em: string | null
}

export function resumoFinanceiro(rows: InscricaoRow[]) {
  const pagos = rows.filter(r => r.status_pagamento === 'pago')
  const totalBruto = pagos.reduce((s, r) => s + Number(r.valor), 0)
  const totalLiquido = pagos.reduce((s, r) => s + Number(r.valor_liquido ?? 0), 0)
  const conta = (key: (r: InscricaoRow) => string) =>
    rows.reduce<Record<string, number>>((acc, r) => {
      const k = key(r); acc[k] = (acc[k] ?? 0) + 1; return acc
    }, {})
  return {
    totalBruto,
    totalLiquido,
    totalTaxa: totalBruto - totalLiquido,
    porStatus: conta(r => r.status_pagamento),
    porModalidade: conta(r => r.modalidade),
  }
}

const CSV_COLS: (keyof InscricaoRow)[] = [
  'numero', 'aluno_nome', 'serie_2026', 'modalidade', 'resp1_nome', 'resp1_cpf',
  'resp1_email', 'resp1_telefone', 'status_pagamento', 'valor', 'created_at', 'pago_em',
]

function esc(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function gerarCSV(rows: InscricaoRow[]): string {
  const header = CSV_COLS.join(';')
  const body = rows.map(r => CSV_COLS.map(c => esc(r[c])).join(';'))
  return [header, ...body].join('\n')
}
```

- [ ] **Step 4: Rodar** — PASS. Commit parcial: `git commit -m "feat(concurso): agregações e CSV do relatório"`

- [ ] **Step 5: Página de lista (`page.tsx`).** Server component protegido:

```tsx
// app/(admin)/admin/concurso/page.tsx — esqueleto
import { redirect } from 'next/navigation'
import { currentPermissions } from '@/lib/permissoes'
import { createAdminClient } from '@/lib/supabase/admin'
import { CONCURSO } from '@/lib/concurso/config'
import { resumoFinanceiro, type InscricaoRow } from '@/lib/concurso/relatorio'
import { ConcursoClient } from './ConcursoClient'

export default async function ConcursoAdminPage() {
  const permissoes = await currentPermissions()
  if (!permissoes.includes('concurso.ver')) redirect('/admin')

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('inscricoes_concurso')
    .select('id, numero, aluno_nome, aluno_nascimento, serie_2026, modalidade, instituicao_atual, resp1_nome, resp1_cpf, resp1_email, resp1_telefone, status_pagamento, valor, valor_liquido, created_at, pago_em')
    .eq('escola_id', CONCURSO.escolaId)
    .order('created_at', { ascending: false })

  const rows = (data ?? []) as (InscricaoRow & { id: string })[]
  const resumo = resumoFinanceiro(rows)
  return <ConcursoClient rows={rows} resumo={resumo} />
}
```

- [ ] **Step 6: `ConcursoClient.tsx`.** Client component com:
  - Cards de resumo no topo (padrão visual dos cards do admin): Total arrecadado (`totalBruto`), Líquido (`totalLiquido`, com nota "após taxas Asaas"), Inscrições pagas / pendentes / expiradas, contagem por modalidade.
  - Filtros client-side (estado local): status (select), modalidade (select), busca por nome do aluno / responsável / CPF (input).
  - Tabela: nº, aluno, série, modalidade, responsável, telefone, status (badge com cor: pago=verde, pendente=âmbar, expirado=cinza), valor, data. Linha clicável → `/admin/concurso/[id]`.
  - Botão "Exportar CSV": gera client-side com `gerarCSV(rowsFiltradas)` e baixa via `Blob` + `URL.createObjectURL` + `<a download="inscricoes-concurso-2027.csv">`. Prefixar o conteúdo com `﻿` (BOM) para o Excel abrir acentos corretamente.
  - Seguir o estilo das tabelas existentes do admin (olhar `app/(admin)/admin/pedidos/page.tsx` como referência de classes/estilos).

- [ ] **Step 7: Detalhe (`[id]/page.tsx`).** Server component (mesma guarda de permissão): busca a inscrição por id (`createAdminClient`), exibe TODOS os campos em seções "Estudante", "Responsável 1", "Responsável 2", "Irmãos", "Pagamento" (status, gateway_id, valor, líquido, pago_em, expiração) + link "← Voltar". `notFound()` se id inexistente.

- [ ] **Step 8: Verificar** — `npx tsc --noEmit` + `npx vitest run --reporter=dot 2>&1 | tail -3`.
- [ ] **Step 9: Commit** — `git commit -m "feat(concurso): admin com lista, filtros, detalhe, financeiro e export CSV"`

---

### Task 13: Verificação final + publicação

**Files:** nenhum novo

- [ ] **Step 1: Suíte completa** — `npx vitest run 2>&1 | tail -5` → tudo verde.
- [ ] **Step 2: Types/build** — `npx tsc --noEmit` limpo. Se o projeto tiver script de build rápido, NÃO rodar `next build` completo se costuma travar a máquina; `tsc` + suíte bastam como prova (regra do usuário).
- [ ] **Step 3: Revisão de código** — REQUIRED SUB-SKILL: superpowers:requesting-code-review (ou /code-review) sobre o diff da branch.
- [ ] **Step 4: Checklist com o usuário antes do deploy:**
  - [ ] PDF do edital corrigido (5 modalidades) recebido → colocar em `public/concurso/edital-bolsas-esportivas-2027.pdf`
  - [ ] Logo/banner da ESJT recebidos → `public/concurso/logo-esjt.png` (e banner se enviado)
  - [ ] Texto LGPD aprovado pelo usuário (o padrão está no Passo 3 do wizard)
  - [ ] Confirmar que `ASAAS_WEBHOOK_TOKEN` e eventos `PAYMENT_RECEIVED/CONFIRMED/OVERDUE` já estão ativos no painel Asaas (o webhook é o mesmo da loja — sem mudança de config, só confirmar; se webhook parar, checar `interrupted` via GET /v3/webhooks)
- [ ] **Step 5: Merge/PR + push** — REQUIRED SUB-SKILL: superpowers:finishing-a-development-branch. Após aprovação do usuário: push da branch e PR (ou merge em main + push, conforme o usuário preferir). Deploy automático no Vercel.
- [ ] **Step 6: Smoke test em produção (com o usuário):** abrir `https://<dominio>/concurso-bolsas-2027`, fazer 1 inscrição real de teste com Pix de R$ 25 (o próprio usuário paga e depois estorna/ignora), confirmar: e-mail chegou, inscrição aparece "pago" no admin, CSV exporta. Remover a inscrição de teste via SQL depois.

---

## Self-review (feito na escrita)

- **Cobertura da spec:** §5 rota pública (T9/T10) · §6 tabela (T1) · §7 action (T5) · §8 webhook (T7) · §9 expiração (T8) · §10 e-mail (T6) · §11 admin (T11/T12) · §12 identidade (T9) · §13 config (T3) · §14 segurança/RLS (T1, service-role only) · §15 testes (todas) · §16 publicação (T0/T13) · §17 itens abertos (T13 checklist). Rate limiting básico (§14): coberto implicitamente pela janela + validação; se necessário endurecer, fazer em iteração futura — anotado como fora desta entrega.
- **Placeholders:** nenhum "TBD"; todos os passos têm código ou instrução executável.
- **Consistência de tipos:** `InscricaoInput` (T4) é o mesmo consumido em T5/T10; `PixInfo` definido em T5 e usado em T10; `InscricaoRow` definido em T12 e usado só lá; nomes `confirmarPagamentoConcurso`/`expirarPagamentoConcurso` idênticos em T7 (lib, testes e webhook).
