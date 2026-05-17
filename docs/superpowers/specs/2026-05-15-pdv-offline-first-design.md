# Design — PDV/Check-in Offline-First (EduStore)

**Data:** 2026-05-15
**Status:** Em análise — aguardando aprovação
**Escopo:** Tornar `/operador` (PDV cantina/portaria) capaz de operar sem internet por **algumas horas (turno)**, sincronizando ao reconectar.

---

## 1. Contexto

Hoje o PDV (`/operador`) é 100% online-first:

- `app/(operador)/operador/page.tsx` é Server Component → cada navegação bate no Supabase.
- `buscarAlunoCantinaAction` e `confirmarCompraCantinaAction` (em `app/actions/cantina.ts`) exigem resposta síncrona do servidor.
- Não há service worker, IndexedDB, fila de retry, nem `next-pwa`/workbox.

Resultado prático: Wi-Fi escolar caindo no recreio = caixa parado. Operador não consegue cobrar, aluno fica sem comer.

## 2. Requisitos (decididos com o usuário)

| Decisão | Escolha | Implicação |
|---|---|---|
| Duração offline | Algumas horas (turno) | Pré-download completo + outbox robusto, sem precisar de replicação contínua de dias |
| Validação de saldo offline | Saldo local (último sincronizado) | PDV bloqueia compra se saldo local < total. Reconciliação no sync pode rejeitar se estiver realmente negativo |
| Multi-caixa | Não — um caixa por escola | Sem necessidade de lock distribuído nem CRDT. Conflitos só entre online/offline do mesmo dispositivo |
| Volume alunos | ~1500 por escola | Pré-download completo cabe em IndexedDB (~2-3 MB) |

## 3. Arquitetura

### 3.1 Visão geral

```
┌─────────────────────────────────────────────────────┐
│                  Browser (PDV)                      │
│                                                     │
│  ┌──────────────┐         ┌────────────────────┐   │
│  │  PdvClient   │◄───────►│  Local Store (IDB) │   │
│  │  (UI React)  │         │  (Dexie)           │   │
│  └──────┬───────┘         │  - alunos          │   │
│         │                 │  - carteiras       │   │
│         │                 │  - restricoes      │   │
│         ▼                 │  - produtos        │   │
│  ┌──────────────┐         │  - outbox          │   │
│  │ Sync Engine  │◄───────►│  - meta            │   │
│  │ (worker)     │         └────────────────────┘   │
│  └──────┬───────┘                                  │
│         │                                          │
│  ┌──────▼───────┐                                  │
│  │ Service      │  (cache shell + assets)         │
│  │ Worker       │                                  │
│  └──────┬───────┘                                  │
└─────────┼──────────────────────────────────────────┘
          │ HTTPS (quando online)
          ▼
┌─────────────────────────────────────────────────────┐
│              Supabase (Postgres + RLS)              │
│  - cantina_pedidos (+ compra_local_id UNIQUE)       │
│  - cantina_carteiras                                │
│  - cantina_movimentacoes                            │
│  - cantina_compras_rejeitadas (nova)                │
│  - RPC: processar_compra_offline (nova, idempotente)│
└─────────────────────────────────────────────────────┘
```

### 3.2 Stack adicional

| Lib | Versão alvo | Uso | Tamanho |
|---|---|---|---|
| `dexie` | ^4 | Wrapper IndexedDB tipado | ~25 KB |
| `bcryptjs` ou `bcrypt-ts` | latest | Verificar PIN offline (mesmo algo do server) | ~20 KB |
| Service Worker | nativo (sem `next-pwa`) | Cache shell + offline fallback | 0 |

> Decisão: **não** usar `next-pwa`. A lib é mantida intermitentemente e gera fricção com Next 15. Vamos escrever um SW pequeno (~80 linhas) com `workbox-window` apenas pro lifecycle, ou nativo puro.

### 3.3 Escopo do Service Worker

- **Registra apenas em `/operador/*`** — loja, admin e checkout continuam intocados.
- **Cache strategies:**
  - **Shell** (`/operador`, `_next/static/*`, manifest, ícones): `StaleWhileRevalidate`.
  - **Server Actions / `/api/*`**: **NetworkOnly** — nunca cachear escrita.
  - **Imagens de produto**: `CacheFirst` com expiração 7 dias.
- **Versionamento:** `CACHE_VERSION` em `sw.js`, bump invalida cache antigo.
- **Fallback offline:** rota `/operador` serve da cache se rede falhar.

### 3.4 Local Store (IndexedDB via Dexie)

Schema da DB local `edustore_pdv_v1`:

```ts
db.version(1).stores({
  alunos:        'id, nome, serie, turma, escola_id',
  carteiras:     'id, aluno_id, escola_id, saldo, limite_diario, ativo',
  restricoes:    '++localId, aluno_id, produto_id',
  produtos:      'id, escola_id, nome, ativo',
  outbox:        'compra_local_id, status, criado_em',  // 'pendente' | 'enviado' | 'rejeitado'
  meta:          'chave',                                // últimas datas de sync, escola_id, etc.
})
```

