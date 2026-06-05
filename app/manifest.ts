import type { MetadataRoute } from 'next'
import { getDefaultEscolaBranding, resolveEscolaIconUrls } from '@/lib/escola/branding'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const branding = await getDefaultEscolaBranding()
  const icons = resolveEscolaIconUrls(branding)
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
        src: icons.manifest,
        sizes: '512x512',
        purpose: 'any',
      },
      {
        src: icons.manifest,
        sizes: '512x512',
        purpose: 'maskable',
      },
      {
        src: icons.apple,
        sizes: '180x180',
      },
    ],
  }
}
