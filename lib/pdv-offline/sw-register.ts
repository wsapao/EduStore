/**
 * Registrador do Service Worker do PDV Offline-First (Fase 1).
 *
 * Idempotente, SSR-safe e silenciosamente no-op em browsers sem suporte.
 * Decisão da spec (3.3): só registra em produção — em `next dev` o SW
 * causa comportamento estranho de cache (HMR + chunks dinâmicos) e o
 * benefício de offline não compensa. Consumer não precisa saber disso.
 *
 * Lifecycle de update:
 *  - Browser baixa `/sw.js` novo → fase `installing`.
 *  - Quando termina e existe SW antigo controlando, fica em `waiting`.
 *  - Chamamos `onUpdate(registration)` pra UI avisar usuário ("Nova versão
 *    disponível, recarregue"). Quando ele aceitar, o consumer chama
 *    `activateWaitingServiceWorker(registration)` que posta `SKIP_WAITING`,
 *    o SW assume controle (clientsClaim no activate) e a página recarrega.
 */

export interface RegisterPdvServiceWorkerOptions {
  /** Chamado quando uma nova versão do SW está em `waiting` aguardando ativação. */
  onUpdate?: (registration: ServiceWorkerRegistration) => void
  /** Chamado quando o SW está pronto e controlando a página. */
  onReady?: (registration: ServiceWorkerRegistration) => void
}

/**
 * Registra `/sw.js` no scope `/` (necessário pra cobrir `/operador*` mesmo
 * com o arquivo servido da raiz). Retorna a registration em sucesso,
 * `null` em ambientes sem suporte ou fora de produção.
 *
 * Nunca lança — qualquer erro de registro vira `null` (e log em `console.warn`).
 *
 * @example
 * ```ts
 * useEffect(() => {
 *   registerPdvServiceWorker({
 *     onUpdate: (reg) => setHasUpdate(reg),
 *     onReady: () => console.log('PDV pronto pra offline'),
 *   })
 * }, [])
 * ```
 */
export async function registerPdvServiceWorker(
  opts: RegisterPdvServiceWorkerOptions = {},
): Promise<ServiceWorkerRegistration | null> {
  // SSR safety — no servidor não há window nem navigator.
  if (typeof window === 'undefined') return null

  // Só registra em produção. Em `next dev` o SW interfere com HMR.
  if (process.env.NODE_ENV !== 'production') return null

  // Browser sem suporte (raro hoje, mas pode acontecer em WebViews antigos).
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    })

    // `ready` resolve quando há um SW ativo controlando a página — ou seja,
    // quando o app pode confiar que o cache do shell vai estar disponível
    // em uma futura desconexão.
    void navigator.serviceWorker.ready.then((readyReg) => {
      opts.onReady?.(readyReg)
    })

    // Se já existe um waiting no momento do registro (usuário reabriu a aba
    // depois de uma instalação que ficou pendente), notifica de cara.
    if (registration.waiting) {
      opts.onUpdate?.(registration)
    }

    // Detecta novas versões: cada `updatefound` cria um SW em `installing`.
    // Quando ele chega a `installed` E já existe um controller, é update
    // (vs. instalação inicial, em que não há controller).
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing
      if (!installing) return
      installing.addEventListener('statechange', () => {
        if (
          installing.state === 'installed' &&
          navigator.serviceWorker.controller
        ) {
          opts.onUpdate?.(registration)
        }
      })
    })

    return registration
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[pdv-sw] falha ao registrar service worker:', err)
    return null
  }
}

/**
 * Força o SW em `waiting` a assumir o controle. Posta `{ type: 'SKIP_WAITING' }`,
 * que o `sw.js` escuta e responde com `self.skipWaiting()`. Combinado com
 * `clientsClaim()` no `activate`, a página passa a ser controlada pela versão
 * nova sem reload — embora normalmente o consumer faça `window.location.reload()`
 * em seguida pra garantir que assets atualizados sejam buscados.
 *
 * No-op se não houver SW em waiting.
 */
export async function activateWaitingServiceWorker(
  registration: ServiceWorkerRegistration,
): Promise<void> {
  const waiting = registration.waiting
  if (!waiting) return
  waiting.postMessage({ type: 'SKIP_WAITING' })
}
