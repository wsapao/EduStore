import Link from 'next/link'

export default function NotFound() {
  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg,#eef2ff 0%,#f8fafc 45%,#ffffff 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 720,
        background: 'rgba(255,255,255,.9)',
        border: '1.5px solid #e2e8f0',
        borderRadius: 28,
        boxShadow: '0 20px 60px rgba(15,23,42,.08)',
        overflow: 'hidden',
      }}>
        <div style={{
          background: 'linear-gradient(135deg,#1a2f5a,#5b6af8)',
          padding: '28px 28px 44px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            top: -60,
            right: -30,
            width: 180,
            height: 180,
            borderRadius: '50%',
            background: 'rgba(255,255,255,.08)',
          }} />
          <div style={{
            position: 'absolute',
            bottom: -80,
            left: -20,
            width: 220,
            height: 220,
            borderRadius: '50%',
            background: 'rgba(255,255,255,.05)',
          }} />

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            borderRadius: 999,
            background: 'rgba(255,255,255,.14)',
            color: 'rgba(255,255,255,.88)',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '.08em',
          }}>
            404 · PAGINA NAO ENCONTRADA
          </div>

          <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{
              width: 92,
              height: 92,
              borderRadius: 24,
              background: 'rgba(255,255,255,.14)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 46,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.15)',
            }}>
              🏫
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <h1 style={{
                margin: 0,
                color: '#fff',
                fontSize: 34,
                fontWeight: 900,
                letterSpacing: '-.04em',
                lineHeight: 1.05,
              }}>
                Essa pagina nao existe na Loja Escolar
              </h1>
              <p style={{
                margin: '10px 0 0',
                color: 'rgba(255,255,255,.72)',
                fontSize: 14,
                lineHeight: 1.7,
                maxWidth: 420,
              }}>
                O link pode estar quebrado, expirado ou a pagina pode ter sido movida.
              </p>
            </div>
          </div>
        </div>

        <div style={{ padding: 28 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            marginBottom: 22,
          }}>
            {[
              ['Entrar na conta', 'Voltar para login ou cadastro com CPF.', '/login'],
              ['Abrir a loja', 'Ver produtos, pedidos e o carrinho.', '/loja'],
              ['Meus pedidos', 'Consultar pedidos e ingressos emitidos.', '/pedidos'],
            ].map(([title, desc, href]) => (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'block',
                  padding: '16px 18px',
                  borderRadius: 18,
                  textDecoration: 'none',
                  border: '1.5px solid #e2e8f0',
                  background: '#f8fafc',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{title}</div>
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6, marginTop: 6 }}>{desc}</div>
              </Link>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/loja" style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 48,
              padding: '0 18px',
              borderRadius: 999,
              textDecoration: 'none',
              background: '#0f172a',
              color: '#fff',
              fontSize: 14,
              fontWeight: 800,
            }}>
              Ir para a loja
            </Link>
            <Link href="/login" style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 48,
              padding: '0 18px',
              borderRadius: 999,
              textDecoration: 'none',
              background: '#eef2ff',
              color: '#4338ca',
              border: '1px solid #c7d2fe',
              fontSize: 14,
              fontWeight: 800,
            }}>
              Voltar ao login
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
