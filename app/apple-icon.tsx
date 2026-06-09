import { ImageResponse } from 'next/og'
import { getDefaultEscolaBranding, pickEscolaIconImage } from '@/lib/escola/branding'

export const size = {
  width: 180,
  height: 180,
}

export const contentType = 'image/png'

export const dynamic = 'force-dynamic'

export default async function AppleIcon() {
  const branding = await getDefaultEscolaBranding()
  const logo = pickEscolaIconImage(branding)

  // Apple touch icons não devem ter transparência → fundo branco sólido.
  if (logo) {
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo}
            alt=""
            width={156}
            height={156}
            style={{ width: 156, height: 156, objectFit: 'contain' }}
          />
        </div>
      ),
      size,
    )
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(160deg,#1a2f5a 0%,#243b70 52%,#5b6af8 100%)',
        }}
      >
        <div
          style={{
            width: 118,
            height: 118,
            borderRadius: 30,
            background: 'rgba(255,255,255,.16)',
            border: '4px solid rgba(255,255,255,.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ fontSize: 64, display: 'flex' }}>🏫</div>
        </div>
      </div>
    ),
    size,
  )
}
