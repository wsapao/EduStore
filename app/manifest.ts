import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  const escolaNome = process.env.NEXT_PUBLIC_ESCOLA_NOME ?? 'Loja Escolar'
  const escolaCor  = process.env.NEXT_PUBLIC_ESCOLA_COR  ?? '#1a2f5a'

  return {
    name: escolaNome,
    short_name: escolaNome.split(' ')[0], // Ex: "Colégio" ou "Loja"
    description: `Compre eventos, passeios e materiais de ${escolaNome} com facilidade.`,
    start_url: '/loja',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f5f6fa',
    theme_color: escolaCor,
    categories: ['education', 'shopping', 'productivity'],
    lang: 'pt-BR',
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}
