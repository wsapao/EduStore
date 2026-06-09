import { describe, expect, it } from 'vitest'

import { resolveEscolaIconUrls } from '@/lib/escola/branding'

describe('resolveEscolaIconUrls', () => {
  it('usa a logo da escola como icone do navegador quando favicon dedicado nao foi configurado', () => {
    expect(
      resolveEscolaIconUrls({
        logo_url: 'https://cdn.escola/logo.png',
        favicon_url: null,
      }),
    ).toEqual({
      icon: 'https://cdn.escola/logo.png',
      apple: 'https://cdn.escola/logo.png',
      manifest: 'https://cdn.escola/logo.png',
    })
  })

  it('prioriza a logo da escola para o icone do navegador mesmo quando ha favicon antigo salvo', () => {
    expect(
      resolveEscolaIconUrls({
        logo_url: 'https://cdn.escola/logo.png',
        favicon_url: 'https://cdn.escola/favicon.png',
      }),
    ).toEqual({
      icon: 'https://cdn.escola/logo.png',
      apple: 'https://cdn.escola/logo.png',
      manifest: 'https://cdn.escola/logo.png',
    })
  })

  it('usa favicon_url apenas como fallback quando nao houver logo', () => {
    expect(
      resolveEscolaIconUrls({
        logo_url: null,
        favicon_url: 'https://cdn.escola/favicon.png',
      }),
    ).toEqual({
      icon: 'https://cdn.escola/favicon.png',
      apple: 'https://cdn.escola/favicon.png',
      manifest: 'https://cdn.escola/favicon.png',
    })
  })

  it('mantem os icones internos quando nao ha midia configurada', () => {
    expect(
      resolveEscolaIconUrls({
        logo_url: null,
        favicon_url: null,
      }),
    ).toEqual({
      icon: '/icon',
      apple: '/apple-icon',
      manifest: '/icon',
    })
  })
})
