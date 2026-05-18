export const LOJA_BRAND_NAME = 'Xkola Store'

export function getLojaBrandSubtitle(escolaNome?: string | null) {
  const normalizedName = escolaNome?.trim()

  if (!normalizedName) {
    return 'Loja virtual oficial'
  }

  return normalizedName
}
