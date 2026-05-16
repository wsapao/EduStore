import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { probeOnline, createOnlineStatusController } from '@/lib/pdv-offline/network'

// ── probeOnline ──────────────────────────────────────────────

describe('probeOnline', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('retorna true quando fetch resolve com ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    expect(await probeOnline('/api/ping')).toBe(true)
  })

  it('retorna false quando fetch resolve com !ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    expect(await probeOnline('/api/ping')).toBe(false)
  })

  it('retorna false quando fetch rejeita', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    expect(await probeOnline('/api/ping')).toBe(false)
  })

  it('aborta após 5s e retorna false', async () => {
    vi.useFakeTimers()
    // fetch nunca resolve por conta própria — só se o sinal de abort disparar.
    const fetchSpy = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
        }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    const promise = probeOnline('/api/ping')
    await vi.advanceTimersByTimeAsync(5000)
    expect(await promise).toBe(false)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    // Confirma método HEAD pra não trafegar payload.
    const init = fetchSpy.mock.calls[0][1] as RequestInit | undefined
    expect(init?.method).toBe('HEAD')

    vi.useRealTimers()
  })
})

// ── createOnlineStatusController (lógica do hook, em forma pura) ──
//
// O hook React `useOnlineStatus` é um wrapper fino sobre este controller.
// Testar a lógica diretamente evita dependência de @testing-library/react
// (que não está nas devDeps) e mantém a suite no environment `node`.

describe('createOnlineStatusController', () => {
  let listeners: Record<string, Array<() => void>>
  let navigatorOnline: boolean

  beforeEach(() => {
    listeners = {}
    navigatorOnline = true
    vi.stubGlobal('window', {
      addEventListener: (ev: string, cb: () => void) => {
        listeners[ev] = listeners[ev] ?? []
        listeners[ev].push(cb)
      },
      removeEventListener: (ev: string, cb: () => void) => {
        listeners[ev] = (listeners[ev] ?? []).filter((c) => c !== cb)
      },
    })
    vi.stubGlobal('navigator', { get onLine() { return navigatorOnline } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('estado inicial reflete navigator.onLine', () => {
    navigatorOnline = false
    const updates: Array<{ online: boolean; lastChange: Date | null }> = []
    const ctrl = createOnlineStatusController({ onChange: (s) => updates.push(s) })

    expect(ctrl.getState().online).toBe(false)
    expect(ctrl.getState().lastChange).toBeNull()
    ctrl.stop()
  })

  it('evento "offline" muda estado para false', () => {
    const updates: Array<{ online: boolean; lastChange: Date | null }> = []
    const ctrl = createOnlineStatusController({ onChange: (s) => updates.push(s) })

    expect(ctrl.getState().online).toBe(true)
    listeners.offline?.forEach((cb) => cb())

    expect(ctrl.getState().online).toBe(false)
    expect(ctrl.getState().lastChange).toBeInstanceOf(Date)
    expect(updates.at(-1)?.online).toBe(false)
    ctrl.stop()
  })

  it('evento "online" muda estado para true', () => {
    navigatorOnline = false
    const ctrl = createOnlineStatusController()
    expect(ctrl.getState().online).toBe(false)

    navigatorOnline = true
    listeners.online?.forEach((cb) => cb())
    expect(ctrl.getState().online).toBe(true)
    ctrl.stop()
  })

  it('stop() remove listeners', () => {
    const ctrl = createOnlineStatusController()
    expect(listeners.online?.length).toBe(1)
    expect(listeners.offline?.length).toBe(1)
    ctrl.stop()
    expect(listeners.online?.length).toBe(0)
    expect(listeners.offline?.length).toBe(0)
  })

  it('heartbeat: probe falha leva online a false mesmo com navigator.onLine=true', async () => {
    vi.useFakeTimers()
    const probe = vi.fn().mockResolvedValue(false)

    const ctrl = createOnlineStatusController({
      heartbeatUrl: '/api/ping',
      heartbeatIntervalMs: 1000,
      probeFn: probe,
    })
    expect(ctrl.getState().online).toBe(true)

    await vi.advanceTimersByTimeAsync(1000)
    expect(probe).toHaveBeenCalledWith('/api/ping')
    expect(ctrl.getState().online).toBe(false)

    ctrl.stop()
  })

  it('heartbeat: stop() para o interval', async () => {
    vi.useFakeTimers()
    const probe = vi.fn().mockResolvedValue(true)
    const ctrl = createOnlineStatusController({
      heartbeatUrl: '/api/ping',
      heartbeatIntervalMs: 1000,
      probeFn: probe,
    })

    await vi.advanceTimersByTimeAsync(1000)
    expect(probe).toHaveBeenCalledTimes(1)
    ctrl.stop()
    await vi.advanceTimersByTimeAsync(5000)
    expect(probe).toHaveBeenCalledTimes(1)
  })
})
