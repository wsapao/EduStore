import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'
import { CookieBanner } from '@/components/CookieBanner'

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' })

const escolaNome = process.env.NEXT_PUBLIC_ESCOLA_NOME ?? 'Loja Escolar'
const escolaCor  = process.env.NEXT_PUBLIC_ESCOLA_COR  ?? '#1a2f5a'

export const metadata: Metadata = {
  title: escolaNome,
  description: `Compre eventos, passeios e materiais de ${escolaNome} com facilidade.`,
  applicationName: escolaNome,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: escolaNome,
  },
  icons: {
    icon: '/icon',
    apple: '/apple-icon',
  },
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
        {children}
        <CookieBanner />
        <Toaster position="bottom-center" richColors theme="light" />
      </body>
    </html>
  )
}
