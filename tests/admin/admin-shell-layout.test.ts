import { describe, expect, it } from 'vitest'

import {
  ADMIN_MOBILE_NAV_CLASS_NAME,
  ADMIN_SHELL_CONTENT_CLASS_NAME,
  ADMIN_SHELL_MAIN_CLASS_NAME,
  ADMIN_SIDEBAR_CLASS_NAME,
  getAdminShellContentStyle,
  getAdminShellMainStyle,
} from '@/lib/admin-shell-layout'

describe('admin shell layout fallbacks', () => {
  it('expõe classes estáveis para o shell do admin', () => {
    expect(ADMIN_SHELL_MAIN_CLASS_NAME).toBe('admin-shell-main md-sidebar-offset')
    expect(ADMIN_SHELL_CONTENT_CLASS_NAME).toBe('admin-shell-content')
    expect(ADMIN_MOBILE_NAV_CLASS_NAME).toBe('admin-mobile-nav-shell')
    expect(ADMIN_SIDEBAR_CLASS_NAME).toBe('admin-sidebar-shell')
  })

  it('garante largura total e estrutura flex no container principal', () => {
    expect(getAdminShellMainStyle()).toMatchObject({
      flex: 1,
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
    })
  })

  it('mantém o conteúdo centralizado e com respiro mesmo sem utilitários CSS', () => {
    expect(getAdminShellContentStyle()).toMatchObject({
      flex: 1,
      width: '100%',
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '24px 24px 112px',
    })
  })
})
