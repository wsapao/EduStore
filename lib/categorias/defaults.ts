/**
 * Defaults compartilhados de categorias da loja.
 * Importável tanto por Server Components quanto por Client Components
 * (não tem 'use client' nem nada server-only).
 */

export const CATEGORIAS: Record<string, { label: string; icon: string }> = {
  todas: { label: 'Tudo', icon: '✦' },
  eventos: { label: 'Eventos', icon: '🎉' },
  passeios: { label: 'Passeios', icon: '🚌' },
  segunda_chamada: { label: '2ª Chamada', icon: '📝' },
  materiais: { label: 'Mat.', icon: '📚' },
  uniforme: { label: 'Uniforme', icon: '👕' },
  outros: { label: 'Outros', icon: '📦' },
}

export function getDefaultCategoryMeta(categoryKey: string): { label: string; icon: string } {
  const fallback = CATEGORIAS[categoryKey]
  if (fallback) return fallback

  return {
    label: categoryKey.replace(/_/g, ' '),
    icon: '📦',
  }
}
