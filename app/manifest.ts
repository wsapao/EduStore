import type { MetadataRoute } from 'next'
import { getDefaultEscolaBranding, escolaIconVersion } from '@/lib/escola/branding'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const branding = await getDefaultEscolaBranding()
  const v = escolaIconVersion(branding)
  const shortName = branding.nome.split(' ')[0] || 'Loja'

  return {
    name: branding.nome,
    short_name: shortName,
    description: `Compre eventos, passeios e materiais de ${branding.nome} com facilidade.`,
    start_url: '/loja',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f5f6fa',
    theme_color: branding.cor_primaria,
    categories: ['education', 'shopping', 'productivity'],
    lang: 'pt-BR',
    icons: [
      {
        src: `/icon?v=${v}`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `/icon?v=${v}`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: `/apple-icon?v=${v}`,
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}
