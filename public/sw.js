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
    const res = await fetch(req)
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
  if (!dateHeader) return false
  const cachedAt = Date.parse(dateHeader)
  if (Number.isNaN(cachedAt)) return false
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
