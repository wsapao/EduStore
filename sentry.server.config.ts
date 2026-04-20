import * as Sentry from '@sentry/nextjs'

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    beforeSend(event) {
      // Remove PII óbvia antes de enviar.
      if (event.user) {
        delete event.user.email
        delete event.user.ip_address
      }
      // Remove headers sensíveis
      if (event.request?.headers) {
        delete (event.request.headers as Record<string, string>).cookie
        delete (event.request.headers as Record<string, string>).authorization
      }
      return event
    },
  })
}
