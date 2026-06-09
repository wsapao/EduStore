import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('favicon file convention', () => {
  it('nao mantem app/favicon.ico estatico competindo com o icone configurado da escola', () => {
    expect(existsSync(join(process.cwd(), 'app/favicon.ico'))).toBe(false)
  })
})
