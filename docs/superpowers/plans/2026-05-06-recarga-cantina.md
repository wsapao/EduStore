# Cantina — Recarga PIX Real Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a recarga fictícia da cantina por um fluxo PIX real via Asaas, com página de aguardando e crédito automático via webhook + Supabase Realtime.

**Architecture:** A `iniciarRecargaAction` cria um pagamento PIX no Asaas e insere um registro em `cantina_recargas` com status `aguardando`. O cliente é redirecionado para `/cantina/[aluno_id]/recarga/[recarga_id]` onde `AguardandoClient` exibe o QR Code e ouve atualizações via Supabase Realtime. Quando o Asaas confirma o pagamento via webhook, a RPC `confirmar_recarga` credita o saldo atomicamente e atualiza o status — o Realtime notifica o browser que exibe o estado de sucesso.

**Tech Stack:** Next.js 15 App Router (Server Actions, Server Components, Route Handlers), Supabase (Postgres, Auth, Realtime `postgres_changes`), Asaas PIX via `getGateway('cantina')`, bcryptjs para PIN (já existente).

---

## File Map

| Operação | Arquivo | Responsabilidade |
|---|---|---|
| Criar | `supabase/migrations/20260506_cantina_recargas.sql` | Tabela + RPC + RLS + Realtime |
| Modificar | `app/actions/cantina.ts` | Substituir `iniciarRecargaAction`, adicionar `renovarRecargaAction` |
| Modificar | `app/(loja)/cantina/[aluno_id]/recarga/RecargaClient.tsx` | Redirecionar para `[recarga_id]` |
| Criar | `app/(loja)/cantina/[aluno_id]/recarga/[recarga_id]/page.tsx` | Server component com validação de ownership |
| Criar | `app/(loja)/cantina/[aluno_id]/recarga/[recarga_id]/AguardandoClient.tsx` | QR Code + Realtime + 3 estados |
| Modificar | `app/api/webhook/asaas/route.ts` | Detectar prefixo `recarga:` em `externalReference` |

---

## Task 1: Migration — tabela `cantina_recargas` + RPC + RLS + Realtime

**Files:**
- Create: `supabase/migrations/20260506_cantina_recargas.sql`

- [ ] **Step 1: Criar o arquivo de migration**

Crie `supabase/migrations/20260506_cantina_recargas.sql` com o conteúdo abaixo:

```sql
-- ── Tabela de recargas PIX ────────────────────────────────────
CREATE TABLE cantina_recargas (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  carteira_id        uuid        NOT NULL REFERENCES cantina_carteiras(id),
  responsavel_id     uuid        NOT NULL REFERENCES responsaveis(id),
  valor              numeric(10,2) NOT NULL CHECK (valor >= 5 AND valor <= 2000),
  status             text        NOT NULL DEFAULT 'aguardando'
                                 CHECK (status IN ('aguardando','confirmada','expirada','falhou')),
  gateway_id         text,
  pix_qr_code        text,
  pix_qr_code_imagem text,
  pix_expiracao      timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  confirmada_em      timestamptz
);

-- Necessário para Realtime detectar UPDATE (old + new row disponíveis)
ALTER TABLE cantina_recargas REPLICA IDENTITY FULL;

-- Adiciona à publicação do Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE cantina_recargas;

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE cantina_recargas ENABLE ROW LEVEL SECURITY;

-- Responsável só vê suas próprias recargas
CREATE POLICY "cantina_recargas_responsavel_select"
  ON cantina_recargas
  FOR SELECT
  TO authenticated
  USING (responsavel_id = auth.uid());

-- ── RPC: confirmar_recarga ────────────────────────────────────
-- Chamada pelo webhook via admin client (SECURITY DEFINER ignora RLS)
CREATE OR REPLACE FUNCTION confirmar_recarga(p_recarga_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recarga cantina_recargas%ROWTYPE;
BEGIN
  -- Lock exclusivo para evitar duplo crédito em webhooks simultâneos
  SELECT * INTO v_recarga
  FROM cantina_recargas
  WHERE id = p_recarga_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Recarga não encontrada.');
  END IF;

  -- Idempotência: se já confirmada, retorna ok sem creditar novamente
  IF v_recarga.status = 'confirmada' THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  IF v_recarga.status != 'aguardando' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Status inválido: ' || v_recarga.status);
  END IF;

  -- Credita saldo via RPC existente (atômico, registra movimentação)
  PERFORM creditar_saldo_cantina(
    v_recarga.carteira_id,
    v_recarga.valor,
    'Recarga PIX confirmada — R$ ' || to_char(v_recarga.valor, 'FM9999990.00'),
    NULL,
    v_recarga.gateway_id
  );

  -- Atualiza status → Realtime notifica o browser
  UPDATE cantina_recargas
  SET status = 'confirmada', confirmada_em = now()
  WHERE id = p_recarga_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;
```

