import { ImageResponse } from 'next/og'

export const size = {
  width: 180,
  height: 180,
}

export const contentType = 'image/png'

export const dynamic = 'force-static'

// Apple touch icon = marca "XK" da Xkola Store. Apple nao aceita transparencia
// (cantos viram preto), entao usa fundo branco solido.
export default function AppleIcon() {
  const stroke = '#FF6B1A'
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
        }}
      >
        <svg width="124" height="114" viewBox="0 0 120 110" fill="none">
          <path d="M14 16 L52 94" stroke={stroke} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M52 16 L14 94" stroke={stroke} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M66 16 L66 94" stroke={stroke} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M66 55 L102 16" stroke={stroke} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M66 55 L102 94" stroke={stroke} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    size,
  )
}
