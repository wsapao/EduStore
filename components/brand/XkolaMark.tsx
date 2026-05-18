import React, { useId, type CSSProperties } from 'react'

type XkolaMarkProps = {
  theme?: 'dark' | 'light'
  width?: number
  height?: number
  style?: CSSProperties
}

export function XkolaMark({
  theme = 'light',
  width = 46,
  height = 34,
  style,
}: XkolaMarkProps) {
  const gradientSeed = useId().replace(/:/g, '')
  const markFilter =
    theme === 'dark'
      ? 'drop-shadow(0 10px 20px rgba(7,17,35,.32))'
      : 'drop-shadow(0 8px 16px rgba(255,107,26,.18))'

  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      viewBox="0 0 152 112"
      style={{
        display: 'block',
        flexShrink: 0,
        overflow: 'visible',
        filter: markFilter,
        ...style,
      }}
    >
      <defs>
        <linearGradient id={`${gradientSeed}-left`} x1="16" y1="12" x2="64" y2="72" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFA875" />
          <stop offset="1" stopColor="#FF5500" />
        </linearGradient>
        <linearGradient id={`${gradientSeed}-main`} x1="22" y1="100" x2="104" y2="10" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFC093" />
          <stop offset="0.58" stopColor="#FF6B1A" />
          <stop offset="1" stopColor="#FF8540" />
        </linearGradient>
        <linearGradient id={`${gradientSeed}-upper`} x1="102" y1="60" x2="137" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFA875" />
          <stop offset="1" stopColor="#E2510A" />
        </linearGradient>
        <linearGradient id={`${gradientSeed}-lower`} x1="92" y1="56" x2="140" y2="102" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E2510A" />
          <stop offset="1" stopColor="#FF8540" />
        </linearGradient>
        <linearGradient id={`${gradientSeed}-cross`} x1="68" y1="76" x2="96" y2="106" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF8540" />
          <stop offset="1" stopColor="#FF5500" />
        </linearGradient>
      </defs>
      <path
        d="M18 18L57 60"
        stroke={`url(#${gradientSeed}-left)`}
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M24 96L92 16"
        stroke={`url(#${gradientSeed}-main)`}
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M74 78L95 101"
        stroke={`url(#${gradientSeed}-cross)`}
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M101 64L133 18"
        stroke={`url(#${gradientSeed}-upper)`}
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M101 64L136 96"
        stroke={`url(#${gradientSeed}-lower)`}
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