- [ ] **Step 2: Aplicar a migration no Supabase**

Abra o painel do Supabase → SQL Editor → cole e execute o conteúdo do arquivo acima.

Confirme que a tabela foi criada:

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'cantina_recargas' ORDER BY ordinal_position;
```

Resultado esperado: colunas `id`, `carteira_id`, `responsavel_id`, `valor`, `status`, `gateway_id`, `pix_qr_code`, `pix_qr_code_imagem`, `pix_expiracao`, `created_at`, `confirmada_em`.

Confirme a RPC:

```sql
SELECT proname FROM pg_proc WHERE proname = 'confirmar_recarga';
```

Resultado esperado: `confirmar_recarga`.

- [ ] **Step 3: Commit**

```bash
cd "/Users/webertsantos/Documents/Hub/Loja virtual/app"
git add supabase/migrations/20260506_cantina_recargas.sql
git commit -m "feat(cantina): migration cantina_recargas + confirmar_recarga RPC"
git push
```

---

## Task 2: Substituir `iniciarRecargaAction` com PIX real

**Files:**
- Modify: `app/actions/cantina.ts` (linhas 349–394 — substituir a função `iniciarRecargaAction`)

A ação existente credita saldo diretamente (bug de segurança). A nova versão cria um PIX no Asaas e insere um registro em `cantina_recargas` sem creditar nada.

- [ ] **Step 1: Adicionar imports necessários no topo de `cantina.ts`**

Abra `app/actions/cantina.ts`. Os imports atuais no topo são:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashPin, verifyPin } from '@/lib/cantina/pin'
```

Adicione as duas linhas após os imports existentes:

```typescript
import { getGateway } from '@/lib/pagamentos/gateway'
import type { ResultadoPagamento } from '@/lib/pagamentos/types'
```

- [ ] **Step 2: Substituir `iniciarRecargaAction` (linhas 349–394)**

Substitua todo o bloco entre os comentários `// ── Recarga MVP...` e a próxima função (`// ── Ações para admin...`) pelo código abaixo:

```typescript
// ── Iniciar recarga via PIX real ──────────────────────────────
export async function iniciarRecargaAction(alunoId: string, valor: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  if (valor < 5 || valor > 2000) {
    return { error: 'Valor fora do intervalo permitido (R$ 5,00 a R$ 2.000,00).' }
  }

  // Verifica vínculo responsável↔aluno
  const { data: vinculo } = await supabase
    .from('responsavel_aluno')
    .select('aluno_id')
    .eq('responsavel_id', user.id)
    .eq('aluno_id', alunoId)
    .single()

  if (!vinculo) return { error: 'Acesso negado.' }

  // Busca carteira + verifica se está ativa
  const { data: carteira } = await supabase
    .from('cantina_carteiras')
    .select('id, ativo')
    .eq('aluno_id', alunoId)
    .single()

  if (!carteira) return { error: 'Carteira não encontrada.' }
  if (!carteira.ativo) return { error: 'Carteira bloqueada. Desbloqueie antes de recarregar.' }

  // Busca dados do responsável para criar o cliente no Asaas
  const { data: responsavel } = await supabase
    .from('responsaveis')
    .select('nome, email, cpf')
    .eq('id', user.id)
    .single()

  if (!responsavel?.cpf) return { error: 'CPF não cadastrado. Contate a escola.' }

  // Pré-gera o ID da recarga para usá-lo como externalReference no Asaas
  const recargaId = crypto.randomUUID()

  // Cria o PIX no Asaas
  const gateway = getGateway('cantina')
  let resultado: ResultadoPagamento
  try {
    resultado = await gateway.criarPagamento({
      metodo: 'pix',
      total: valor,
      responsavel: {
        nome: responsavel.nome,
        email: responsavel.email,
        cpf: responsavel.cpf,
      },
      descricao: `Recarga cantina — R$ ${valor.toFixed(2)}`,
      referencia: `recarga:${recargaId}`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao criar PIX.'
    return { error: msg }
  }

  if (resultado.metodo !== 'pix') return { error: 'Resposta inválida do gateway.' }
  const pix = resultado

  // Insere registro de recarga (sem creditar saldo — crédito ocorre após confirmação do webhook)
  const adminClient = createAdminClient()
  const { error: errRecarga } = await adminClient
    .from('cantina_recargas')
    .insert({
      id: recargaId,
      carteira_id: carteira.id,
      responsavel_id: user.id,
      valor,
      status: 'aguardando',
      gateway_id: pix.gateway_id,
      pix_qr_code: pix.qr_code,
      pix_qr_code_imagem: pix.qr_code_imagem,
      pix_expiracao: pix.expiracao,
    })

  if (errRecarga) {
    return { error: 'Erro ao registrar recarga. Tente novamente.' }
  }

  return {
    recarga_id: recargaId,
    pix_qr_code: pix.qr_code,
    pix_qr_code_imagem: pix.qr_code_imagem,
    pix_expiracao: pix.expiracao,
  }
}
```

