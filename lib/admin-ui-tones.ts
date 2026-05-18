import type { CSSProperties } from 'react'

export type AdminUiTone =
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'muted'
  | 'violet'

type ToneConfig = {
  text: string
  bg: string
  border: string
  dot: string
  solidBg: string
  solidText: string
}

const ADMIN_UI_TONES: Record<AdminUiTone, ToneConfig> = {
  accent: {
    text: '#9a3412',
    bg: '#ffedd5',
    border: '#fdba74',
    dot: '#f97316',
    solidBg: '#ea580c',
    solidText: '#ffffff',
  },
  success: {
    text: '#166534',
    bg: '#dcfce7',
    border: '#86efac',
    dot: '#16a34a',
    solidBg: '#15803d',
    solidText: '#ffffff',
  },
  warning: {
    text: '#92400e',
    bg: '#fef3c7',
    border: '#fcd34d',
    dot: '#d97706',
    solidBg: '#d97706',
    solidText: '#ffffff',
  },
  danger: {
    text: '#b91c1c',
    bg: '#fee2e2',
    border: '#fca5a5',
    dot: '#dc2626',
    solidBg: '#dc2626',
    solidText: '#ffffff',
  },
  info: {
    text: '#1d4ed8',
    bg: '#dbeafe',
    border: '#93c5fd',
    dot: '#2563eb',
    solidBg: '#2563eb',
    solidText: '#ffffff',
  },
  neutral: {
    text: '#475569',
    bg: '#f8fafc',
    border: '#cbd5e1',
    dot: '#64748b',
    solidBg: '#475569',
    solidText: '#ffffff',
  },
  muted: {
    text: '#64748b',
    bg: '#f8fafc',
    border: '#e2e8f0',
    dot: '#94a3b8',
    solidBg: '#64748b',
    solidText: '#ffffff',
  },
  violet: {
    text: '#6d28d9',
    bg: '#ede9fe',
    border: '#c4b5fd',
    dot: '#7c3aed',
    solidBg: '#7c3aed',
    solidText: '#ffffff',
  },
}

export function getAdminTone(tone: AdminUiTone) {
  return ADMIN_UI_TONES[tone]
}

export function getAdminPillStyle(
  tone: AdminUiTone,
  options: {
    fontSize?: number
    fontWeight?: number
    padding?: string
    borderRadius?: number
    gap?: number
  } = {},
): CSSProperties {
  const cfg = getAdminTone(tone)

  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: options.gap ?? 5,
    padding: options.padding ?? '3px 9px',
    borderRadius: options.borderRadius ?? 999,
    fontSize: options.fontSize ?? 11,
    fontWeight: options.fontWeight ?? 700,
    color: cfg.text,
    background: cfg.bg,
    border: `1px solid ${cfg.border}`,
  }
}

export function getAdminButtonStyle(
  tone: AdminUiTone,
  variant: 'soft' | 'solid' = 'soft',
  options: {
    width?: CSSProperties['width']
    height?: number
    padding?: string
    borderRadius?: number
    fontSize?: number
    fontWeight?: number
  } = {},
): CSSProperties {
  const cfg = getAdminTone(tone)

  return {
    width: options.width,
    height: options.height ?? 40,
    padding: options.padding ?? '0 16px',
    borderRadius: options.borderRadius ?? 12,
    fontSize: options.fontSize ?? 13,
    fontWeight: options.fontWeight ?? 800,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all .2s',
    background: variant === 'solid' ? cfg.solidBg : cfg.bg,
    color: variant === 'solid' ? cfg.solidText : cfg.text,
    border: variant === 'solid' ? 'none' : `1px solid ${cfg.border}`,
  }
}
