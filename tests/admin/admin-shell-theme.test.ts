import { describe, expect, it } from 'vitest'

import { getAdminShellTheme, resolveAdminShellThemeName } from '@/lib/escola/getEscola'

describe('resolveAdminShellThemeName', () => {
  it('expõe o resolvedor de tema do shell admin', () => {
    expect(typeof resolveAdminShellThemeName).toBe('function')
  })

  it('usa o laranja claro no dashboard raiz do admin', () => {
    expect(resolveAdminShellThemeName('/admin')).toBe('creative-light')
    expect(resolveAdminShellThemeName('/admin/')).toBe('creative-light')
  })

  it('aplica o tema claro nas rotas de responsaveis e alunos do admin', () => {
    expect(resolveAdminShellThemeName('/admin/responsaveis')).toBe('creative-light')
    expect(resolveAdminShellThemeName('/admin/responsaveis/export')).toBe('creative-light')
    expect(resolveAdminShellThemeName('/admin/alunos')).toBe('creative-light')
    expect(resolveAdminShellThemeName('/admin/alunos/123')).toBe('creative-light')
  })

  it('expande o tema claro para os demais módulos do admin da escola', () => {
    expect(resolveAdminShellThemeName('/admin/pedidos')).toBe('creative-light')
    expect(resolveAdminShellThemeName('/admin/produtos/novo')).toBe('creative-light')
    expect(resolveAdminShellThemeName('/admin/checkin')).toBe('creative-light')
    expect(resolveAdminShellThemeName('/admin/configuracoes/usuarios')).toBe('creative-light')
  })
})

describe('getAdminShellTheme', () => {
  it('expõe tokens do tema claro com acento laranja energia criativa', () => {
    const theme = getAdminShellTheme('creative-light')

    expect(theme.rootBackground).toContain('#fff')
    expect(theme.accent).toBe('#f97316')
    expect(theme.logoGradient).toContain('#ec4899')
  })
})
