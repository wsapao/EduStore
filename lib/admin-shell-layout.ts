import type { CSSProperties } from 'react'

export const ADMIN_SHELL_MAIN_CLASS_NAME = 'admin-shell-main md-sidebar-offset'
export const ADMIN_SHELL_CONTENT_CLASS_NAME = 'admin-shell-content'
export const ADMIN_MOBILE_NAV_CLASS_NAME = 'admin-mobile-nav-shell'
export const ADMIN_SIDEBAR_CLASS_NAME = 'admin-sidebar-shell'

export function getAdminShellMainStyle(): CSSProperties {
  return {
    flex: 1,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
  }
}

export function getAdminShellContentStyle(): CSSProperties {
  return {
    flex: 1,
    width: '100%',
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '24px 24px 112px',
  }
}
