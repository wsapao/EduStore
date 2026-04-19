'use client'

import React, { useDeferredValue, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

interface Props {
  initialQuery: string
  initialSort: string
  initialMinPrice: string
  initialMaxPrice: string
  resultCount: number
}

export function StoreSearch({
  initialQuery,
  initialSort,
  initialMinPrice,
  initialMaxPrice,
  resultCount,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(initialQuery)
  const [sort, setSort] = useState(initialSort)
  const [minPrice, setMinPrice] = useState(initialMinPrice)
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice)
  const deferredQuery = useDeferredValue(query)
  const deferredMinPrice = useDeferredValue(minPrice)
  const deferredMaxPrice = useDeferredValue(maxPrice)
  const hasActiveSearch = initialQuery.trim().length > 0
  const hasAdvancedFilters = (
    initialSort !== 'recentes' ||
    initialMinPrice.trim().length > 0 ||
    initialMaxPrice.trim().length > 0
  )

  useEffect(() => {
    const nextValue = deferredQuery.trim()
    const currentValue = searchParams.get('q')?.trim() ?? ''
    const currentSort = searchParams.get('ordem') ?? 'recentes'
    const nextSort = sort || 'recentes'
    const currentMinPrice = searchParams.get('min')?.trim() ?? ''
    const currentMaxPrice = searchParams.get('max')?.trim() ?? ''
    const nextMinPrice = deferredMinPrice.trim()
    const nextMaxPrice = deferredMaxPrice.trim()
    if (
      nextValue === currentValue &&
      nextSort === currentSort &&
      nextMinPrice === currentMinPrice &&
      nextMaxPrice === currentMaxPrice
    ) return

    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (nextValue) params.set('q', nextValue)
      else params.delete('q')
      if (nextSort && nextSort !== 'recentes') params.set('ordem', nextSort)
      else params.delete('ordem')
      if (nextMinPrice) params.set('min', nextMinPrice)
      else params.delete('min')
      if (nextMaxPrice) params.set('max', nextMaxPrice)
      else params.delete('max')
      router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname)
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [deferredMaxPrice, deferredMinPrice, deferredQuery, pathname, router, searchParams, sort])

  function clearSearch() {
    setQuery('')
    setSort('recentes')
    setMinPrice('')
    setMaxPrice('')
    const params = new URLSearchParams(searchParams.toString())
    params.delete('q')
    params.delete('ordem')
    params.delete('min')
    params.delete('max')
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname)
  }

  return (
    <section style={{ padding: '16px 20px 0' }}>
      <div style={{
        background: 'var(--surface)',
        border: '1.5px solid var(--border)',
        borderRadius: 'var(--r-xl)',
        boxShadow: 'var(--shadow-xs)',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minHeight: 50,
          borderRadius: 'var(--r-lg)',
          border: '1.5px solid var(--border)',
          background: 'var(--surface-2)',
          padding: '0 12px 0 14px',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-3)', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou descrição"
            style={{
              flex: 1,
              minWidth: 0,
              height: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 14,
              color: 'var(--text-1)',
              fontFamily: 'inherit',
              fontWeight: 500,
            }}
          />
          {query.trim().length > 0 && (
            <button
              type="button"
              onClick={clearSearch}
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                border: 'none',
                background: 'var(--border)',
                color: 'var(--text-2)',
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: 1,
                flexShrink: 0,
              }}
              aria-label="Limpar busca"
            >
              ×
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
            {hasActiveSearch ? (
              <>Buscando por <strong style={{ color: 'var(--text-2)' }}>&quot;{initialQuery}&quot;</strong></>
            ) : (
              <>Digite para encontrar passeios, eventos, uniformes e materiais mais rápido.</>
            )}
          </div>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            color: hasActiveSearch ? 'var(--brand)' : 'var(--text-3)',
            background: hasActiveSearch ? 'var(--brand-light)' : 'var(--surface-2)',
            border: `1px solid ${hasActiveSearch ? '#c7d2fe' : 'var(--border)'}`,
            borderRadius: 'var(--r-pill)',
            padding: '4px 9px',
            whiteSpace: 'nowrap',
          }}>
            {resultCount} {resultCount === 1 ? 'resultado' : 'resultados'}
          </span>
        </div>

        <div className="store-filter-grid" style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr 1fr',
          gap: 10,
        }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6, letterSpacing: '.04em' }}>
              ORDENAR
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              style={{
                width: '100%',
                height: 42,
                borderRadius: 'var(--r-md)',
                border: '1.5px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text-1)',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'inherit',
                padding: '0 12px',
              }}
            >
              <option value="recentes">Mais recentes</option>
              <option value="menor_preco">Mais barato</option>
              <option value="maior_preco">Mais caro</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6, letterSpacing: '.04em' }}>
              PRECO MIN.
            </label>
            <input
              inputMode="decimal"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value.replace(/[^0-9.,]/g, ''))}
              placeholder="Ex: 50"
              style={{
                width: '100%',
                height: 42,
                borderRadius: 'var(--r-md)',
                border: '1.5px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text-1)',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'inherit',
                padding: '0 12px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6, letterSpacing: '.04em' }}>
              PRECO MAX.
            </label>
            <input
              inputMode="decimal"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value.replace(/[^0-9.,]/g, ''))}
              placeholder="Ex: 200"
              style={{
                width: '100%',
                height: 42,
                borderRadius: 'var(--r-md)',
                border: '1.5px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text-1)',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'inherit',
                padding: '0 12px',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {hasAdvancedFilters && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
            paddingTop: 2,
          }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
              Filtros ativos ajudam a reduzir a lista e encontrar o produto certo mais rápido.
            </div>
            <button
              type="button"
              onClick={clearSearch}
              style={{
                height: 34,
                padding: '0 12px',
                borderRadius: 'var(--r-pill)',
                border: '1px solid #c7d2fe',
                background: 'var(--brand-light)',
                color: 'var(--brand)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Limpar filtros
            </button>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 640px) {
          .store-filter-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  )
}
