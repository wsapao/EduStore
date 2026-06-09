import { createClient } from '@/lib/supabase/server'

export type EscolaBranding = {
  nome: string
  cor_primaria: string
  logo_url: string | null
  favicon_url: string | null
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

/**
 * Imagem-fonte para gerar o icone (favicon/apple/manifest) da escola.
 * Prioriza a logo; cai para um favicon dedicado; null quando nada foi enviado
 * (nesse caso o /icon renderiza a arte padrao da loja).
 */
export function pickEscolaIconImage(
  escola: Pick<EscolaBranding, 'logo_url' | 'favicon_url'>,
): string | null {
  return cleanAssetUrl(escola.logo_url) ?? cleanAssetUrl(escola.favicon_url)
}

/**
 * Token curto e estavel derivado da imagem do icone. Usado como `?v=` nos
 * links de icone para forcar o navegador a rebuscar o favicon quando a escola
 * troca a logo (o cache de favicon e teimoso e ignora reloads normais).
 */
export function escolaIconVersion(
  escola: Pick<EscolaBranding, 'logo_url' | 'favicon_url'>,
): string {
  const basis = pickEscolaIconImage(escola) ?? 'fallback'
  let hash = 0
  for (let i = 0; i < basis.length; i++) {
    hash = (hash * 31 + basis.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(36)
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
