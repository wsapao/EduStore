import { describe, it, expect, afterEach } from 'vitest'
import { qaTag, cleanupQAData } from './cleanup'

describe('cleanup', () => {
  afterEach(() => {
    delete process.env.QA_ALLOW_CLEANUP
  })

  it('qaTag aplica o prefixo QA- com timestamp', () => {
    expect(qaTag('aluno')).toMatch(/^QA-aluno-\d+$/)
  })

  it('cleanupQAData é no-op sem QA_ALLOW_CLEANUP=1 (não toca o banco)', async () => {
    // Sem opt-in e sem env de Supabase: deve retornar cedo, sem lançar nem chamar o client.
    delete process.env.QA_ALLOW_CLEANUP
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    await expect(cleanupQAData()).resolves.toBeUndefined()
  })
})
