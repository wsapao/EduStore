import { ImageResponse } from 'next/og'
import { getDefaultEscolaBranding, pickEscolaIconImage } from '@/lib/escola/branding'

export const size = {
  width: 512,
  height: 512,
}

export const contentType = 'image/png'

// Sempre reflete a logo atual da escola (lê do banco). Sem isso o Next poderia
// servir uma versão estática gerada no build.
export const dynamic = 'force-dynamic'

export default async function Icon() {
  const branding = await getDefaultEscolaBranding()
  const logo = pickEscolaIconImage(branding)

  // Com logo: quadrado branco com a logo da escola centralizada (contain).
  // Fundo branco (e não a cor da escola) porque a maioria das logos é desenhada
  // para fundo claro — cor escura poderia "engolir" logos escuras.
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
            width={448}
            height={448}
            style={{ width: 448, height: 448, objectFit: 'contain' }}
          />
        </div>
      ),
      size,
    )
  }

  // Fallback: arte padrão da loja quando nenhuma mídia foi configurada.
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          background: 'linear-gradient(145deg, #0c1e3d 0%, #0a1628 60%, #0d2040 100%)',
        }}
      >
        <svg width="200" height="200" viewBox="0 0 24 24" fill="none">
          <path
            d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
            stroke="rgba(255,255,255,.95)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="rgba(255,255,255,.08)"
          />
          <line x1="3" y1="6" x2="21" y2="6" stroke="rgba(255,255,255,.95)" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M16 10a4 4 0 01-8 0" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{ fontSize: 52, fontWeight: 900, color: '#ffffff', letterSpacing: '-3px', lineHeight: 1, fontFamily: 'sans-serif' }}>
            LOJA
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b', letterSpacing: '6px', lineHeight: 1, fontFamily: 'sans-serif', textTransform: 'uppercase' }}>
            ESCOLAR
          </div>
        </div>
      </div>
    ),
    size,
  )
}
