'use client'

import Link from 'next/link'

export default function ProductError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'white',
          borderRadius: 24,
          border: '1px solid #e2e8f0',
          boxShadow: '0 20px 60px rgba(15, 23, 42, 0.08)',
          padding: '28px 24px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 44, marginBottom: 12 }}>🛍️</div>
        <h1
          style={{
            margin: 0,
            fontSize: 24,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            color: '#0f172a',
          }}
        >
          Nao foi possivel abrir este produto agora
        </h1>
        <p
          style={{
            margin: '10px 0 0',
            fontSize: 14,
            lineHeight: 1.7,
            color: '#64748b',
          }}
        >
          Tentamos carregar os detalhes, mas algo saiu do esperado. Voce pode tentar novamente ou voltar para a loja.
        </p>

        <div style={{ display: 'grid', gap: 10, marginTop: 22 }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              height: 46,
              borderRadius: 999,
              border: 'none',
              background: '#0f172a',
              color: 'white',
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Tentar novamente
          </button>
          <Link
            href="/loja"
            style={{
              height: 46,
              borderRadius: 999,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
              background: '#eef2ff',
              color: '#4338ca',
              border: '1px solid #c7d2fe',
              fontSize: 14,
              fontWeight: 800,
            }}
          >
            Voltar para a loja
          </Link>
        </div>
      </div>
    </main>
  )
}
