'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown } from 'lucide-react'
import { trocarUnidade } from '@/app/actions/trocar-unidade'
import type { AdminShellTheme } from '@/lib/admin-shell-theme'

export type UnidadeAdminOption = { id: string; nome: string }

// Cores default caso `theme` não seja informado (ex.: em testes) — espelham
// o subtítulo estático que este componente substitui em AdminSidebar.
const DEFAULT_SUBTITLE_COLOR = '#c2410c'
const DEFAULT_TITLE_COLOR = '#000000'
const DEFAULT_BORDER_COLOR = 'rgba(60, 60, 67, 0.16)'
const DEFAULT_SURFACE_COLOR = '#ffffff'
const DEFAULT_ACCENT_COLOR = '#f97316'

/**
 * Seletor de unidade ativa no AdminSidebar.
 *
 * Com 0 ou 1 escola vinculada, renderiza só o nome (sem interatividade) —
 * comportamento idêntico ao subtítulo estático que existia antes deste
 * componente. Com 2+ escolas, vira um dropdown que troca a unidade ativa
 * via a server action `trocarUnidade` e recarrega a página.
 */
export function UnitSwitcher({
  escolas,
  escolaAtivaId,
  theme,
}: {
  escolas: UnidadeAdminOption[]
  escolaAtivaId: string | null
  theme?: AdminShellTheme
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const containerRef = useRef<HTMLDivElement>(null)

  const subtitleColor = theme?.subtitleColor ?? DEFAULT_SUBTITLE_COLOR
  const titleColor = theme?.titleColor ?? DEFAULT_TITLE_COLOR
  const borderColor = theme?.sidebarBorder ?? DEFAULT_BORDER_COLOR
  const surfaceColor = theme?.bottomCardBackground ?? DEFAULT_SURFACE_COLOR
  const accentColor = theme?.accent ?? DEFAULT_ACCENT_COLOR

  const ativa = escolas.find((e) => e.id === escolaAtivaId) ?? escolas[0] ?? null

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: subtitleColor,
    letterSpacing: '.05em',
    maxWidth: 140,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    marginTop: 2,
  }

  if (escolas.length <= 1) {
    return <span style={labelStyle}>{ativa?.nome ?? ''}</span>
  }

  function handleSelect(escolaId: string) {
    setOpen(false)
    if (escolaId === escolaAtivaId) return
    startTransition(async () => {
      await trocarUnidade(escolaId)
      router.refresh()
    })
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', marginTop: 2 }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Trocar unidade — atual: ${ativa?.nome ?? ''}`}
        disabled={isPending}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          maxWidth: 140,
          padding: 0,
          background: 'none',
          border: 'none',
          font: 'inherit',
          cursor: isPending ? 'default' : 'pointer',
          opacity: isPending ? 0.6 : 1,
        }}
      >
        <span style={{ ...labelStyle, maxWidth: 112, marginTop: 0 }}>{ativa?.nome ?? ''}</span>
        <ChevronDown
          size={12}
          strokeWidth={2.5}
          style={{
            color: subtitleColor,
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform .15s ease',
          }}
        />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 6,
            minWidth: 200,
            maxWidth: 260,
            background: surfaceColor,
            border: `1px solid ${borderColor}`,
            borderRadius: 12,
            boxShadow: '0 18px 40px rgba(0,0,0,.18), 0 4px 12px rgba(0,0,0,.08)',
            padding: 6,
            zIndex: 200,
          }}
        >
          {escolas.map((escola) => {
            const isActive = escola.id === escolaAtivaId
            return (
              <button
                key={escola.id}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                disabled={isPending}
                onClick={() => handleSelect(escola.id)}
                className="hover:bg-black/5"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'none',
                  cursor: isPending ? 'default' : 'pointer',
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  color: titleColor,
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {escola.nome}
                </span>
                {isActive && <Check size={14} strokeWidth={2.5} style={{ color: accentColor, flexShrink: 0 }} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
