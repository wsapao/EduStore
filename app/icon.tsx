import { ImageResponse } from 'next/og'

export const size = {
  width: 512,
  height: 512,
}

export const contentType = 'image/png'

// Favicon = marca "XK" da Xkola Store (laranja). Estatico: nao depende do
// banco. O logo da escola continua aparecendo dentro da loja (card de login),
// mas a aba do navegador usa a marca do produto, que e legivel em 16px.
export const dynamic = 'force-static'

// Desenho do "XK" em traços (mesmo formato da marca), em laranja solido para
// renderizar de forma confiavel no gerador de imagem (Satori).
function XkPaths() {
  const stroke = '#FF6B1A'
  return (
    <svg width="380" height="348" viewBox="0 0 120 110" fill="none">
      <path d="M14 16 L52 94" stroke={stroke} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M52 16 L14 94" stroke={stroke} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M66 16 L66 94" stroke={stroke} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M66 55 L102 16" stroke={stroke} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M66 55 L102 94" stroke={stroke} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
        }}
      >
        <XkPaths />
      </div>
    ),
    size,
  )
}
