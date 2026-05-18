import { describe, expect, it } from 'vitest'

import * as escolaTheme from '@/lib/escola/getEscola'

describe('resolveAdminShellThemeName', () => {
  it('expõe o resolvedor de tema do shell admin', () => {
    expect(typeof (escolaTheme as Record<string, unknown>).resolveAdminShellThemeName).toBe('function')
  })

  it('usa o laranja claro no dashboard raiz do admin', () => {
    const resolveAdminShellThemeName = (escolaTheme as Record<string, (path: string) => string | undefined>).resolveAdminShellThemeName
    expect(resolveAdminShellThemeName?.('/admin')).toBe('creative-light')
    expect(resolveAdminShellThemeName?.('/admin/')).toBe('creative-light')
  })

  it('aplica o tema claro nas rotas de responsaveis e alunos do admin', () => {
    const resolveAdminShellThemeName = (escolaTheme as Record<string, (path: string) => string | undefined>).resolveAdminShellThemeName
    expect(resolveAdminShellThemeName?.('/admin/responsaveis')).toBe('creative-light')
    expect(resolveAdminShellThemeName?.('/admin/responsaveis/export')).toBe('creative-light')
    expect(resolveAdminShellThemeName?.('/admin/alunos')).toBe('creative-light')
    expect(resolveAdminShellThemeName?.('/admin/alunos/123')).toBe('creative-light')
  })

  it('expande o tema claro para os demais módulos do admin da escola', () => {
    const resolveAdminShellThemeName = (escolaTheme as Record<string, (path: string) => string | undefined>).resolveAdminShellThemeName
    expect(resolveAdminShellThemeName?.('/admin/pedidos')).toBe('creative-light')
    expect(resolveAdminShellThemeName?.('/admin/produtos/novo')).toBe('creative-light')
    expect(resolveAdminShellThemeName?.('/admin/checkin')).toBe('creative-light')
    expect(resolveAdminShellThemeName?.('/admin/configuracoes/usuarios')).toBe('creative-light')
  })
})

describe('getAdminShellTheme', () => {
  it('expõe tokens do tema claro com acento laranja energia criativa', () => {
    const getAdminShellTheme = (escolaTheme as Record<string, (name: string) => Record<string, string> | undefined>).getAdminShellTheme
    const theme = getAdminShellTheme?.('creative-light')

    expect(theme?.rootBackground).toContain('#fff')
    expect(theme?.accent).toBe('#f97316')
    expect(theme?.logoGradient).toContain('#ec4899')
  })
})
