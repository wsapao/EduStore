import { describe, expect, it } from 'vitest'

import { getAdminButtonStyle } from '@/lib/admin-ui-tones'
import { getEditarResponsavelDialogTheme } from '@/app/(admin)/admin/responsaveis/editarResponsavelDialogTheme'

describe('getEditarResponsavelDialogTheme', () => {
  it('alinha o modal com as superfícies e CTAs do admin energia laranja', () => {
    const theme = getEditarResponsavelDialogTheme({ pending: false })

    expect(theme.panel.background).toContain('255,247,237')
    expect(theme.panel.border).toBe('1px solid var(--border)')
    expect(theme.input.background).toBe('var(--surface)')
    expect(theme.readonlyInput.background).toBe('var(--surface-2)')
    expect(theme.secondaryButton).toMatchObject(
      getAdminButtonStyle('neutral', 'soft', {
        height: 44,
        padding: '0 18px',
        borderRadius: 12,
        fontSize: 13,
      }),
    )
    expect(theme.primaryButton).toMatchObject(
      getAdminButtonStyle('accent', 'solid', {
        height: 44,
        padding: '0 18px',
        borderRadius: 12,
        fontSize: 13,
      }),
    )
  })

  it('suaviza o CTA primário enquanto a gravação está pendente', () => {
    const theme = getEditarResponsavelDialogTheme({ pending: true })

    expect(theme.primaryButton.background).toBe('var(--border-strong)')
    expect(theme.primaryButton.cursor).toBe('wait')
  })
})
