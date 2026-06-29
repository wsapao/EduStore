import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans, Bricolage_Grotesque } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'
import { CookieBanner } from '@/components/CookieBanner'
import { PostHogProvider } from '@/components/providers/PostHogProvider'
import { getDefaultEscolaBranding, escolaIconVersion } from '@/lib/escola/branding'

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' })
// Tipografia da marca Xkola (mesma do XKola CRM), usada nos wordmarks.
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-bricolage' })

const escolaCor  = process.env.NEXT_PUBLIC_ESCOLA_COR  ?? '#1a2f5a'

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getDefaultEscolaBranding()
  // Aponta para as rotas internas que geram o ícone quadrado a partir da logo.
  // O `?v=` muda quando a escola troca a logo, furando o cache de favicon.
  const v = escolaIconVersion(branding)

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
      icon: `/icon?v=${v}`,
      apple: `/apple-icon?v=${v}`,
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
    <html lang="pt-BR" className={`h-full ${jakarta.variable} ${bricolage.variable}`} style={{ scrollBehavior: 'smooth' }}>
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
