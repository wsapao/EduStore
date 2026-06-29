import { XkolaMark } from '@/components/brand/XkolaMark'
import { getLojaBrandSubtitle, LOJA_BRAND_NAME } from '@/lib/loja/brand'

type XkolaStoreBrandProps = {
  escolaNome?: string | null
  theme?: 'dark' | 'light'
  compact?: boolean
}

export function XkolaStoreBrand({
  escolaNome,
  theme = 'dark',
  compact = false,
}: XkolaStoreBrandProps) {
  const isDark = theme === 'dark'
  const markSize = compact ? 32 : 38
  const titleColor = isDark ? '#ffffff' : 'var(--text-1)'
  const subtitleColor = isDark ? 'rgba(255,255,255,.58)' : 'var(--text-3)'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 8 : 10 }}>
      <XkolaMark theme={theme} size={markSize} />

      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, minWidth: 0 }}>
        <div
          style={{
            fontSize: compact ? 13 : 14,
            fontWeight: 800,
            color: titleColor,
            letterSpacing: '-.02em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: compact ? 180 : 220,
          }}
        >
          {getLojaBrandSubtitle(escolaNome) || 'Loja Escolar'}
        </div>
        <div
          style={{
            fontSize: compact ? 9 : 10,
            fontWeight: 700,
            fontFamily: 'var(--font-bricolage), "Plus Jakarta Sans", sans-serif',
            color: subtitleColor,
            letterSpacing: '.03em',
            marginTop: 2,
          }}
        >
          by {LOJA_BRAND_NAME}
        </div>
      </div>
    </div>
  )
}