- **Pré-download inicial**: ao primeiro login online, baixa tudo. Progresso visível ("Sincronizando 1500 alunos…").
- **Sync incremental**: após o inicial, sincroniza por `updated_at` desde o último sync. Pull a cada 60s quando online.
- **Realtime opcional (Fase 3)**: assinatura `cantina_carteiras` por `escola_id` para refletir recargas em tempo real.

### 3.5 Fluxo de compra offline

```
1. Operador busca aluno         → query local IDB (instantâneo)
2. Adiciona itens ao carrinho   → state local (já é assim hoje)
3. Confirma compra              →
   a. Valida saldo_local >= total       (bloqueia se não)
   b. Valida restrições (local)
   c. Pede PIN                          (verify bcrypt local)
   d. Gera compra_local_id (UUID v4)
   e. Decrementa saldo local da carteira
   f. Insere em outbox (status='pendente')
   g. UI mostra "Compra registrada. Sincroniza ao voltar online."
4. Sync engine envia outbox    →
   a. Para cada item pendente, chama RPC processar_compra_offline
   b. Se OK → status='enviado'; atualiza saldo_servidor
   c. Se erro de saldo → status='rejeitado'; entra em fila de divergências
   d. Se erro de rede → mantém pendente, tenta de novo
```

### 3.6 Reconciliação de saldo

Cenário típico (single-caixa):
- Saldo local no início do offline: R$ 50,00
- 3 compras offline totalizando R$ 28,00 → saldo local = R$ 22,00
- Pais recarregaram R$ 100 via PIX online enquanto estava offline → saldo servidor = R$ 150
- Volta online → sync envia 3 compras → server debita → saldo final servidor = R$ 122
- Local atualiza pra R$ 122 (saldo servidor é a verdade após sync)

Se saldo servidor for menor que local (ex: outro débito veio por outra rota):
- RPC retorna erro `SALDO_INSUFICIENTE` na compra que estourou
- Compra entra em `cantina_compras_rejeitadas` com snapshot de itens
- UI no admin mostra alerta "3 compras offline rejeitadas — cobrar manualmente"

### 3.7 Idempotência

- Cliente gera `compra_local_id UUID` antes de chamar RPC.
- Tabela `cantina_pedidos` ganha coluna `compra_local_id UUID UNIQUE NULL`.
- RPC `processar_compra_offline` faz `INSERT ... ON CONFLICT (compra_local_id) DO NOTHING RETURNING *`.
- Se cliente re-tentar após timeout, server retorna o pedido já existente — sem dupla cobrança.

### 3.8 PIN offline

- Hash bcrypt já existe em `cantina_carteiras.senha_pin_hash` (server-side).
- Pré-download inclui o hash para o dispositivo do operador autenticado.
- Verificação local com `bcryptjs.compare(pin, hash)`.
- **Risco:** hash fica no IndexedDB. Mitigações:
  - Limpa IDB no logout do operador.
  - Apenas dispositivos autenticados como `role=operador` da escola conseguem baixar.
  - Bcrypt já é resistente a brute force (mesmo se vazar).

### 3.9 Mudanças no banco (migrations)

```sql
-- 1) Idempotência de compra
ALTER TABLE cantina_pedidos
  ADD COLUMN compra_local_id UUID UNIQUE,
  ADD COLUMN criado_offline_em TIMESTAMPTZ;

-- 2) Compras rejeitadas no sync
CREATE TABLE cantina_compras_rejeitadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id UUID NOT NULL REFERENCES escolas(id),
  aluno_id UUID NOT NULL REFERENCES alunos(id),
  operador_id UUID REFERENCES auth.users(id),
  compra_local_id UUID NOT NULL,
  itens JSONB NOT NULL,
  total NUMERIC(10,2) NOT NULL,
  motivo TEXT NOT NULL,
  saldo_no_servidor NUMERIC(10,2),
  criado_offline_em TIMESTAMPTZ NOT NULL,
  registrado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON cantina_compras_rejeitadas (escola_id, registrado_em DESC);
ALTER TABLE cantina_compras_rejeitadas ENABLE ROW LEVEL SECURITY;
-- + RLS: admin/operador da escola consegue ler

-- 3) RPC idempotente
CREATE OR REPLACE FUNCTION processar_compra_offline(
  p_compra_local_id UUID,
  p_aluno_id UUID,
  p_itens JSONB,
  p_total NUMERIC,
  p_operador_id UUID,
  p_criado_offline_em TIMESTAMPTZ
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pedido cantina_pedidos%ROWTYPE;
  v_carteira cantina_carteiras%ROWTYPE;
BEGIN
  -- Idempotência
  SELECT * INTO v_pedido FROM cantina_pedidos
    WHERE compra_local_id = p_compra_local_id;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'duplicado', true, 'pedido_id', v_pedido.id);
  END IF;

  SELECT * INTO v_carteira FROM cantina_carteiras WHERE aluno_id = p_aluno_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'CARTEIRA_NAO_ENCONTRADA');
  END IF;

  IF v_carteira.saldo < p_total THEN
    INSERT INTO cantina_compras_rejeitadas (
      escola_id, aluno_id, operador_id, compra_local_id, itens, total,
      motivo, saldo_no_servidor, criado_offline_em
    ) VALUES (
      v_carteira.escola_id, p_aluno_id, p_operador_id, p_compra_local_id,
      p_itens, p_total, 'SALDO_INSUFICIENTE', v_carteira.saldo, p_criado_offline_em
    );
    RETURN jsonb_build_object('ok', false, 'erro', 'SALDO_INSUFICIENTE');
  END IF;

  -- Reusa lógica de debitar_saldo_cantina (movimentação + saldo)
  -- ... [delega/inlines o trabalho existente, criando pedido com compra_local_id]

  RETURN jsonb_build_object('ok', true, 'duplicado', false, 'pedido_id', v_pedido.id);
END $$;
```

