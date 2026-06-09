import type { CSSProperties } from 'react'

import { getAdminButtonStyle } from '@/lib/admin-ui-tones'

type EditarResponsavelDialogThemeArgs = {
  pending: boolean
}

type EditarResponsavelDialogTheme = {
  triggerButton: CSSProperties
  overlay: CSSProperties
  panel: CSSProperties
  header: CSSProperties
  eyebrow: CSSProperties
  title: CSSProperties
  description: CSSProperties
  field: CSSProperties
  fieldLabel: CSSProperties
  input: CSSProperties
  readonlyInput: CSSProperties
  footer: CSSProperties
  secondaryButton: CSSProperties
  primaryButton: CSSProperties
}

const baseInputStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  minHeight: 46,
  padding: '10px 12px',
  fontSize: 14,
  fontWeight: 500,
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text-1)',
  boxSizing: 'border-box',
  outline: 'none',
}

export function getEditarResponsavelDialogTheme({
  pending,
}: EditarResponsavelDialogThemeArgs): EditarResponsavelDialogTheme {
  const triggerButton = getAdminButtonStyle('neutral', 'soft', {
    height: 40,
    padding: '0 16px',
    borderRadius: 12,
    fontSize: 12,
  })

  const secondaryButton = getAdminButtonStyle('neutral', 'soft', {
    height: 44,
    padding: '0 18px',
    borderRadius: 12,
    fontSize: 13,
  })

  const primaryButtonBase = getAdminButtonStyle('accent', 'solid', {
    height: 44,
    padding: '0 18px',
    borderRadius: 12,
    fontSize: 13,
  })

  return {
    triggerButton,
    overlay: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(17,24,39,.42)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 120,
      padding: 16,
    },
    panel: {
      width: '100%',
      maxWidth: 460,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      padding: 24,
      borderRadius: 24,
      border: '1px solid var(--border)',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,247,237,0.96) 100%)',
      boxShadow: 'var(--shadow-lg)',
    },
    header: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    },
    eyebrow: {
      alignSelf: 'flex-start',
      padding: '6px 12px',
      borderRadius: 999,
      border: '1px solid rgba(249,115,22,.18)',
      background: 'rgba(255,255,255,.88)',
      color: 'var(--text-3)',
      fontSize: 11,
      fontWeight: 800,
      letterSpacing: '.08em',
      textTransform: 'uppercase',
    },
    title: {
      margin: 0,
      fontSize: 24,
      fontWeight: 900,
      color: 'var(--text-1)',
      letterSpacing: '-.03em',
    },
    description: {
      margin: '6px 0 0',
      fontSize: 13,
      lineHeight: 1.5,
      fontWeight: 500,
      color: 'var(--text-3)',
    },
    field: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    },
    fieldLabel: {
      fontSize: 11,
      fontWeight: 800,
      color: 'var(--text-3)',
      letterSpacing: '.06em',
      textTransform: 'uppercase',
    },
    input: baseInputStyle,
    readonlyInput: {
      ...baseInputStyle,
      background: 'var(--surface-2)',
      color: 'var(--text-3)',
      opacity: 1,
      WebkitTextFillColor: 'var(--text-3)',
    },
    footer: {
      display: 'flex',
      gap: 10,
      justifyContent: 'flex-end',
      marginTop: 4,
      flexWrap: 'wrap',
    },
    secondaryButton,
    primaryButton: {
      ...primaryButtonBase,
      background: pending ? 'var(--border-strong)' : primaryButtonBase.background,
      boxShadow: pending ? 'none' : 'var(--shadow-amber)',
      cursor: pending ? 'wait' : 'pointer',
    },
  }
}
