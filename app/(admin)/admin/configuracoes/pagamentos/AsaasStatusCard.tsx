export function AsaasStatusCard() {
  const configurada = !!process.env.ASAAS_API_KEY
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{
          width: 10, height: 10, borderRadius: 5,
          background: configurada ? '#22c55e' : '#ef4444',
        }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>
          {configurada ? 'API key configurada' : 'API key NÃO configurada'}
        </span>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>
        A chave de API do Asaas é gerenciada via variável de ambiente <code style={codeStyle}>ASAAS_API_KEY</code> no Vercel — por questões de segurança, ela não pode ser editada por aqui.
      </p>

      {!configurada && (
        <p style={{ fontSize: 12, color: '#fbbf24', marginTop: 12 }}>
          ⚠️ Sem essa chave, gateway Asaas não funciona. Configure no painel do Vercel em
          {' '}<strong>Settings → Environment Variables</strong>.
        </p>
      )}
    </div>
  )
}

const codeStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  padding: '2px 6px',
  borderRadius: 4,
  fontSize: 12,
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
}
