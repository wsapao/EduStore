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
    // EXPERIMENTO: paleta do kit Apple iOS/iPadOS 26 (Liquid Glass).
    // Sidebar segue os tokens Miscellaneous/Sidebar do kit:
    // Fill-Selected = branco, Text-Selected = systemBlue #0088ff.
    return {
      name,
      rootBackground: 'radial-gradient(circle at top left, #eef4fb 0%, #f2f2f7 45%, #fbfbfd 100%)',
      shellVariables: {
        '--bg': '#f2f2f7',
        '--surface': '#ffffff',
        '--surface-2': '#f2f2f7',
        '--border': '#e5e5ea',
        '--border-strong': '#d1d1d6',
        '--brand': '#f97316',
        '--brand-mid': '#ea580c',
        '--accent': '#f97316',
        '--accent-dark': '#c2410c',
        '--accent-soft': '#fff3e9',
        '--accent-glow': 'rgba(249,115,22,.28)',
        '--text-1': '#000000',
        '--text-2': '#3c3c43',
        '--text-3': '#8e8e93',
        '--success': '#34c759',
        '--success-soft': '#e7f9ed',
        '--danger': '#ff383c',
        '--danger-soft': '#ffefee',
        '--warn': '#ff8d28',
        '--warn-soft': '#fff3e8',
        '--shadow-xs': '0 1px 3px rgba(60,60,67,.07), 0 1px 2px rgba(60,60,67,.04)',
        '--shadow-sm': '0 10px 24px rgba(60,60,67,.07), 0 2px 6px rgba(60,60,67,.04)',
        '--shadow-md': '0 18px 40px rgba(60,60,67,.1), 0 6px 18px rgba(60,60,67,.06)',
        '--shadow-lg': '0 28px 64px rgba(60,60,67,.13), 0 10px 24px rgba(60,60,67,.08)',
        '--shadow-card': '0 10px 26px rgba(60,60,67,.07)',
        '--shadow-card-active': '0 0 0 3px rgba(249,115,22,.14), 0 12px 28px rgba(249,115,22,.1)',
        '--shadow-amber': '0 8px 22px rgba(249,115,22,.28)',
      },
      sidebarBackground: 'rgba(242, 242, 247, 0.85)',
      sidebarBorder: 'rgba(60, 60, 67, 0.12)',
      headerBackground: 'rgba(255, 255, 255, 0.8)',
      headerBorder: 'rgba(60, 60, 67, 0.1)',
      logoGradient: 'linear-gradient(135deg, #fb923c, #f97316)',
      logoShadow: '0 8px 18px rgba(249,115,22,.25)',
      titleColor: '#000000',
      subtitleColor: '#c2410c',
      sectionLabelColor: 'rgba(60, 60, 67, 0.6)',
      navText: '#3c3c43',
      navTextActive: '#f97316',
      navIconActive: '#f97316',
      navActiveBackground: '#ffffff',
      navIndicator: '#f97316',
      navHoverClassName: 'hover:translate-x-1',
      bottomCardBackground: 'rgba(255,255,255,.82)',
      bottomCardBorder: '1px solid rgba(60,60,67,.12)',
      buttonBackground: 'rgba(255,255,255,.82)',
      buttonText: '#3c3c43',
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
