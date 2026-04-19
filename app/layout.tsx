import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

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
    <html lang="pt-BR" className={`h-full ${inter.variable}`}>
      <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--text-1)] antialiased font-sans">
        {children}
      </body>
    </html>
  )
}
