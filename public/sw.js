/**
 * Service Worker do PDV Offline-First (Fase 1).
 *
 * Escopo: apenas requests pra `/operador`, assets do Next (`/_next`),
 * imagens (`/imagens`, `/_next/image`) e ícones/manifest. Todo o resto
 * (loja, admin, checkout, `/api/*`) é passado direto pra rede sem
 * interferência — esse SW NÃO pode quebrar checkout nem áreas
 * administrativas se o usuário visitar outras rotas no mesmo browser.
 *
 * Estratégias:
 *  - NetworkOnly       → `/api/*`, querystring `?_action=*`, POST/PUT/DELETE
 *  - NetworkFirst      → navegação a `/operador*` (fallback de shell em offline)
 *  - StaleWhileRevalidate → `/_next/static/*` e ícones (cache rápido, atualiza em bg)
 *  - CacheFirst        → imagens (`/imagens/*`, `/_next/image*`) com TTL de 7 dias
 *
 * Versionamento: bump em `CACHE_VERSION` invalida todos os caches antigos
 * no `activate`. Combinado com `skipWaiting` + `clientsClaim`, garante que
 * cliente novo entra em ação assim que o usuário aceitar a notificação de
 * update (ver `lib/pdv-offline/sw-register.ts`).
 *
 * ── RISCO CONHECIDO — PII em HTML cacheado ──────────────────────
 * O HTML do `/operador` inclui `user.id` do operador autenticado embutido
 * no shell (server component). Em deploys single-operator-per-machine
 * (configuração típica de PDV de balcão), isso é aceitável: o dispositivo
 * é dedicado àquele operador. Se mais de um operador usar o mesmo
 * dispositivo offline no futuro, considerar limpar o cache no logout
 * (`caches.delete(SHELL_CACHE)`) ou usar header `Vary` por usuário.
 */

const CACHE_VERSION = 'pdv-v1'
const SHELL_CACHE   = `${CACHE_VERSION}-shell`
const STATIC_CACHE  = `${CACHE_VERSION}-static`
const IMAGE_CACHE   = `${CACHE_VERSION}-images`

const ALL_CACHES = [SHELL_CACHE, STATIC_CACHE, IMAGE_CACHE]

// Recursos minimos pré-cacheados na install. O resto entra sob demanda via
// estratégias de runtime — manter essa lista enxuta evita falhas de install
// caso uma URL específica esteja temporariamente indisponível.
const PRECACHE_URLS = [
  '/operador',
  '/icon',
  '/manifest.webmanifest',
  '/favicon.ico',
]

// TTL pra cache de imagens (7 dias).
const IMAGE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

// Timeout do fetch no NetworkFirst. Sem isso, uma conexão pendurada
// (slow loris, DNS travado) deixa o usuário esperando até o browser
// desistir — pior UX que offline real. 3s é o sweet spot: longo o
// suficiente pra rede ruim funcionar, curto o bastante pra cair no
// cache rapidamente quando algo está errado.
const NETWORK_TIMEOUT_MS = 3000

// ── Install ──────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE)
      // `addAll` é all-or-nothing — usamos `add` individual com catch
      // pra não derrubar a install inteira se uma URL falhar (ex.: 404
      // transitório no manifest durante deploy).
      await Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch(() => {
            // Loga mas não interrompe — runtime cache pega depois.
            // eslint-disable-next-line no-console
            console.warn('[sw] precache falhou para', url)
          }),
        ),
      )
    })(),
  )
})

// ── Activate ─────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((k) => !ALL_CACHES.includes(k))
          .map((k) => caches.delete(k)),
      )
      await self.clients.claim()
    })(),
  )
})

