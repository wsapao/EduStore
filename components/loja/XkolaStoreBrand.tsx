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
  const markWidth = compact ? 38 : 46
  const markHeight = compact ? 28 : 34
  const titleColor = isDark ? '#ffffff' : 'var(--text-1)'
  const subtitleColor = isDark ? 'rgba(255,255,255,.58)' : 'var(--text-3)'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 8 : 10 }}>
      <XkolaMark theme={theme} width={markWidth} height={markHeight} />

      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, minWidth: 0 }}>
        <div style={{ fontSize: compact ? 14 : 15, fontWeight: 900, color: titleColor, letterSpacing: '-.03em' }}>
          {LOJA_BRAND_NAME}
        </div>
        <div
          style={{
            fontSize: compact ? 10 : 11,
            fontWeight: 700,
            color: subtitleColor,
            letterSpacing: compact ? '.02em' : '.03em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: compact ? 160 : 190,
            marginTop: 2,
          }}
        >
          {getLojaBrandSubtitle(escolaNome)}
        </div>
      </div>
    </div>
  )
}
