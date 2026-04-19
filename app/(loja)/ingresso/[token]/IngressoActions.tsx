'use client'

import { useState } from 'react'

interface Props {
  shareUrl: string
  title: string
  text: string
  qrDataUrl: string
  produtoNome: string
  alunoNome: string
  serieTurma: string
  dataEvento?: string | null
  horaEvento?: string | null
  localEvento?: string | null
  codigoIngresso: string
  statusLabel: string
}

export function IngressoActions({
  shareUrl,
  title,
  text,
  qrDataUrl,
  produtoNome,
  alunoNome,
  serieTurma,
  dataEvento,
  horaEvento,
  localEvento,
  codigoIngresso,
  statusLabel,
}: Props) {
  const [copied, setCopied] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: shareUrl })
        return
      } catch {}
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {}
  }

  async function handleDownload() {
    try {
      setIsDownloading(true)
      const canvas = document.createElement('canvas')
      canvas.width = 1200
      canvas.height = 1800
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.fillStyle = '#f3f4ff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 360)
      gradient.addColorStop(0, '#4f46e5')
      gradient.addColorStop(1, '#7c3aed')

      roundRect(ctx, 80, 80, 1040, 1640, 40, '#ffffff')
      roundRect(ctx, 80, 80, 1040, 320, 40, gradient)

      ctx.fillStyle = 'rgba(255,255,255,.92)'
      ctx.font = '700 28px system-ui, sans-serif'
      ctx.fillText('INGRESSO DIGITAL', 140, 160)

      ctx.fillStyle = '#ffffff'
      ctx.font = '900 58px system-ui, sans-serif'
      wrapText(ctx, produtoNome, 140, 250, 820, 68)

      ctx.font = '700 28px system-ui, sans-serif'
      ctx.fillText(statusLabel, 140, 320)

      roundRect(ctx, 140, 440, 800, 120, 24, '#f8fafc', '#e2e8f0')
      ctx.fillStyle = '#0f172a'
      ctx.font = '800 42px system-ui, sans-serif'
      ctx.fillText(alunoNome, 180, 500)
      ctx.fillStyle = '#64748b'
      ctx.font = '600 26px system-ui, sans-serif'
      ctx.fillText(serieTurma, 180, 542)

      const qrImage = await loadImage(qrDataUrl)
      roundRect(ctx, 260, 620, 680, 680, 28, '#ffffff', '#dbe4ff')
      ctx.drawImage(qrImage, 330, 690, 540, 540)

      ctx.fillStyle = '#94a3b8'
      ctx.font = '700 22px system-ui, sans-serif'
      ctx.fillText('CODIGO DO INGRESSO', 380, 1335)
      ctx.fillStyle = '#334155'
      ctx.font = '800 30px monospace'
      ctx.fillText(codigoIngresso, 360, 1380)

      let detailsY = 1470
      ctx.fillStyle = '#0f172a'
      ctx.font = '800 28px system-ui, sans-serif'
      ctx.fillText('Detalhes do evento', 140, detailsY)
      detailsY += 55

      const details = [
        dataEvento ? `Data: ${dataEvento}` : null,
        horaEvento ? `Horario: ${horaEvento}` : null,
        localEvento ? `Local: ${localEvento}` : null,
      ].filter(Boolean) as string[]

      ctx.fillStyle = '#475569'
      ctx.font = '600 24px system-ui, sans-serif'
      if (details.length === 0) {
        ctx.fillText('Detalhes do evento serao divulgados em breve.', 140, detailsY)
      } else {
        details.forEach((detail) => {
          wrapText(ctx, detail, 140, detailsY, 920, 34)
          detailsY += 46
        })
      }

      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/png')
      link.download = `ingresso-${codigoIngresso.replace(/\s/g, '').toLowerCase()}.png`
      link.click()
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="no-print" style={{ marginTop: 16, maxWidth: 420, width: '100%', display: 'flex', gap: 10 }}>
      <button
        onClick={handleShare}
        style={{
          flex: 1,
          height: 48,
          borderRadius: 12,
          border: 'none',
          background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
          color: '#fff',
          fontSize: 14,
          fontWeight: 800,
          cursor: 'pointer',
        }}
      >
        {copied ? 'Link copiado!' : 'Compartilhar ingresso'}
      </button>
      <button
        onClick={handleDownload}
        disabled={isDownloading}
        style={{
          height: 48,
          padding: '0 16px',
          borderRadius: 12,
          border: 'none',
          background: '#0f172a',
          color: '#fff',
          fontSize: 13,
          fontWeight: 700,
          cursor: isDownloading ? 'not-allowed' : 'pointer',
          opacity: isDownloading ? 0.7 : 1,
        }}
      >
        {isDownloading ? 'Gerando...' : 'Baixar PNG'}
      </button>
      <button
        onClick={() => window.print()}
        style={{
          height: 48,
          padding: '0 16px',
          borderRadius: 12,
          border: '1.5px solid #e2e8f0',
          background: '#fff',
          color: '#475569',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Imprimir
      </button>
    </div>
  )
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string | CanvasGradient,
  stroke?: string
) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = 2
    ctx.stroke()
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(' ')
  let line = ''
  let currentY = y

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word
    const width = ctx.measureText(testLine).width
    if (width > maxWidth && line) {
      ctx.fillText(line, x, currentY)
      line = word
      currentY += lineHeight
    } else {
      line = testLine
    }
  }

  if (line) {
    ctx.fillText(line, x, currentY)
  }
}
