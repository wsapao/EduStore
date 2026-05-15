# Plano — PDV Offline-First Fase 1 (Leitura offline + PWA)

**Data:** 2026-05-15
**Spec:** [`2026-05-15-pdv-offline-first-design.md`](../specs/2026-05-15-pdv-offline-first-design.md)
**Branch:** `feat/pdv-offline-fase-1`
**Estimativa:** 1-2 dias

## Objetivo da Fase 1

Operador consegue **abrir o PDV e buscar alunos sem internet**. Compra ainda exige rede (vem na Fase 2). Foco: provar que o pipeline de pré-download + IndexedDB + Service Worker funciona ponta a ponta.

## Critério de aceite

1. ✅ Operador faz login online → recebe progresso "Sincronizando 1500 alunos…"
2. ✅ Após sync, Wi-Fi pode cair → `/operador` continua acessível (cache do SW)
3. ✅ Busca de aluno funciona offline (consulta IDB local)
4. ✅ Badge "Offline" aparece no topo quando sem rede
5. ✅ Tentar finalizar compra offline mostra "Compra precisa de internet (Fase 1). Conecte para continuar."
6. ✅ Voltou online → snapshot é atualizado em background a cada 60s
7. ✅ Nenhuma regressão na loja/admin/checkout (SW escopo só `/operador`)

## Tasks (ordem de execução, TDD)

### T1 — Schema local (IndexedDB via Dexie)
**Arquivo:** `lib/pdv-offline/db.ts` + teste `db.test.ts`

- [ ] Instalar `dexie` (`npm i dexie`)
- [ ] Definir schema v1 com stores: `alunos`, `carteiras`, `restricoes`, `produtos`, `meta`
- [ ] Tipos TS pra cada store
- [ ] Teste: db abre, stores têm índices certos, put/get funcionam
- [ ] Teste: bumping version não destrói dados (migração)

### T2 — Server action `getPdvSnapshotAction`
**Arquivo:** `app/actions/pdv-offline.ts` + teste

- [ ] Action consulta `escola_id` do operador
- [ ] Retorna `{ alunos, carteiras (sem senha_pin_hash), produtos_cantina, restricoes, server_time }`
- [ ] Suporta `since?: ISO` pra incremental (Fase 1 sempre full, mas API já preparada)
- [ ] Permissão: `requirePermission('cantina.operar')` ou `role=operador`
- [ ] Teste: mock supabase + auth, verificar payload + filtragem por escola_id
- [ ] Teste: rejeita user sem permissão

### T3 — Sync engine (pull)
**Arquivo:** `lib/pdv-offline/sync.ts` + teste

- [ ] `pullSnapshot()`: chama action, popula IDB, atualiza `meta.last_sync_at`
- [ ] `startBackgroundSync(intervalMs=60_000)`: loop com clearInterval no cleanup
- [ ] `getLastSyncAt()`: lê de `meta`
- [ ] Teste: mock action retornando 3 alunos → IDB tem 3 alunos
- [ ] Teste: pull subsequente substitui dados (não duplica)
- [ ] Teste: erro de rede não corrompe IDB

### T4 — Network detector
**Arquivo:** `lib/pdv-offline/network.ts` + teste

- [ ] `useOnlineStatus()` hook: navigator.onLine + listeners
- [ ] Heartbeat opcional (ping a `/api/health` a cada 30s) pra detectar "online mas sem internet de verdade"
- [ ] Teste com mock de `navigator.onLine` e events online/offline

### T5 — Service Worker
**Arquivo:** `public/sw.js` + `lib/pdv-offline/sw-register.ts`

- [ ] `sw.js` com escopo limitado a `/operador/*`:
  - Pre-cache: `/operador`, `/_next/static/*` críticos, `/icon`, `/manifest.webmanifest`
  - Strategy: SWR pra shell, NetworkOnly pra `/_actions` e `/api/*`
  - Versionamento via `CACHE_VERSION` const
- [ ] Register no client side só dentro de `/operador` (não global)
- [ ] Aviso "Nova versão disponível" quando SW novo está esperando
- [ ] Manual test plan: build, instalar, testar Wi-Fi off

### T6 — Refatorar `PdvClient` pra usar IDB
**Arquivo:** `app/(operador)/operador/PdvClient.tsx`

- [ ] Substituir `buscarAlunoCantinaAction` por consulta a Dexie (`db.alunos.where('nome').startsWithIgnoreCase(q)`)
- [ ] Manter fallback online pra escolas que ainda não baixaram
- [ ] Indicar visualmente "🔒 Busca offline (snapshot de HH:MM)" quando offline
- [ ] Bloquear botão "Confirmar compra" se offline com mensagem clara (Fase 2 destrava)

### T7 — Componente `<SyncStatusBadge />`
**Arquivo:** `app/(operador)/operador/SyncStatusBadge.tsx`

- [ ] Mostra: 🟢 Online / 🔴 Offline / 🔄 Sincronizando
- [ ] Última sync: "há 12s" / "há 3min"
- [ ] Click → modal com detalhes (contagem de alunos baixados, próximo sync)

### T8 — Setup inicial no `page.tsx`
**Arquivo:** `app/(operador)/operador/page.tsx`

- [ ] Server Component continua buscando produtos pra primeiro render (cobre dispositivo novo)
- [ ] Adiciona `<OfflineBootstrap escolaId={...} />` que dispara `pullSnapshot()` no mount se IDB vazia
- [ ] Tela de progresso "Sincronizando 1500 alunos…" com barra

### T9 — Validação manual + smoke test
**Arquivo:** `docs/superpowers/checklists/2026-05-15-pdv-offline-fase-1-smoke.md`

- [ ] Checklist passo a passo:
  1. Build, abrir `/operador` online
  2. Esperar sync (badge fica verde)
  3. DevTools → Network → Offline
  4. F5 — página deve carregar
  5. Buscar aluno — deve achar
  6. Tentar comprar — deve mostrar mensagem clara
  7. Network → Online de novo — sync resume
- [ ] Validar nenhuma regressão em `/loja`, `/admin`, `/checkout`

## Validação técnica

- [ ] `npm test` (todos os testes existentes + novos)
- [ ] `tsc --noEmit` sem erros
- [ ] `npm run build` sem warnings novos
- [ ] Lighthouse PWA score > 80 em `/operador`
- [ ] Bundle size delta < 60 KB gzipped (dexie + sw)

## Fora do escopo (Fase 2/3)

- ❌ Compra offline (Fase 2)
- ❌ Verificação de PIN offline (Fase 2)
- ❌ Outbox + sync push (Fase 2)
- ❌ Realtime de saldo (Fase 3)
- ❌ Tela de divergências (Fase 3)
- ❌ Migrations no banco (só na Fase 2)

## Risco principal

Service Worker é tricky em Next 15 com App Router. Se a integração com Next dev server der problema, fallback é só registrar SW em produção (`process.env.NODE_ENV === 'production'`). Dev usa cache do navegador padrão.

## Saída

- Branch `feat/pdv-offline-fase-1` aberta com PR
- Commits granulares por task (T1-T9)
- CI verde antes de merge
