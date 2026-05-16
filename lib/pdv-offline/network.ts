/**
 * Detector de estado de rede do PDV Offline-First (Fase 1).
 *
 * Combina dois sinais:
 *  - `navigator.onLine` + eventos `online`/`offline` do browser
 *    (gratuitos, mas notoriamente otimistas — só dizem se a NIC tem link).
 *  - Heartbeat opcional via HEAD a uma URL, pra detectar caso onde
 *    o aparelho tem link de WiFi mas o backend está inacessível.
 *
 * O hook React `useOnlineStatus` é um wrapper fino sobre
 * `createOnlineStatusController`, que carrega a lógica pura testável.
 */
import { useEffect, useState } from 'react'

// ── Tipos públicos ───────────────────────────────────────────

export interface OnlineStatus {
  online: boolean
  lastChange: Date | null
}

export interface OnlineStatusOptions {
  /** Se definido, dispara HEAD periódico pra confirmar conectividade real. */
  heartbeatUrl?: string
  /** Intervalo entre heartbeats. Default: 30s. */
  heartbeatIntervalMs?: number
}

export interface OnlineStatusControllerOptions extends OnlineStatusOptions {
  /** Callback chamado sempre que o estado muda. */
  onChange?: (s: OnlineStatus) => void
  /**
   * Injeção pra testes — permite substituir `probeOnline` por um fake.
   * Em produção, default é a `probeOnline` exportada deste módulo.
   */
  probeFn?: (url: string) => Promise<boolean>
}

export interface OnlineStatusController {
  getState(): OnlineStatus
  stop(): void
}

// ── probeOnline ──────────────────────────────────────────────

/**
 * Dispara HEAD à URL com timeout de 5s. Qualquer falha (rede, abort,
 * HTTP !ok) é traduzida em `false`. Nunca lança.
 */
export async function probeOnline(url: string): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

// ── Controller puro (sem React) ──────────────────────────────

function readNavigatorOnline(): boolean {
  // SSR safety: sem window/navigator, assumimos online — o cliente
  // confirma assim que hidrata (e o hook ressincroniza no useEffect).
  if (typeof navigator === 'undefined') return true
  return navigator.onLine
}

export function createOnlineStatusController(
  opts: OnlineStatusControllerOptions = {},
): OnlineStatusController {
  const heartbeatIntervalMs = opts.heartbeatIntervalMs ?? 30_000
  const probeFn = opts.probeFn ?? probeOnline

  let state: OnlineStatus = {
    online: readNavigatorOnline(),
    lastChange: null,
  }

  const setOnline = (next: boolean) => {
    if (next === state.online) return
    state = { online: next, lastChange: new Date() }
    opts.onChange?.(state)
  }

  // Listeners de eventos do browser.
  const onOnline = () => setOnline(true)
  const onOffline = () => setOnline(false)
  const hasWindow = typeof window !== 'undefined'
  if (hasWindow) {
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
  }

  // Heartbeat opcional. Substitui o estado apenas quando o probe diverge
  // de navigator.onLine (ex.: WiFi conectado mas backend offline).
  let heartbeatHandle: ReturnType<typeof setInterval> | null = null
  if (opts.heartbeatUrl) {
    const url = opts.heartbeatUrl
    heartbeatHandle = setInterval(() => {
      void probeFn(url).then((alive) => setOnline(alive))
    }, heartbeatIntervalMs)
  }

  return {
    getState: () => state,
    stop: () => {
      if (hasWindow) {
        window.removeEventListener('online', onOnline)
        window.removeEventListener('offline', onOffline)
      }
      if (heartbeatHandle !== null) clearInterval(heartbeatHandle)
    },
  }
}

// ── Hook React ───────────────────────────────────────────────

export function useOnlineStatus(opts?: OnlineStatusOptions): OnlineStatus {
  const [state, setState] = useState<OnlineStatus>(() => ({
    online: readNavigatorOnline(),
    lastChange: null,
  }))

  useEffect(() => {
    const ctrl = createOnlineStatusController({
      ...opts,
      onChange: (s) => setState(s),
    })
    // Resync após mount caso navigator tenha mudado entre render e effect.
    setState(ctrl.getState())
    return () => ctrl.stop()
    // Heartbeat options só importam por valor; mudanças trocam o controller.
  }, [opts?.heartbeatUrl, opts?.heartbeatIntervalMs])

  return state
}