// ── Mensagem do registrador (skip waiting) ───────────────────

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// ── Fetch (roteamento de estratégias) ────────────────────────

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  // Só interceptamos same-origin. Cross-origin (CDN externo, Supabase, etc.)
  // passa direto — não é nosso problema gerenciar cache deles.
  if (url.origin !== self.location.origin) return

  // Mutações NUNCA são cacheadas — vai direto pra rede.
  if (req.method !== 'GET') return

  // Server actions com `?_action=` também são mutações lógicas — não cachear.
  if (url.searchParams.has('_action')) return

  // `/api/*` é network-only por contrato (auth, dados sensíveis, mutações).
  if (url.pathname.startsWith('/api/')) return

  // Allow-list de paths que o SW pode tocar. Qualquer coisa fora dessa lista
  // (ex.: `/loja`, `/admin`, `/checkout`, `/login`) passa direto pra rede.
  //
  // Blast-radius intencional de `/_next/*`: chunks do Next são compartilhados
  // entre TODAS as seções do app (loja, admin, checkout, operador) — não há
  // como discriminar "chunk-de-operador" de "chunk-de-loja" sem parser de
  // bundle. Cachear todos é seguro porque:
  //   1. URLs do Next incluem hash de conteúdo → imutáveis por design.
  //   2. SWR revalida em background → bundle novo entra no cache na próxima
  //      visita, sem precisar invalidar manualmente.
  //   3. Não inclui HTML de outras seções, só JS/CSS sem PII.
  const path = url.pathname
  const isAllowed =
    path.startsWith('/operador') ||
    path.startsWith('/_next/') ||
    path.startsWith('/imagens/') ||
    path === '/icon' ||
    path.startsWith('/icon/') ||
    path === '/favicon.ico' ||
    path === '/manifest.webmanifest'

  if (!isAllowed) return

  // CacheFirst com TTL pra imagens (rotas Next/Image e pasta /imagens).
  if (isImageRequest(url, req)) {
    event.respondWith(cacheFirstWithTtl(req, IMAGE_CACHE, IMAGE_MAX_AGE_MS))
    return
  }

  // StaleWhileRevalidate pra estáticos imutáveis do Next e ícones.
  if (
    path.startsWith('/_next/static/') ||
    path === '/icon' ||
    path.startsWith('/icon/') ||
    path === '/favicon.ico' ||
    path === '/manifest.webmanifest'
  ) {
    event.respondWith(staleWhileRevalidate(req, STATIC_CACHE))
    return
  }

  // NetworkFirst com fallback pra navegação do shell do operador.
  if (path.startsWith('/operador')) {
    event.respondWith(networkFirstWithFallback(req, SHELL_CACHE))
    return
  }

  // Resto do `/_next/` (chunks dinâmicos não-static): SWR também serve.
  event.respondWith(staleWhileRevalidate(req, STATIC_CACHE))
})

// ── Helpers de estratégia ────────────────────────────────────

function isImageRequest(url, req) {
  if (url.pathname.startsWith('/_next/image')) return true
  if (url.pathname.startsWith('/imagens/')) return true
  if (req.destination === 'image') return true
  return /\.(jpe?g|png|webp|gif|svg|avif)$/i.test(url.pathname)
}

async function networkFirstWithFallback(req, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    // Race com timeout: se rede demorar mais que NETWORK_TIMEOUT_MS, cai
    // direto no cache em vez de esperar o browser desistir (que pode levar
    // dezenas de segundos). Conexão pendurada não pode degradar UX.
    const res = await Promise.race([
      fetch(req),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('network-timeout')), NETWORK_TIMEOUT_MS),
      ),
    ])
    if (res && res.ok) {
      // Atualiza cache em background — clonar pra não consumir o body.
      cache.put(req, res.clone()).catch(() => {})
    }
    return res
  } catch {
    const cached = await cache.match(req)
    if (cached) return cached
    // Última cartada: tenta servir a raiz do shell como fallback de SPA.
    const shell = await cache.match('/operador')
    if (shell) return shell
    return new Response('Offline', { status: 503, statusText: 'Offline' })
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(req)
  const networkPromise = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone()).catch(() => {})
      return res
    })
    .catch(() => null)

  if (cached) return cached
  const fresh = await networkPromise
  if (fresh) return fresh
  return new Response('Offline', { status: 503, statusText: 'Offline' })
}

async function cacheFirstWithTtl(req, cacheName, maxAgeMs) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(req)

  if (cached && !isExpired(cached, maxAgeMs)) return cached

  try {
    const res = await fetch(req)
    if (res && res.ok) {
      const dated = await withDateHeader(res.clone())
      cache.put(req, dated).catch(() => {})
    }
    return res
  } catch {
    // Se expirou mas tem cache, ainda assim devolve — melhor que nada offline.
    if (cached) return cached
    return new Response('Offline', { status: 503, statusText: 'Offline' })
  }
}

function isExpired(response, maxAgeMs) {
  const dateHeader = response.headers.get('sw-cached-at') || response.headers.get('date')
  // Header ausente = trata como expirado pra forçar revalidação (mais seguro).
  // Caso edge: resposta cacheada por versão antiga do SW antes do header
  // existir — sem essa defesa, viraria imortal no cache.
  if (!dateHeader) return true
  const cachedAt = Date.parse(dateHeader)
  // Data inválida = mesma lógica: revalida em vez de servir possivelmente stale.
  if (Number.isNaN(cachedAt)) return true
  return Date.now() - cachedAt > maxAgeMs
}

async function withDateHeader(response) {
  // Reembrulha a response carimbando `sw-cached-at` pra cálculo de TTL
  // independente do `Date` original do servidor (que pode estar ausente
  // em respostas opaquish ou divergir do relógio do cliente).
  const body = await response.blob()
  const headers = new Headers(response.headers)
  headers.set('sw-cached-at', new Date().toUTCString())
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
