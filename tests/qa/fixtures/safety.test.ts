import { describe, it, expect, afterEach } from 'vitest'
import { assertSafeTarget, UnsafeTargetError } from './safety'

describe('assertSafeTarget', () => {
  afterEach(() => { delete process.env.QA_STAGING_HOST })

  it('aceita preview .vercel.app com asaas sandbox', () => {
    const url = assertSafeTarget({ baseURL: 'https://edu-store-abc.vercel.app', asaasEnv: 'sandbox' })
    expect(url.hostname).toBe('edu-store-abc.vercel.app')
  })

  it('recusa quando asaas é production', () => {
    expect(() => assertSafeTarget({ baseURL: 'https://edu-store-abc.vercel.app', asaasEnv: 'production' }))
      .toThrow(UnsafeTargetError)
  })

  it('recusa host que não é de staging', () => {
    expect(() => assertSafeTarget({ baseURL: 'https://www.xkola.com.br', asaasEnv: 'sandbox' }))
      .toThrow(UnsafeTargetError)
  })

  it('recusa baseURL ausente', () => {
    expect(() => assertSafeTarget({ baseURL: undefined, asaasEnv: 'sandbox' }))
      .toThrow(/QA_BASE_URL/)
  })

  it('aceita host custom via QA_STAGING_HOST', () => {
    process.env.QA_STAGING_HOST = 'staging.xkola.com.br'
    const url = assertSafeTarget({ baseURL: 'https://staging.xkola.com.br', asaasEnv: 'sandbox' })
    expect(url.hostname).toBe('staging.xkola.com.br')
  })
})
