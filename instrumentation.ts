export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export async function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string | string[] | undefined> },
  context: { routerKind: string; routePath: string; routeType: string },
) {
  // Sentry, se configurado
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN
  if (dsn) {
    try {
      const Sentry = await import('@sentry/nextjs')
      Sentry.captureRequestError(err, request, context)
    } catch {
      // ignora
    }
  }

  // [DEBUG] Persiste erros em auditoria_log para diagnóstico via SQL.
  // Remover quando bug do /admin/produtos for resolvido.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (!url || !key) return
      const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

      const e = err as Error
      const msg = (e?.message ?? String(err)).slice(0, 500)
      const stack = (e?.stack ?? '').slice(0, 4000)

      const { data: anyEscola } = await admin.from('escolas').select('id').limit(1).maybeSingle<{ id: string }>()
      if (!anyEscola) return

      await admin.from('auditoria_log').insert({
        escola_id: anyEscola.id,
        user_id: null,
        modulo: 'runtime-error',
        acao: e?.name ?? 'Error',
        descricao: `[${request.method}] ${request.path} → ${msg}`,
        metadata: { stack, routePath: context.routePath, routeType: context.routeType },
        ip: null,
      })
    } catch {
      // ignora
    }
  }
}
