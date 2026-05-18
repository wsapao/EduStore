export type AdminShellThemeName = 'legacy-dark' | 'creative-light'

export type AdminShellTheme = {
  name: AdminShellThemeName
  rootBackground: string
  shellVariables?: Record<string, string>
  sidebarBackground: string
  sidebarBorder: string
  headerBackground: string
  headerBorder: string
  logoGradient: string
  logoShadow: string
  titleColor: string
  subtitleColor: string
  sectionLabelColor: string
  navText: string
  navTextActive: string
  navIconActive: string
  navActiveBackground: string
  navIndicator: string
  navHoverClassName: string
  bottomCardBackground: string
  bottomCardBorder: string
  buttonBackground: string
  buttonText: string
  buttonHoverClassName: string
  accent: string
  accentStrong: string
}

export function resolveAdminShellThemeName(pathname: string): AdminShellThemeName {
  const normalized = pathname === '/' ? pathname : pathname.replace(/\/+$/, '')

  if (normalized === '/admin' || normalized.startsWith('/admin/')) return 'creative-light'

  return 'legacy-dark'
}

export function getAdminShellTheme(name: AdminShellThemeName): AdminShellTheme {
  if (name === 'creative-light') {
    return {
      name,
      rootBackground: 'radial-gradient(circle at top left, #fff1e7 0%, #fff8f3 45%, #fffcfa 100%)',
      shellVariables: {
        '--bg': '#fff8f3',
        '--surface': '#ffffff',
        '--surface-2': '#fff7ed',
        '--border': '#fed7aa',
        '--border-strong': '#fdba74',
        '--brand': '#f97316',
        '--brand-mid': '#ea580c',
        '--accent': '#f97316',
        '--accent-dark': '#9a3412',
        '--accent-soft': '#fff1e7',
        '--accent-glow': 'rgba(249,115,22,.28)',
        '--text-1': '#111827',
        '--text-2': '#7c2d12',
        '--text-3': '#9a3412',
        '--success': '#16a34a',
        '--success-soft': '#dcfce7',
        '--danger': '#dc2626',
        '--danger-soft': '#fef2f2',
        '--warn': '#f97316',
        '--warn-soft': '#fff7ed',
        '--shadow-xs': '0 1px 3px rgba(194,65,12,.08), 0 1px 2px rgba(194,65,12,.05)',
        '--shadow-sm': '0 10px 24px rgba(249,115,22,.08), 0 2px 6px rgba(194,65,12,.05)',
        '--shadow-md': '0 18px 40px rgba(249,115,22,.12), 0 6px 18px rgba(194,65,12,.08)',
        '--shadow-lg': '0 28px 64px rgba(249,115,22,.16), 0 10px 24px rgba(194,65,12,.1)',
        '--shadow-card': '0 10px 26px rgba(249,115,22,.08)',
        '--shadow-card-active': '0 0 0 3px rgba(249,115,22,.14), 0 12px 28px rgba(249,115,22,.12)',
        '--shadow-amber': '0 8px 22px rgba(249,115,22,.28)',
      },
      sidebarBackground: 'rgba(255, 247, 237, 0.88)',
      sidebarBorder: 'rgba(249, 115, 22, 0.16)',
      headerBackground: 'rgba(255, 248, 243, 0.92)',
      headerBorder: 'rgba(249, 115, 22, 0.12)',
      logoGradient: 'linear-gradient(135deg, #f97316, #ec4899)',
      logoShadow: '0 8px 18px rgba(249,115,22,.22)',
      titleColor: '#1f2937',
      subtitleColor: '#c2410c',
      sectionLabelColor: 'rgba(154, 52, 18, 0.7)',
      navText: '#7c2d12',
      navTextActive: '#c2410c',
      navIconActive: '#f97316',
      navActiveBackground: '#ffffff',
      navIndicator: '#f97316',
      navHoverClassName: 'hover:translate-x-1',
      bottomCardBackground: 'rgba(255,255,255,.82)',
      bottomCardBorder: '1px solid rgba(249,115,22,.12)',
      buttonBackground: 'rgba(255,255,255,.82)',
      buttonText: '#9a3412',
      buttonHoverClassName: '',
      accent: '#f97316',
      accentStrong: '#ea580c',
    }
  }

  return {
    name,
    rootBackground: 'radial-gradient(ellipse at 30% 20%, #1e3a5f 0%, #0a1628 60%)',
    sidebarBackground: 'rgba(10, 22, 40, 0.4)',
    sidebarBorder: 'rgba(255,255,255,0.05)',
    headerBackground: 'rgba(10, 22, 40, 0.85)',
    headerBorder: 'rgba(255,255,255,0.05)',
    logoGradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    logoShadow: '0 4px 12px rgba(245,158,11,.3)',
    titleColor: '#f8fafc',
    subtitleColor: '#f59e0b',
    sectionLabelColor: 'rgba(255,255,255,.3)',
    navText: '#cbd5e1',
    navTextActive: '#ffffff',
    navIconActive: '#f59e0b',
    navActiveBackground: 'rgba(255,255,255,0.08)',
    navIndicator: '#f59e0b',
    navHoverClassName: 'hover:bg-white/5 hover:text-white hover:translate-x-1',
    bottomCardBackground: 'rgba(0,0,0,0.2)',
    bottomCardBorder: '1px solid rgba(255,255,255,0.05)',
    buttonBackground: 'rgba(255,255,255,0.05)',
    buttonText: '#94a3b8',
    buttonHoverClassName: 'hover:bg-red-500/20 hover:text-red-400',
    accent: '#f59e0b',
    accentStrong: '#d97706',
  }
}
