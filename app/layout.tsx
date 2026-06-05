import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'
import { CookieBanner } from '@/components/CookieBanner'
import { PostHogProvider } from '@/components/providers/PostHogProvider'
import { getDefaultEscolaBranding, resolveEscolaIconUrls } from '@/lib/escola/branding'

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' })

const escolaCor  = process.env.NEXT_PUBLIC_ESCOLA_COR  ?? '#1a2f5a'

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getDefaultEscolaBranding()
  const icons = resolveEscolaIconUrls(branding)

  return {
    title: branding.nome,
    description: `Compre eventos, passeios e materiais de ${branding.nome} com facilidade.`,
    applicationName: branding.nome,
    manifest: '/manifest.webmanifest',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: branding.nome,
    },
    icons: {
      icon: icons.icon,
      apple: icons.apple,
    },
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: escolaCor,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={`h-full ${jakarta.variable}`} style={{ scrollBehavior: 'smooth' }}>
      <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--text-1)] antialiased font-sans">
        <PostHogProvider>
          {children}
          <CookieBanner />
          <Toaster position="bottom-center" richColors theme="light" />
        </PostHogProvider>
      </body>
    </html>
  )
}
