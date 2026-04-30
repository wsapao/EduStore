/**
 * Rate limiting — protege endpoints críticos (login, reset de senha) contra
 * brute force e enumeração de CPF.
 *
 * Dois backends:
 *   - Upstash Redis (produção) — se UPSTASH_REDIS_REST_URL e _TOKEN estão definidos
 *   - In-memory (dev/preview)  — Map local, reiniciado a cada cold start
 *
 * Uso:
 *   import { ratelimit } from '@/lib/ratelimit'
 *   const { allowed, retryAfter } = await ratelimit.check(`login:${cpf}`, 5, 60)
 *   if (!allowed) return { error: `Muitas tentativas. Tente em ${retryAfter}s.` }
 */

type CheckResult = {
  allowed: boolean
  remaining: number
  retryAfter: number // segundos até a próxima tentativa
}

// ── Backend in-memory (dev/preview) ──────────────────────────────────────────
const memoryStore = new Map<string, { count: number; resetAt: number }>()

function memoryCheck(key: string, limit: number, windowSec: number): CheckResult {
  const now = Date.now()
  const bucket = memoryStore.get(key)

  if (!bucket || bucket.resetAt < now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowSec * 1000 })
    return { allowed: true, remaining: limit - 1, retryAfter: 0 }
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
    }
  }

  bucket.count += 1
  return {
    allowed: true,
    remaining: limit - bucket.count,
    retryAfter: 0,
  }
}

// Limpeza periódica do mapa em memória (uma vez por minuto em runtimes longos)
if (typeof globalThis !== 'undefined' && !(globalThis as Record<string, unknown>).__ratelimit_gc__) {
  const gc = () => {
    const now = Date.now()
    for (const [k, v] of memoryStore.entries()) {
      if (v.resetAt < now) memoryStore.delete(k)
    }
  }
  try {
    setInterval(gc, 60_000).unref?.()
  } catch {
    /* edge runtime: sem setInterval confiável */
  }
  ;(globalThis as Record<string, unknown>).__ratelimit_gc__ = true
}

// ── Backend Upstash (produção) ───────────────────────────────────────────────
async function upstashCheck(
  key: string,
  limit: number,
  windowSec: number,
): Promise<CheckResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 1500) // 1.5s timeout

    // INCR + EXPIRE em pipeline — primeira chamada define TTL
    const pipelineRes = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, String(windowSec), 'NX'],
        ['TTL', key],
      ]),
      cache: 'no-store',
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!pipelineRes.ok) return null

    const data = (await pipelineRes.json()) as Array<{ result: number | string }>
    const count = Number(data[0]?.result ?? 0)
    const ttl = Number(data[2]?.result ?? windowSec)

    if (count > limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.max(ttl, 1),
      }
    }

    return {
      allowed: true,
      remaining: Math.max(limit - count, 0),
      retryAfter: 0,
    }
  } catch {
    // Fail-open: se o Redis falhar, não derruba o login. Falha é logada pelo Sentry.
    return null
  }
}

// ── API pública ──────────────────────────────────────────────────────────────
export const ratelimit = {
  /**
   * Consome uma tentativa do bucket identificado por `key`.
   * @param key  identificador do bucket (ex: `login:${cpfNormalizado}`)
   * @param limit  número máximo de tentativas dentro da janela
   * @param windowSec  tamanho da janela em segundos
   */
  async check(key: string, limit: number, windowSec: number): Promise<CheckResult> {
    const up = await upstashCheck(key, limit, windowSec)
    if (up) return up
    return memoryCheck(key, limit, windowSec)
  },
}
