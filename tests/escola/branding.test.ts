import { describe, expect, it } from 'vitest'

import { pickEscolaIconImage, escolaIconVersion } from '@/lib/escola/branding'

describe('pickEscolaIconImage', () => {
  it('usa a logo da escola quando disponivel', () => {
    expect(
      pickEscolaIconImage({
        logo_url: 'https://cdn.escola/logo.png',
        favicon_url: 'https://cdn.escola/favicon.png',
      }),
    ).toBe('https://cdn.escola/logo.png')
  })

  it('cai para o favicon dedicado quando nao ha logo', () => {
    expect(
      pickEscolaIconImage({
        logo_url: null,
        favicon_url: 'https://cdn.escola/favicon.png',
      }),
    ).toBe('https://cdn.escola/favicon.png')
  })

  it('retorna null quando nao ha nenhuma midia', () => {
    expect(pickEscolaIconImage({ logo_url: null, favicon_url: null })).toBeNull()
  })

  it('ignora strings em branco', () => {
    expect(
      pickEscolaIconImage({ logo_url: '   ', favicon_url: '\n' }),
    ).toBeNull()
  })
})

describe('escolaIconVersion', () => {
  it('e estavel para a mesma imagem', () => {
    const a = escolaIconVersion({ logo_url: 'https://cdn.escola/logo.png', favicon_url: null })
    const b = escolaIconVersion({ logo_url: 'https://cdn.escola/logo.png', favicon_url: null })
    expect(a).toBe(b)
  })

  it('muda quando a imagem muda (cache-busting)', () => {
    const v1 = escolaIconVersion({ logo_url: 'https://cdn.escola/logo-1.png', favicon_url: null })
    const v2 = escolaIconVersion({ logo_url: 'https://cdn.escola/logo-2.png', favicon_url: null })
    expect(v1).not.toBe(v2)
  })

  it('produz um token nao vazio mesmo sem midia', () => {
    expect(escolaIconVersion({ logo_url: null, favicon_url: null })).toMatch(/.+/)
  })
})
