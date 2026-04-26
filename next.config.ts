import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  // Remove o header "X-Powered-By: Next.js" (reduz superfície de fingerprint).
  poweredByHeader: false,
  devIndicators: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
    ],
  },
}

// Só aplica Sentry quando houver DSN — evita warnings em dev sem SENTRY configurado.
const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

export default dsn
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
      widenClientFileUpload: true,
      tunnelRoute: '/monitoring',
      sourcemaps: { disable: false },
      disableLogger: true,
      automaticVercelMonitors: false,
    })
  : nextConfig
