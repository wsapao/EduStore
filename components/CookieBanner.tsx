'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'cookie-consent-v1'

type Consent = 'accepted' | 'essential-only'

export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Consent | null
      if (!stored) setVisible(true)
    } catch {
      // localStorage indisponível — não mostra banner
    }
  }, [])

  function decide(consent: Consent) {
    try {
      localStorage.setItem(STORAGE_KEY, consent)
      localStorage.setItem(`${STORAGE_KEY}-at`, new Date().toISOString())
    } catch {
      /* ignore */
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Consentimento de cookies"
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 9999,
        maxWidth: 640,
        margin: '0 auto',
        background: 'rgba(255,255,255,0.98)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1.5px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--shadow-lg)',
        padding: 18,
        animation: 'fade-up .4s var(--ease) both',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div
          aria-hidden="true"
          style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--r-sm)',
            background: 'var(--brand-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: 20,
          }}
        >
          🍪
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: 'var(--text-1)',
              letterSpacing: '-0.01em',
              marginBottom: 4,
            }}
          >
            Usamos cookies para o funcionamento da loja
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-2)' }}>
            Cookies essenciais garantem login e carrinho. Cookies analíticos nos ajudam a
            melhorar sua experiência. Veja nossa{' '}
            <Link
              href="/privacidade"
              style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline' }}
            >
              Política de Privacidade
            </Link>
            .
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => decide('essential-only')}
          style={{
            flex: '1 1 160px',
            height: 42,
            padding: '0 14px',
            background: 'var(--surface-2)',
            color: 'var(--text-1)',
            border: '1.5px solid var(--border)',
            borderRadius: 'var(--r-md)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Apenas essenciais
        </button>
        <button
          type="button"
          onClick={() => decide('accepted')}
          style={{
            flex: '1 1 160px',
            height: 42,
            padding: '0 14px',
            background: 'var(--brand)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--r-md)',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(26,47,90,.25)',
          }}
        >
          Aceitar todos
        </button>
      </div>
    </div>
  )
}
