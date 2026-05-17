import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  registerPdvServiceWorker,
  activateWaitingServiceWorker,
} from '@/lib/pdv-offline/sw-register'

/**
 * Estes testes cobrem o helper de registro do SW. O `sw.js` em si NÃO é
 * testado aqui: ele roda no escopo de worker (sem DOM), e validar requer
 * mock pesado de `self`, `caches`, `clients`, etc. — o ganho não justifica.
 * Validação do SW propriamente dito vai no smoke test em browser real.
 */

// Helpers ──────────────────────────────────────────────────────

interface FakeSw {
  state: ServiceWorkerState
  postMessage: ReturnType<typeof vi.fn>
  listeners: Record<string, Array<() => void>>
  addEventListener: (ev: string, cb: () => void) => void
  setState: (s: ServiceWorkerState) => void
}

function makeFakeSw(initialState: ServiceWorkerState = 'installing'): FakeSw {
  const fake: FakeSw = {
    state: initialState,
    postMessage: vi.fn(),
    listeners: {},
    addEventListener(ev, cb) {
      fake.listeners[ev] = fake.listeners[ev] ?? []
      fake.listeners[ev].push(cb)
    },
    setState(s) {
      fake.state = s
      ;(fake.listeners.statechange ?? []).forEach((cb) => cb())
    },
  }
  return fake
}

interface FakeRegistration {
  installing: FakeSw | null
  waiting: FakeSw | null
  active: FakeSw | null
  listeners: Record<string, Array<() => void>>
  addEventListener: (ev: string, cb: () => void) => void
  triggerUpdateFound: () => void
}

function makeFakeRegistration(opts: {
  installing?: FakeSw | null
  waiting?: FakeSw | null
  active?: FakeSw | null
} = {}): FakeRegistration {
  const reg: FakeRegistration = {
    installing: opts.installing ?? null,
    waiting: opts.waiting ?? null,
    active: opts.active ?? null,
    listeners: {},
    addEventListener(ev, cb) {
      reg.listeners[ev] = reg.listeners[ev] ?? []
      reg.listeners[ev].push(cb)
    },
    triggerUpdateFound() {
      ;(reg.listeners.updatefound ?? []).forEach((cb) => cb())
    },
  }
  return reg
}

const ORIGINAL_NODE_ENV = process.env.NODE_ENV

function setNodeEnv(value: string | undefined) {
  // NODE_ENV é readonly no tipo, mas mutável em runtime — cast pra escrever.
  ;(process.env as Record<string, string | undefined>).NODE_ENV = value
}

// ── registerPdvServiceWorker ─────────────────────────────────

describe('registerPdvServiceWorker', () => {
  beforeEach(() => {
    setNodeEnv('production')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    setNodeEnv(ORIGINAL_NODE_ENV)
  })

  it('retorna null se window é undefined (SSR)', async () => {
    vi.stubGlobal('window', undefined)
    const result = await registerPdvServiceWorker()
    expect(result).toBeNull()
  })

  it('retorna null se navigator.serviceWorker é undefined', async () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('navigator', {})
    const result = await registerPdvServiceWorker()
    expect(result).toBeNull()
  })

  it('retorna null em desenvolvimento sem registrar nada', async () => {
    setNodeEnv('development')
    const registerSpy = vi.fn()
    vi.stubGlobal('window', {})
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register: registerSpy,
        ready: Promise.resolve(makeFakeRegistration()),
      },
    })

    const result = await registerPdvServiceWorker()
    expect(result).toBeNull()
    expect(registerSpy).not.toHaveBeenCalled()
  })

  it('chama register("/sw.js", { scope: "/" }) quando suporte presente', async () => {
    const reg = makeFakeRegistration()
    const registerSpy = vi.fn().mockResolvedValue(reg)
    vi.stubGlobal('window', {})
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register: registerSpy,
        ready: Promise.resolve(reg),
        controller: null,
      },
    })

    const result = await registerPdvServiceWorker()
    expect(registerSpy).toHaveBeenCalledWith('/sw.js', { scope: '/' })
    expect(result).toBe(reg)
  })

  it('chama onReady quando navigator.serviceWorker.ready resolve', async () => {
    const reg = makeFakeRegistration()
    const onReady = vi.fn()
    vi.stubGlobal('window', {})
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register: vi.fn().mockResolvedValue(reg),
        ready: Promise.resolve(reg),
        controller: null,
      },
    })

    await registerPdvServiceWorker({ onReady })
    // ready é resolvido via microtask → flush
    await Promise.resolve()
    await Promise.resolve()
    expect(onReady).toHaveBeenCalledWith(reg)
  })

  it('chama onUpdate quando registration.waiting já existe no registro', async () => {
    const waiting = makeFakeSw('installed')
    const reg = makeFakeRegistration({ waiting })
    const onUpdate = vi.fn()
    vi.stubGlobal('window', {})
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register: vi.fn().mockResolvedValue(reg),
        ready: Promise.resolve(reg),
        controller: {},
      },
    })

    await registerPdvServiceWorker({ onUpdate })
    expect(onUpdate).toHaveBeenCalledWith(reg)
  })

  it('chama onUpdate via updatefound → statechange=installed (com controller existente)', async () => {
    const reg = makeFakeRegistration()
    const onUpdate = vi.fn()
    vi.stubGlobal('window', {})
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register: vi.fn().mockResolvedValue(reg),
        ready: Promise.resolve(reg),
        controller: {}, // já tem controller → próxima instalação é update
      },
    })

    await registerPdvServiceWorker({ onUpdate })
    expect(onUpdate).not.toHaveBeenCalled()

    // Simula updatefound com um novo SW em installing.
    const installing = makeFakeSw('installing')
    reg.installing = installing
    reg.triggerUpdateFound()
    installing.setState('installed')

    expect(onUpdate).toHaveBeenCalledWith(reg)
  })

  it('NÃO chama onUpdate na primeira instalação (sem controller anterior)', async () => {
    const reg = makeFakeRegistration()
    const onUpdate = vi.fn()
    vi.stubGlobal('window', {})
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register: vi.fn().mockResolvedValue(reg),
        ready: Promise.resolve(reg),
        controller: null, // primeira instalação
      },
    })

    await registerPdvServiceWorker({ onUpdate })
    const installing = makeFakeSw('installing')
    reg.installing = installing
    reg.triggerUpdateFound()
    installing.setState('installed')

    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('retorna null e não lança se register rejeitar', async () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register: vi.fn().mockRejectedValue(new Error('boom')),
        ready: Promise.resolve(makeFakeRegistration()),
      },
    })

    const result = await registerPdvServiceWorker()
    expect(result).toBeNull()
  })
})

// ── activateWaitingServiceWorker ─────────────────────────────

describe('activateWaitingServiceWorker', () => {
  it('posta { type: "SKIP_WAITING" } no SW em waiting', async () => {
    const waiting = makeFakeSw('installed')
    const reg = makeFakeRegistration({ waiting })

    await activateWaitingServiceWorker(reg as unknown as ServiceWorkerRegistration)
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
  })

  it('no-op se não há SW em waiting', async () => {
    const reg = makeFakeRegistration({ waiting: null })
    await expect(
      activateWaitingServiceWorker(reg as unknown as ServiceWorkerRegistration),
    ).resolves.toBeUndefined()
  })
})
