'use client'

import React, { useDeferredValue, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

interface Props {
  initialQuery: string
  resultCount: number
}

export function StoreSearch({
  initialQuery,
  resultCount,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(initialQuery)
  const deferredQuery = useDeferredValue(query)
  const hasActiveSearch = initialQuery.trim().length > 0

  useEffect(() => {
    const nextValue = deferredQuery.trim()
    const currentValue = searchParams.get('q')?.trim() ?? ''
    if (nextValue === currentValue) return

    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (nextValue) params.set('q', nextValue)
      else params.delete('q')
      router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname)
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [deferredQuery, pathname, router, searchParams])

  function clearSearch() {
    setQuery('')
    const params = new URLSearchParams(searchParams.toString())
    params.delete('q')
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname)
  }

  return (
    <>
      <div style={{
        margin: '11px 14px 0',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'white',
        border: '1.5px solid rgba(0,0,0,.07)',
        borderRadius: 13,
        padding: '0 12px',
        height: 40,
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,.05)'
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar produto…"
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 12,
            color: '#374151',
            fontFamily: 'inherit',
          }}
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={clearSearch}
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(0,0,0,.07)',
              color: '#6b7280',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            aria-label="Limpar busca"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {hasActiveSearch && (
        <div style={{ margin: '10px 14px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>
            {resultCount} {resultCount === 1 ? 'resultado encontrado' : 'resultados encontrados'}
          </div>
          <button
            type="button"
            onClick={clearSearch}
            style={{
              background: 'none', border: 'none', color: '#f59e0b', 
              fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0
            }}
          >
            Limpar busca
          </button>
        </div>
      )}
    </>
  )
}