- [ ] **Step 3: Verificar que o TypeScript compila**

```bash
cd "/Users/webertsantos/Documents/Hub/Loja virtual/app"
npx tsc --noEmit 2>&1 | head -30
```

Resultado esperado: sem erros relacionados a `cantina.ts`. Se aparecerem erros de tipos em outros arquivos (causados pela mudança do tipo de retorno de `iniciarRecargaAction`), eles serão corrigidos na Task 4.

- [ ] **Step 4: Commit**

```bash
git add app/actions/cantina.ts
git commit -m "feat(cantina): iniciarRecargaAction cria PIX real via Asaas"
git push
```

---

## Task 3: Adicionar `renovarRecargaAction`

**Files:**
- Modify: `app/actions/cantina.ts` (adicionar nova função após `iniciarRecargaAction`)

Permite ao usuário gerar um novo PIX quando o anterior expirou, reaproveitando o mesmo registro na tabela.

- [ ] **Step 1: Adicionar `renovarRecargaAction` após `iniciarRecargaAction` em `cantina.ts`**

Cole o código abaixo imediatamente após o closing `}` de `iniciarRecargaAction` e antes do comentário `// ── Ações para admin de produtos`:

```typescript
// ── Renovar PIX expirado ──────────────────────────────────────
export async function renovarRecargaAction(recargaId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  // RLS garante que o usuário só vê suas próprias recargas
  const { data: recarga } = await supabase
    .from('cantina_recargas')
    .select('id, carteira_id, responsavel_id, valor, status, pix_expiracao')
    .eq('id', recargaId)
    .single()

  if (!recarga || recarga.responsavel_id !== user.id) return { error: 'Recarga não encontrada.' }
  if (recarga.status !== 'aguardando') return { error: 'Recarga não pode ser renovada.' }

  const agora = new Date()
  const expiracao = new Date(recarga.pix_expiracao as string)
  if (expiracao > agora) return { error: 'PIX ainda não expirou.' }

  // Busca dados do responsável para criar o cliente no Asaas
  const { data: responsavel } = await supabase
    .from('responsaveis')
    .select('nome, email, cpf')
    .eq('id', user.id)
    .single()

  if (!responsavel?.cpf) return { error: 'CPF não cadastrado. Contate a escola.' }

  // Cria novo PIX com a mesma referência (mesmo recargaId)
  const gateway = getGateway('cantina')
  let resultado: ResultadoPagamento
  try {
    resultado = await gateway.criarPagamento({
      metodo: 'pix',
      total: recarga.valor as number,
      responsavel: {
        nome: responsavel.nome,
        email: responsavel.email,
        cpf: responsavel.cpf,
      },
      descricao: `Recarga cantina (renovação) — R$ ${(recarga.valor as number).toFixed(2)}`,
      referencia: `recarga:${recargaId}`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao criar novo PIX.'
    return { error: msg }
  }

  if (resultado.metodo !== 'pix') return { error: 'Resposta inválida do gateway.' }
  const pix = resultado

  // Atualiza o registro com o novo QR Code (sem mudar o status)
  const adminClient = createAdminClient()
  const { error: errUpdate } = await adminClient
    .from('cantina_recargas')
    .update({
      gateway_id: pix.gateway_id,
      pix_qr_code: pix.qr_code,
      pix_qr_code_imagem: pix.qr_code_imagem,
      pix_expiracao: pix.expiracao,
    })
    .eq('id', recargaId)

  if (errUpdate) return { error: 'Erro ao atualizar recarga.' }

  return {
    pix_qr_code: pix.qr_code,
    pix_qr_code_imagem: pix.qr_code_imagem,
    pix_expiracao: pix.expiracao,
  }
}
```