### 3.10 Estrutura de arquivos nova

```
app/
  (operador)/
    operador/
      page.tsx               # mantém, mas aceita render offline (cache do SW)
      PdvClient.tsx          # refatora pra usar localStore em vez de actions
      sync-status.tsx        # badge "Online / Offline / Sincronizando 3"
      divergencias/page.tsx  # tela admin pra ver compras rejeitadas

lib/
  pdv-offline/
    db.ts                    # Dexie schema + tipagem
    sync.ts                  # engine de pull (alunos/carteiras) + push (outbox)
    outbox.ts                # enqueue, list, mark-sent, mark-rejected
    pin.ts                   # bcrypt verify offline
    network.ts               # detector online/offline + heartbeat

public/
  sw.js                      # service worker (escopo /operador)

supabase/migrations/
  20260516_pdv_offline_idempotencia.sql
  20260516_pdv_offline_rejeitadas.sql
  20260516_pdv_offline_rpc.sql
```

## 4. Fases de entrega

### Fase 1 — PWA + Leitura offline (1-2 dias)
- Service worker registrado em `/operador/*`
- Pré-download de alunos, carteiras (sem hash), produtos, restrições
- Busca de aluno funciona offline (read-only)
- Badge "Online/Offline"
- **Não permite compra offline ainda** — cai num "tente novamente quando online"

**Entrega:** operador consegue abrir o PDV e procurar alunos sem rede. Compra continua exigindo rede.

### Fase 2 — Outbox + Compra offline (2-3 dias)
- Coluna `compra_local_id` + RPC `processar_compra_offline` + tabela `cantina_compras_rejeitadas`
- Pré-download passa a incluir `senha_pin_hash`
- Verificação de PIN offline (bcryptjs)
- Outbox em IDB + sync engine
- UI de fila ("3 compras pendentes de sincronização")
- Tela admin `/operador/divergencias` lista rejeitadas

**Entrega:** caixa funciona plenamente offline por horas. Sincroniza ao voltar.

### Fase 3 — Realtime + polimento (1-2 dias)
- Subscription em `cantina_carteiras` por escola → saldo local atualiza em tempo real
- Indicador de "última sincronização há Xs"
- Sync conflict report no admin (`/admin/cantina/divergencias`)
- Logs em `auditoria_log` por compra offline
- Cleanup automático de outbox enviado

**Entrega:** UX completa. Operador vê recargas dos pais entrando em tempo real.

## 5. Riscos e mitigações

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Hash do PIN exposto em IDB | Baixa | Bcrypt resistente; limpar IDB no logout; só baixar pra role=operador autenticada |
| Operador cobra offline e aluno não tem saldo | Média | Compra entra em `compras_rejeitadas`; admin é alertado; cobrança manual |
| IDB corrompida | Baixa | Detector que limpa e re-sincroniza; nunca perde dados (tudo no servidor após sync) |
| Operador troca de dispositivo com outbox pendente | Média | Aviso "X compras não sincronizadas — não saia desta tela" + lock no logout |
| Service Worker em cache antigo após deploy | Alta | Versionamento + skipWaiting + clientsClaim com aviso "Nova versão disponível, recarregue" |
| Senha PIN diferente entre dispositivos (se mudada online) | Baixa | Sync incremental atualiza hash; fallback: rejeita PIN local e força modo online |
| Crescimento do outbox (rede ficou semana fora) | Baixa | Limite de 500 compras pendentes; bloqueia novas e exige sync |

## 6. Métricas de sucesso

- **0 caixas parados por queda de rede** (medido via `auditoria_log`)
- **<1% de compras rejeitadas no sync** após 30 dias de uso
- **Tempo de busca de aluno < 100ms** (vs ~400-800ms hoje, online)
- **Pré-download completo em < 10s** numa conexão 4G

## 7. Fora de escopo

- Multi-caixa simultâneo (decisão do usuário: 1 caixa por escola)
- Replicação contínua de dias (turno é suficiente)
- Sync conflict resolution complexo tipo CRDT
- Recarga via PIX offline (PIX precisa de internet por natureza)
- Edição de produtos offline (apenas leitura/venda)

---

**Próximo passo:** após aprovação, gerar `docs/superpowers/plans/2026-05-15-pdv-offline-fase-1.md` com tasks granulares de TDD pra Fase 1.
