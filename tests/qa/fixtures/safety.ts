// tests/qa/fixtures/safety.ts
// Trava de segurança: o QA exploratório NUNCA pode rodar contra produção.

export interface SafetyEnv {
  baseURL: string | undefined
  asaasEnv: string | undefined
}

export class UnsafeTargetError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsafeTargetError'
  }
}

export function assertSafeTarget({ baseURL, asaasEnv }: SafetyEnv): URL {
  if (!baseURL) {
    throw new UnsafeTargetError(
      'QA_BASE_URL não definida — recusando rodar sem um alvo de staging explícito.',
    )
  }
  let url: URL
  try {
    url = new URL(baseURL)
  } catch {
    throw new UnsafeTargetError(`QA_BASE_URL inválida: ${baseURL}`)
  }

  const host = url.hostname.toLowerCase()
  const customHost = (process.env.QA_STAGING_HOST ?? '').trim().toLowerCase()
  const hostOk = host.endsWith('.vercel.app') || (customHost !== '' && host === customHost)
  if (!hostOk) {
    throw new UnsafeTargetError(
      `Host não permitido para QA: ${host}. Use um preview .vercel.app de staging ` +
        `ou defina QA_STAGING_HOST com o domínio de staging.`,
    )
  }

  if (asaasEnv === 'production') {
    throw new UnsafeTargetError(
      'ASAAS_ENVIRONMENT=production — recusando rodar QA com gateway de pagamento de produção.',
    )
  }

  return url
}
