import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
      }),
    ],
    beforeSend(event) {
      // Remove PII óbvia do contexto antes de enviar.
      if (event.user) {
        delete event.user.email
        delete event.user.ip_address
      }
      return event
    },
  })
}
