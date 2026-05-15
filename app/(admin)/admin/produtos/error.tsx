'use client'

export default function ProdutosError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{ padding: 24, fontFamily: 'monospace', maxWidth: 900, margin: '0 auto', color: '#fef2f2' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16, color: '#ef4444' }}>
        🐛 Debug /admin/produtos
      </h1>
      <div style={{ background: 'rgba(127,29,29,.4)', border: '1px solid rgba(254,202,202,.3)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Mensagem (em prod, Next.js mascara — vamos ver o que dá):</div>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{error?.message ?? '(sem mensagem)'}</pre>
      </div>
      <div style={{ background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Digest:</div>
        <code>{error?.digest ?? '(sem digest)'}</code>
      </div>
      <div style={{ background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Stack:</div>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 11 }}>{error?.stack ?? '(sem stack)'}</pre>
      </div>
      <button onClick={reset} style={{ background: '#f59e0b', color: '#0a1628', border: 'none', padding: '10px 18px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
        Tentar novamente
      </button>
    </div>
  )
}
