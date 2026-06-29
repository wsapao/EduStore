import React, { type CSSProperties } from 'react'

type XkolaMarkProps = {
  theme?: 'dark' | 'light'
  /** Lado do icone quadrado (px). */
  size?: number
  style?: CSSProperties
}

/**
 * Marca "XK" da Xkola na cor laranja do produto Loja, com o mesmo desenho e
 * acabamento usado no XKola CRM (`/xkola-mark.png`). Mantida como PNG quadrado
 * para ficar pixel-fiel ao CRM.
 */
export function XkolaMark({ theme = 'light', size = 34, style }: XkolaMarkProps) {
  const markFilter =
    theme === 'dark'
      ? 'drop-shadow(0 10px 20px rgba(7,17,35,.32))'
      : 'drop-shadow(0 8px 16px rgba(255,107,26,.18))'

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/xkola-mark.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      style={{
        display: 'block',
        flexShrink: 0,
        width: size,
        height: size,
        objectFit: 'contain',
        filter: markFilter,
        ...style,
      }}
    />
  )
}
