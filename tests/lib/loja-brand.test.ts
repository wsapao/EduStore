import { describe, expect, it } from 'vitest'

import { getLojaBrandSubtitle, LOJA_BRAND_NAME } from '@/lib/loja/brand'

describe('loja brand', () => {
  it('expõe o nome oficial da loja virtual', () => {
    expect(LOJA_BRAND_NAME).toBe('Xkola Store')
  })

  it('usa o nome da escola como subtitulo quando disponivel', () => {
    expect(getLojaBrandSubtitle('Colégio Inovação')).toBe('Colégio Inovação')
  })

  it('usa um fallback quando a escola nao estiver informada', () => {
    expect(getLojaBrandSubtitle('')).toBe('Loja virtual oficial')
    expect(getLojaBrandSubtitle(null)).toBe('Loja virtual oficial')
  })
})
