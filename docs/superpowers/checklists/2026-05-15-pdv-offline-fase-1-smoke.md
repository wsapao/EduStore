# Smoke Test — PDV Offline-First Fase 1

**Data:** 2026-05-15
**Branch:** `feat/pdv-offline-fase-1`
**Spec:** [`2026-05-15-pdv-offline-first-design.md`](../specs/2026-05-15-pdv-offline-first-design.md)
**Plan:** [`2026-05-15-pdv-offline-fase-1.md`](../plans/2026-05-15-pdv-offline-fase-1.md)

Como Service Worker e IndexedDB só rodam em browser real, a Fase 1 exige validação manual além dos 252 testes automatizados.

## Pré-requisitos

- Branch `feat/pdv-offline-fase-1` deployado (preview Vercel ou build local em produção: `npm run build && npm start`)
- Login como usuário com role `operador` ou `admin`
- Chrome ou Edge (DevTools com aba **Application**)
- Conexão com Wi-Fi controlável (DevTools → Network → Offline)

## Cenário 1 — Bootstrap inicial (IDB vazia, online)

1. [ ] Abrir aba anônima, fazer login como operador
2. [ ] Navegar pra `/operador`
3. [ ] **Esperado:** overlay escuro "Sincronizando dados para uso offline…"
4. [ ] **Esperado:** após alguns segundos, overlay some
5. [ ] **Esperado:** badge no canto superior direito mostra `🟢 Online · sync agora`
6. [ ] DevTools → Application → IndexedDB → `edustore_pdv_v1` deve ter as 5 stores (`alunos`, `carteiras`, `restricoes`, `produtos`, `meta`) populadas

## Cenário 2 — Service Worker registrado

1. [ ] DevTools → Application → Service Workers
2. [ ] **Esperado:** SW em `/sw.js` com status **activated and is running**
3. [ ] Application → Cache Storage deve ter `edustore-pdv-shell-pdv-v1` ou similar com `/operador`, `/_next/static/*`, ícones
4. [ ] Em DEV mode (`npm run dev`): SW **NÃO** deve aparecer (gating por `NODE_ENV === 'production'`)

## Cenário 3 — Cair offline e continuar usando

1. [ ] Com `/operador` aberto e snapshot já baixado
2. [ ] DevTools → Network → **Offline**
3. [ ] **Esperado:** badge muda pra `🔴 Offline · sync há Xs`
4. [ ] **Esperado:** banner no topo do PdvClient: "🔌 Offline — apenas busca disponível…"
5. [ ] **Esperado:** F5 carrega `/operador` normalmente (servido pelo SW)
6. [ ] Buscar aluno por nome (>=2 caracteres)
7. [ ] **Esperado:** resultados aparecem instantaneamente (consulta IDB local)
8. [ ] **Esperado:** badge cinza "🔌 busca offline" aparece junto da barra de busca

## Cenário 4 — Selecionar aluno e tentar comprar offline

1. [ ] Offline, selecionar um aluno e adicionar itens ao carrinho
2. [ ] **Esperado:** carrinho funciona normalmente (state local)
3. [ ] **Esperado:** botão "Confirmar compra" desabilitado (opacity reduzida, cursor `not-allowed`, texto "🔌 Sem internet")
4. [ ] Forçar clique no botão (DevTools) ou tentar via teclado
5. [ ] **Esperado:** erro "Compra precisa de internet (Fase 1). Conecte para continuar."

## Cenário 5 — Voltar online: sync retoma

1. [ ] DevTools → Network → **Online**
2. [ ] **Esperado:** badge volta pra `🟢 Online`
3. [ ] **Esperado:** após até 60s, "sync" no badge atualiza pra "agora"
4. [ ] Botão "sincronizar" no badge funciona (estado vira `🔄 Sincronizando…` brevemente)
5. [ ] Confirmar compra agora funciona normalmente (chama action online)

## Cenário 6 — Não-regressão das outras rotas

Crítico: SW tem `scope: '/'`, então cobre TODA a origem. A allow-list dentro do `sw.js` deve garantir que só `/operador`, `/_next`, `/imagens`, `/icon`, `/favicon`, `/manifest` passam pelo cache.

1. [ ] Com SW ativo, navegar pra `/loja`
2. [ ] **Esperado:** loja carrega normalmente, sem comportamento estranho de cache
3. [ ] Navegar pra `/admin`
4. [ ] **Esperado:** admin carrega normal, server components rendem dados frescos
5. [ ] Fazer um checkout em `/loja` (carrinho → checkout)
6. [ ] **Esperado:** server actions de checkout funcionam (NetworkOnly por causa do `?_action=` ou `/api/`)
7. [ ] DevTools → Network → confirmar que requests pra rotas não-operador NÃO têm header `(from ServiceWorker)`

## Cenário 7 — Deploy de nova versão

1. [ ] Após merge, fazer pequena mudança (ex: bump de CACHE_VERSION em `public/sw.js` pra `pdv-v2`)
2. [ ] Deploy
3. [ ] Reabrir `/operador` com aba já aberta
4. [ ] **Esperado:** console mostra `[PDV] Nova versão disponível — recarregue a página`
5. [ ] F5 deve servir a nova versão; cache antigo (`pdv-v1`) limpo no activate
6. [ ] (Improvement futuro: substituir `console.info` por toast pro usuário — anotado como follow-up)

## Critérios de aprovação

Cenário deve passar **integralmente** pra ser marcado ✅. Qualquer falha vira issue/follow-up antes de merge na main.

## Cenários NÃO cobertos (escopo de Fases 2/3)

- ❌ Compra funcionando offline com fila (Fase 2)
- ❌ Verificação de PIN offline (Fase 2)
- ❌ Saldo atualizando em tempo real via Realtime (Fase 3)
- ❌ Tela de divergências de sync (Fase 3)
