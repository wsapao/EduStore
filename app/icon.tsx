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
          background: 'linear-gradient(145deg, #0c1e3d 0%, #0a1628 60%, #0d2040 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glow blob */}
        <div
          style={{
            position: 'absolute',
            top: -60,
            right: -40,
            width: 240,
            height: 240,
            borderRadius: '50%',
            background: 'rgba(245,158,11,.18)',
            filter: 'blur(40px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -80,
            left: -40,
            width: 280,
            height: 280,
            borderRadius: '50%',
            background: 'rgba(99,102,241,.12)',
            filter: 'blur(60px)',
          }}
        />

        {/* Card central */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            position: 'relative',
          }}
        >
          {/* Sacola */}
          <svg
            width="200"
            height="200"
            viewBox="0 0 24 24"
            fill="none"
          >
            {/* Handle */}
            <path
              d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
              stroke="rgba(255,255,255,.95)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="rgba(255,255,255,.08)"
            />
            <line
              x1="3"
              y1="6"
              x2="21"
              y2="6"
              stroke="rgba(255,255,255,.95)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M16 10a4 4 0 01-8 0"
              stroke="#f59e0b"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* Texto */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <div
              style={{
                fontSize: 52,
                fontWeight: 900,
                color: '#ffffff',
                letterSpacing: '-3px',
                lineHeight: 1,
                fontFamily: 'sans-serif',
              }}
            >
              LOJA
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: '#f59e0b',
                letterSpacing: '6px',
                lineHeight: 1,
                fontFamily: 'sans-serif',
                textTransform: 'uppercase',
              }}
            >
              ESCOLAR
            </div>
          </div>
        </div>
      </div>
    ),
    size
  )
}
