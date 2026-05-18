'use client'

import { useState, useTransition, useRef } from 'react'
import { uploadAssetEscolaAction, type AssetKind } from '@/app/actions/configuracoes/identidade'
import type { Escola } from '@/types/database'

export function MidiasCard({ escola }: { escola: Escola }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Uploader kind="logo"    label="Logo"    descricao="PNG, JPG, SVG ou WebP (máx. 2 MB)." atualUrl={escola.logo_url} />
      <Uploader kind="banner"  label="Banner principal" descricao="Recomendado 1920×600. PNG/JPG/WebP (máx. 2 MB)." atualUrl={escola.banner_url} />
      <Uploader kind="favicon" label="Favicon" descricao="PNG ou ICO (máx. 2 MB)." atualUrl={escola.favicon_url} />
    </div>
  )
}

function Uploader({
  kind,
  label,
  descricao,
  atualUrl,
}: {
  kind: AssetKind
  label: string
  descricao: string
  atualUrl: string | null
}) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [preview, setPreview] = useState<string | null>(atualUrl)
  const inputRef = useRef<HTMLInputElement>(null)

  function escolher() {
    inputRef.current?.click()
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setMsg(null)
    startTransition(async () => {
      const r = await uploadAssetEscolaAction(kind, file)
      if ('error' in r && r.error) {
        setMsg({ tipo: 'erro', texto: r.error })
        return
      }
      setPreview(r.url ?? null)
      setMsg({ tipo: 'ok', texto: 'Atualizado!' })
    })
    e.target.value = ''
  }

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <div
        style={{
          width: 120,
          height: 80,
          borderRadius: 10,
          background: 'var(--surface-2)',
          border: '1px dashed rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={label} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>(vazio)</span>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{descricao}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
          <input ref={inputRef} type="file" accept="image/*" onChange={onPick} style={{ display: 'none' }} />
          <button onClick={escolher} disabled={pending} style={btnSecondary} type="button">
            {pending ? 'Enviando…' : 'Escolher arquivo'}
          </button>
          {msg && (
            <span style={{ fontSize: 12, color: msg.tipo === 'ok' ? '#22c55e' : '#ef4444' }}>
              {msg.texto}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

const btnSecondary: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '8px 14px',
  color: 'var(--text-1)',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
}
