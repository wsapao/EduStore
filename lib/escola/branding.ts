import { createClient } from '@/lib/supabase/server'

export type EscolaBranding = {
  nome: string
  cor_primaria: string
  logo_url: string | null
  favicon_url: string | null
}

export type EscolaIconUrls = {
  icon: string
  apple: string
  manifest: string
}

const FALLBACK_BRANDING: EscolaBranding = {
  nome: process.env.NEXT_PUBLIC_ESCOLA_NOME ?? 'Loja Escolar',
  cor_primaria: process.env.NEXT_PUBLIC_ESCOLA_COR ?? '#1a2f5a',
  logo_url: null,
  favicon_url: null,
}

function cleanAssetUrl(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed || null
}

export function resolveEscolaIconUrls(escola: Pick<EscolaBranding, 'logo_url' | 'favicon_url'>): EscolaIconUrls {
  const logoUrl = cleanAssetUrl(escola.logo_url)
  const faviconUrl = cleanAssetUrl(escola.favicon_url)

  return {
    icon: faviconUrl ?? logoUrl ?? '/icon',
    apple: logoUrl ?? faviconUrl ?? '/apple-icon',
    manifest: logoUrl ?? faviconUrl ?? '/icon',
  }
}

export async function getDefaultEscolaBranding(): Promise<EscolaBranding> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('escolas')
      .select('nome, cor_primaria, logo_url, favicon_url')
      .limit(1)
      .maybeSingle<Partial<EscolaBranding>>()

    return {
      nome: cleanAssetUrl(data?.nome) ?? FALLBACK_BRANDING.nome,
      cor_primaria: cleanAssetUrl(data?.cor_primaria) ?? FALLBACK_BRANDING.cor_primaria,
      logo_url: cleanAssetUrl(data?.logo_url),
      favicon_url: cleanAssetUrl(data?.favicon_url),
    }
  } catch {
    return FALLBACK_BRANDING
  }
}
