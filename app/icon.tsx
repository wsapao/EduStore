import { ImageResponse } from 'next/og'

export const size = {
  width: 512,
  height: 512,
}

export const contentType = 'image/png'

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
          background: 'linear-gradient(160deg,#1a2f5a 0%,#243b70 52%,#5b6af8 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -70,
            right: -50,
            width: 260,
            height: 260,
            borderRadius: '50%',
            background: 'rgba(255,255,255,.10)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -100,
            left: -60,
            width: 320,
            height: 320,
            borderRadius: '50%',
            background: 'rgba(255,255,255,.06)',
          }}
        />
        <div
          style={{
            width: 290,
            height: 290,
            borderRadius: 72,
            background: 'rgba(255,255,255,.14)',
            border: '10px solid rgba(255,255,255,.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 22px 60px rgba(0,0,0,.24)',
          }}
        >
          <div style={{ fontSize: 154, display: 'flex' }}>🏫</div>
        </div>
      </div>
    ),
    size
  )
}