- [ ] **Step 2: Verificar compilação**

```bash
cd "/Users/webertsantos/Documents/Hub/Loja virtual/app"
npx tsc --noEmit 2>&1 | head -20
```

Resultado esperado: sem novos erros em `cantina.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/actions/cantina.ts
git commit -m "feat(cantina): adicionar renovarRecargaAction para PIX expirado"
git push
```

---

## Task 4: Atualizar `RecargaClient.tsx` para redirecionar para `[recarga_id]`

**Files:**
- Modify: `app/(loja)/cantina/[aluno_id]/recarga/RecargaClient.tsx`

O cliente atual redireciona para `/extrato` após creditar. Agora deve redirecionar para a página de aguardando.

- [ ] **Step 1: Substituir o `handleSubmit` em `RecargaClient.tsx`**

O `handleSubmit` atual (linhas 39–61) faz:
```typescript
const res = await iniciarRecargaAction(alunoId, valorFinal)
if (!res.success) {
  setErro(res.error ?? 'Erro ao iniciar recarga.')
  return
}
// MVP: recarga creditada diretamente (sem gateway)
router.push(`/cantina/${alunoId}/extrato`)
```

Substitua-o por:

```typescript
function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  setErro(null)

  if (!valorFinal || isNaN(valorFinal) || valorFinal < 5) {
    setErro('Valor mínimo de recarga é R$ 5,00.')
    return
  }
  if (valorFinal > 2000) {
    setErro('Valor máximo por recarga é R$ 2.000,00.')
    return
  }

  startTransition(async () => {
    const res = await iniciarRecargaAction(alunoId, valorFinal)
    if ('error' in res) {
      setErro(res.error ?? 'Erro ao iniciar recarga.')
      return
    }
    router.push(`/cantina/${alunoId}/recarga/${res.recarga_id}`)
  })
}
```

- [ ] **Step 2: Remover o comentário `// futuro: estado para tela de PIX...`**

Na linha com `// futuro: estado para tela de PIX após integração com gateway`, remova essa linha (é um comentário obsoleto).

- [ ] **Step 3: Verificar compilação**

```bash
cd "/Users/webertsantos/Documents/Hub/Loja virtual/app"
npx tsc --noEmit 2>&1 | head -20
```

Resultado esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add "app/(loja)/cantina/[aluno_id]/recarga/RecargaClient.tsx"
git commit -m "feat(cantina): RecargaClient redireciona para página de PIX"
git push
```

---

## Task 5: Criar `[recarga_id]/page.tsx` — Server Component

**Files:**
- Create: `app/(loja)/cantina/[aluno_id]/recarga/[recarga_id]/page.tsx`

Valida ownership no servidor. URL adivinhada retorna 404.

- [ ] **Step 1: Criar o diretório e arquivo**

```bash
mkdir -p "/Users/webertsantos/Documents/Hub/Loja virtual/app/app/(loja)/cantina/[aluno_id]/recarga/[recarga_id]"
```

Crie `app/(loja)/cantina/[aluno_id]/recarga/[recarga_id]/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { AguardandoClient } from './AguardandoClient'

