import { notFound } from 'next/navigation'

import { PreviewTemaClient } from './PreviewTemaClient'

// Rota dev-only para visualizar o tema da vitrine com dados mockados,
// sem exigir login nem tocar em dados reais. Fora de desenvolvimento, 404.
export default function PreviewTemaPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <PreviewTemaClient />
}