export default async function AguardandoRecargaPage({
  params,
}: {
  params: Promise<{ aluno_id: string; recarga_id: string }>
}) {
  const { aluno_id, recarga_id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RLS já filtra recargas do usuário; validamos explicitamente por segurança
  const { data: recarga } = await supabase
    .from('cantina_recargas')
    .select('id, valor, status, pix_qr_code, pix_qr_code_imagem, pix_expiracao, responsavel_id')
    .eq('id', recarga_id)
    .single()

  if (!recarga || recarga.responsavel_id !== user.id) notFound()

  const { data: aluno } = await supabase
    .from('alunos')
    .select('nome, serie')
    .eq('id', aluno_id)
    .single()

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px 16px 100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link
          href={`/cantina/${aluno_id}/recarga`}
          style={{
            width: 36, height: 36, borderRadius: 'var(--r-md)',
            background: 'var(--surface)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, textDecoration: 'none', color: 'var(--text-1)',
            boxShadow: 'var(--shadow-xs)',
          }}
        >←</Link>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>
            Aguardando pagamento
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
            {aluno?.nome} · Recarga PIX
          </div>
        </div>
      </div>

      <AguardandoClient
        recargaId={recarga.id}
        alunoId={aluno_id}
        alunoNome={aluno?.nome ?? ''}
        valor={recarga.valor as number}
        pixQrCode={(recarga.pix_qr_code ?? '') as string}
        pixQrCodeImagem={(recarga.pix_qr_code_imagem ?? '') as string}
        pixExpiracao={(recarga.pix_expiracao ?? '') as string}
        statusInicial={recarga.status as 'aguardando' | 'confirmada' | 'expirada' | 'falhou'}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verificar compilação (antes de criar AguardandoClient)**

O TypeScript vai reclamar que `AguardandoClient` não existe ainda — isso é esperado. Verifique que não há outros erros:

```bash
cd "/Users/webertsantos/Documents/Hub/Loja virtual/app"
npx tsc --noEmit 2>&1 | grep -v "AguardandoClient"
```

Resultado esperado: apenas o erro de `AguardandoClient` não encontrado (resolvido na próxima task).

- [ ] **Step 3: Commit**

```bash
git add "app/(loja)/cantina/[aluno_id]/recarga/[recarga_id]/page.tsx"
git commit -m "feat(cantina): server component AguardandoRecargaPage com validação de ownership"
git push
```

---

## Task 6: Criar `AguardandoClient.tsx` — QR Code + Realtime + 3 estados

**Files:**
- Create: `app/(loja)/cantina/[aluno_id]/recarga/[recarga_id]/AguardandoClient.tsx`

Cliente com Supabase Realtime para escutar atualizações de status em tempo real.

- [ ] **Step 1: Criar `AguardandoClient.tsx`**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { renovarRecargaAction } from '@/app/actions/cantina'

interface Props {
  recargaId: string
  alunoId: string
  alunoNome: string
  valor: number
  pixQrCode: string
  pixQrCodeImagem: string
  pixExpiracao: string
  statusInicial: 'aguardando' | 'confirmada' | 'expirada' | 'falhou'
}

type Estado = 'aguardando' | 'confirmada' | 'expirada'

function fmtMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function calcSegs(expiracao: string): number {
  if (!expiracao) return 0
  return Math.max(0, Math.floor((new Date(expiracao).getTime() - Date.now()) / 1000))
}

function fmtCountdown(segs: number): string {
  const m = Math.floor(segs / 60).toString().padStart(2, '0')
  const s = (segs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export function AguardandoClient({
  recargaId, alunoId, alunoNome, valor,
  pixQrCode: initialQrCode,
  pixQrCodeImagem: initialQrImagem,
  pixExpiracao: initialExpiracao,
  statusInicial,
}: Props) {
  const router = useRouter()

  const estadoInicial: Estado =
    statusInicial === 'confirmada' ? 'confirmada'
    : statusInicial !== 'aguardando' ? 'expirada'
    : calcSegs(initialExpiracao) <= 0 ? 'expirada'
    : 'aguardando'

  const [estado, setEstado] = useState<Estado>(estadoInicial)
  const [segsRestantes, setSegsRestantes] = useState(() => calcSegs(initialExpiracao))
  const [qrCode, setQrCode] = useState(initialQrCode)
  const [qrImagem, setQrImagem] = useState(initialQrImagem)
  const [expiracao, setExpiracao] = useState(initialExpiracao)
  const [copiado, setCopiado] = useState(false)
  const [renovando, setRenovando] = useState(false)
  const [erroRenovacao, setErroRenovacao] = useState<string | null>(null)
  const [realtimeOk, setRealtimeOk] = useState(true)

  // Supabase Realtime — escuta UPDATE na recarga específica
  useEffect(() => {
    if (estado !== 'aguardando') return

    const supabase = createClient()
    const channel = supabase
      .channel(`recarga-${recargaId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cantina_recargas',
          filter: `id=eq.${recargaId}`,
        },
        (payload) => {
          const novo = payload.new as { status: string }
          if (novo.status === 'confirmada') {
            setEstado('confirmada')
          }
        }
      )
      .subscribe((status) => {
        setRealtimeOk(status === 'SUBSCRIBED')
      })

    return () => { void supabase.removeChannel(channel) }
  }, [recargaId, estado])

  // Countdown — atualiza a cada segundo
  useEffect(() => {
    if (estado !== 'aguardando') return
    const iv = setInterval(() => {
      const segs = calcSegs(expiracao)
      setSegsRestantes(segs)
      if (segs <= 0) {
        setEstado('expirada')
        clearInterval(iv)
      }
    }, 1000)
    return () => clearInterval(iv)
  }, [estado, expiracao])

  // Auto-redirect 3s após confirmação
  useEffect(() => {
    if (estado !== 'confirmada') return
    const t = setTimeout(() => {
      router.push(`/cantina/${alunoId}/extrato`)
    }, 3000)
    return () => clearTimeout(t)
  }, [estado, alunoId, router])

  const handleCopiar = useCallback(async () => {
    await navigator.clipboard.writeText(qrCode)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }, [qrCode])

  const handleRenovar = useCallback(async () => {
    setRenovando(true)
    setErroRenovacao(null)
    const res = await renovarRecargaAction(recargaId)
    if ('error' in res) {
      setErroRenovacao(res.error ?? 'Erro ao renovar PIX.')
      setRenovando(false)
      return
    }
    setQrCode(res.pix_qr_code)
    setQrImagem(res.pix_qr_code_imagem)
    setExpiracao(res.pix_expiracao)
    setSegsRestantes(calcSegs(res.pix_expiracao))
    setEstado('aguardando')
    setRenovando(false)
  }, [recargaId])

  // ── Estado: Confirmado ────────────────────────────────────────
  if (estado === 'confirmada') {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ fontSize: 64 }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', marginTop: 16 }}>
          Saldo creditado!
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 8 }}>
          {fmtMoeda(valor)} adicionados ao saldo de {alunoNome.split(' ')[0]}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 12 }}>
          Redirecionando em 3s…
        </div>
      </div>
    )
  }

  // ── Estado: Expirado ──────────────────────────────────────────
  if (estado === 'expirada') {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ fontSize: 64 }}>⏰</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', marginTop: 16 }}>
          PIX expirado
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 8 }}>
          O prazo para pagamento expirou. Gere um novo PIX para continuar.
        </div>
        {erroRenovacao && (
          <div style={{ marginTop: 12, fontSize: 13, color: '#991b1b', fontWeight: 600 }}>
            ❌ {erroRenovacao}
          </div>
        )}
        <button
          onClick={handleRenovar}
          disabled={renovando}
          style={{
            marginTop: 24, padding: '13px 32px',
            background: 'var(--brand)', color: '#fff',
            border: 'none', borderRadius: 'var(--r-md)',
            fontSize: 15, fontWeight: 800,
            cursor: renovando ? 'not-allowed' : 'pointer',
            opacity: renovando ? 0.7 : 1,
          }}
        >
          {renovando ? 'Gerando…' : 'Gerar novo PIX'}
        </button>
      </div>
    )
  }

  // ── Estado: Aguardando (principal) ────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Valor da recarga */}
      <div style={{
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)', padding: '12px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.07em' }}>
          Valor da recarga
        </span>
        <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand)' }}>
          {fmtMoeda(valor)}
        </span>
      </div>

      {/* QR Code */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        background: '#fff', border: '1px solid var(--border)',
        borderRadius: 'var(--r-xl)', padding: '24px',
      }}>
        {qrImagem ? (
          <img
            src={qrImagem}
            alt="QR Code PIX"
            width={220}
            height={220}
            style={{ borderRadius: 8, display: 'block' }}
          />
        ) : (
          <div style={{
            width: 220, height: 220,
            background: 'var(--surface-2)', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, color: 'var(--text-3)',
          }}>
            Carregando…
          </div>
        )}
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-3)' }}>
          Escaneie o QR Code no app do banco
        </div>
      </div>

      {/* Copia e cola */}
      <div>
        <div style={{
          fontSize: 12, fontWeight: 700, color: 'var(--text-3)',
          textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8,
        }}>
          Ou copie o código PIX
        </div>
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center',
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)', padding: '10px 12px',
        }}>
          <span style={{
            flex: 1, fontSize: 11, color: 'var(--text-2)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontFamily: 'monospace',
          }}>
            {qrCode}
          </span>
          <button
            onClick={handleCopiar}
            style={{
              padding: '5px 12px', borderRadius: 'var(--r-sm)',
              background: copiado ? '#16a34a' : 'var(--brand)',
              color: '#fff', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700, flexShrink: 0,
              transition: 'background .2s',
            }}
          >
            {copiado ? 'Copiado! ✓' : 'Copiar'}
          </button>
        </div>
      </div>

      {/* Countdown */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        background: segsRestantes < 60 ? '#fff7ed' : 'var(--surface-2)',
        border: `1px solid ${segsRestantes < 60 ? '#fed7aa' : 'var(--border)'}`,
        borderRadius: 'var(--r-md)', padding: '12px',
      }}>
        <span style={{
          fontSize: 13, fontWeight: 600,
          color: segsRestantes < 60 ? '#9a3412' : 'var(--text-2)',
        }}>
          ⏱ Expira em:
        </span>
        <span style={{
          fontSize: 20, fontWeight: 800,
          color: segsRestantes < 60 ? '#dc2626' : 'var(--text-1)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {fmtCountdown(segsRestantes)}
        </span>
      </div>

      {/* Fallback: botão manual se Realtime cair */}
      {!realtimeOk && (
        <button
          onClick={() => router.refresh()}
          style={{
            padding: '10px', borderRadius: 'var(--r-md)',
            background: 'var(--surface)', border: '1px solid var(--border)',
            cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-2)',
          }}
        >
          🔄 Verificar pagamento
        </button>
      )}

    </div>
  )
}
```

- [ ] **Step 2: Verificar compilação**

```bash
cd "/Users/webertsantos/Documents/Hub/Loja virtual/app"
npx tsc --noEmit 2>&1 | head -30
```

Resultado esperado: sem erros de tipo.

- [ ] **Step 3: Commit**

```bash
git add "app/(loja)/cantina/[aluno_id]/recarga/[recarga_id]/AguardandoClient.tsx"
git commit -m "feat(cantina): AguardandoClient com QR Code, countdown e Supabase Realtime"
git push
```

---

## Task 7: Estender webhook Asaas para detectar recargas

**Files:**
- Modify: `app/api/webhook/asaas/route.ts`

O webhook atual só lida com pedidos (`pagamentos` table). Precisa detectar `externalReference` com prefixo `recarga:` e chamar a RPC `confirmar_recarga`.

- [ ] **Step 1: Adicionar o bloco de detecção de recargas no handler `POST`**

Abra `app/api/webhook/asaas/route.ts`. Localize o trecho (linhas 163–177) onde o webhook busca o pagamento na tabela `pagamentos`:

```typescript
// 4. Localiza pedido pelo gateway_id
const supabase = createAdminClient()

const { data: pagamento, error: pagErr } = await supabase
  .from('pagamentos')
  .select('id, pedido_id, status')
  .eq('gateway_id', payment.id)
  .single()
```

**Antes** desse bloco (e após o check `if (!payment?.id)` na linha 161), insira:

```typescript
// 4a. Detecta recargas de cantina pelo externalReference
const supabase = createAdminClient()
const externalRef = payment.externalReference ?? ''

if (externalRef.startsWith('recarga:')) {
  const recargaId = externalRef.slice('recarga:'.length)
  try {
    const { data, error: rpcErr } = await supabase
      .rpc('confirmar_recarga', { p_recarga_id: recargaId })
    if (rpcErr) throw rpcErr
    const result = data as { ok: boolean; erro?: string }
    if (!result?.ok) {
      console.warn(`[webhook/asaas] confirmar_recarga falhou: ${result?.erro}`)
    } else {
      console.log(`[webhook/asaas] Recarga ${recargaId} confirmada.`)
    }
    return Response.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno.'
    console.error('[webhook/asaas] Erro ao confirmar recarga:', err)
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}

// 4b. Localiza pedido da loja pelo gateway_id (fluxo existente)
```

**Remova** a linha `const supabase = createAdminClient()` que existia antes do bloco de `pagamentos` (agora já foi declarado acima). Renomeie o comentário `// 4.` para `// 4b.` para consistência.

O resultado final do trecho deve ser:

```typescript
  if (!payment?.id) {
    return Response.json({ error: 'Payload sem payment.id.' }, { status: 400 })
  }

  // 4a. Detecta recargas de cantina pelo externalReference
  const supabase = createAdminClient()
  const externalRef = payment.externalReference ?? ''

  if (externalRef.startsWith('recarga:')) {
    const recargaId = externalRef.slice('recarga:'.length)
    try {
      const { data, error: rpcErr } = await supabase
        .rpc('confirmar_recarga', { p_recarga_id: recargaId })
      if (rpcErr) throw rpcErr
      const result = data as { ok: boolean; erro?: string }
      if (!result?.ok) {
        console.warn(`[webhook/asaas] confirmar_recarga falhou: ${result?.erro}`)
      } else {
        console.log(`[webhook/asaas] Recarga ${recargaId} confirmada.`)
      }
      return Response.json({ ok: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro interno.'
      console.error('[webhook/asaas] Erro ao confirmar recarga:', err)
      return Response.json({ ok: false, error: message }, { status: 500 })
    }
  }

  // 4b. Localiza pedido da loja pelo gateway_id
  const { data: pagamento, error: pagErr } = await supabase
    .from('pagamentos')
    .select('id, pedido_id, status')
    .eq('gateway_id', payment.id)
    .single()
```

- [ ] **Step 2: Verificar compilação**

```bash
cd "/Users/webertsantos/Documents/Hub/Loja virtual/app"
npx tsc --noEmit 2>&1 | head -20
```

Resultado esperado: sem erros.

- [ ] **Step 3: Commit e push**

```bash
git add app/api/webhook/asaas/route.ts
git commit -m "feat(cantina): webhook detecta externalReference 'recarga:' e chama confirmar_recarga"
git push
```

---

## Task 8: Verificação end-to-end

Validação manual do fluxo completo em ambiente de sandbox Asaas.

- [ ] **Step 1: Confirmar que o Vercel deployou**

Acesse o dashboard do Vercel e aguarde o deploy da branch completar (normalmente 1–2 min após o último push).

- [ ] **Step 2: Testar o fluxo como responsável**

1. Acesse a loja em produção/preview e logue como responsável
2. Vá em Cantina → selecione um aluno → Recarregar
3. Escolha um valor (ex: R$ 20,00) e clique em "Recarregar"
4. Verifique que você é redirecionado para `/cantina/[aluno_id]/recarga/[recarga_id]`
5. Verifique que o QR Code aparece + o código copia-e-cola + o countdown

- [ ] **Step 3: Testar a segurança de ownership**

1. Copie a URL da página de aguardando (`/cantina/[aluno_id]/recarga/[recarga_id]`)
2. Abra em uma sessão de outro usuário (ou logout)
3. Resultado esperado: página 404 (not found)

- [ ] **Step 4: Testar o PIX via sandbox Asaas**

No painel sandbox do Asaas (sandbox.asaas.com):
1. Localize o pagamento com `externalReference = recarga:{recarga_id}`
2. Clique em "Confirmar pagamento" manualmente
3. Observe no Vercel Logs que o webhook recebeu o evento
4. Verifique que o Realtime notificou o browser (estado muda para ✅)
5. Verifique que o saldo do aluno foi creditado em `cantina_carteiras`

- [ ] **Step 5: Testar renovação de PIX expirado**

Para testar sem esperar a expiração real:
```sql
-- No SQL Editor do Supabase
UPDATE cantina_recargas
SET pix_expiracao = now() - interval '1 minute'
WHERE id = '<recarga_id>';
```

Recarregue a página — o countdown deve mostrar 00:00 e o estado deve mudar para ⏰ "PIX expirado". Clique em "Gerar novo PIX" e verifique que um novo QR Code aparece.

- [ ] **Step 6: Verificar idempotência do webhook**

Dispare o mesmo webhook duas vezes (usando ngrok + Asaas sandbox ou duplicando manualmente a chamada POST no Insomnia/curl). Verifique que o saldo foi creditado apenas uma vez:

```sql
SELECT saldo FROM cantina_carteiras WHERE id = (
  SELECT carteira_id FROM cantina_recargas WHERE id = '<recarga_id>'
);
```

---

## Checklist de Segurança

Após implementação completa, verifique:

- [ ] `iniciarRecargaAction` não credita saldo diretamente — apenas cria PIX e registra `aguardando`
- [ ] `[recarga_id]/page.tsx` retorna 404 para recargas de outros usuários
- [ ] `confirmar_recarga` usa `SELECT FOR UPDATE` — dois webhooks simultâneos não creditam duas vezes
- [ ] `renovarRecargaAction` rejeita recargas com `pix_expiracao > now()`
- [ ] RLS em `cantina_recargas` limita leitura ao próprio responsável
