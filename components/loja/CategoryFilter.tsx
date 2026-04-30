'use client'

import React, { useEffect, useState, useRef } from 'react'
import type { CategoriaProduto } from '@/types/database'

export const CATEGORIAS: Record<CategoriaProduto | 'todas', { label: string; icon: string }> = {
  todas: { label: 'Tudo', icon: '✦' },
  eventos: { label: 'Eventos', icon: '🎉' },
  passeios: { label: 'Passeios', icon: '🚌' },
  segunda_chamada: { label: '2ª Chamada', icon: '📝' },
  materiais: { label: 'Mat.', icon: '📚' },
  uniforme: { label: 'Uniforme', icon: '👕' },
  outros: { label: 'Outros', icon: '📦' },
}

interface Props {
  counts: Partial<Record<CategoriaProduto | 'todas', number>>
}

export function CategoryFilter({ counts }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>('todas')
  const scrollRef = useRef<HTMLDivElement>(null)

  const tabs = Object.entries(CATEGORIAS).filter(([cat]) => {
    if (cat === 'todas') return true
    return (counts[cat as CategoriaProduto] ?? 0) > 0
  })

  // ScrollSpy observer
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll('section[data-cat-key]'))
    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const cat = entry.target.getAttribute('data-cat-key')
            if (cat) {
              setActiveCategory(cat)
              const activePill = document.getElementById(`pill-${cat}`)
              if (activePill && scrollRef.current) {
                const container = scrollRef.current
                const scrollLeft = activePill.offsetLeft - (container.offsetWidth / 2) + (activePill.offsetWidth / 2)
                container.scrollTo({ left: scrollLeft, behavior: 'smooth' })
              }
            }
          }
        })
      },
      { rootMargin: '-20% 0px -60% 0px' }
    )

    sections.forEach((sec) => observer.observe(sec))
    return () => observer.disconnect()
  }, [])

  function scrollToCat(cat: string) {
    setActiveCategory(cat)
    if (cat === 'todas') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const target = document.querySelector(`section[data-cat-key="${cat}"]`)
    if (target) {
      const offset = 120
      const elementPosition = target.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - offset
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      })
    }
  }

  if (tabs.length <= 1) return null

  return (
    <div 
      ref={scrollRef}
      className="no-scrollbar"
      style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        padding: '10px 14px 4px'
      }}
    >
      {tabs.map(([cat, { label, icon }]) => {
        const isActive = activeCategory === cat
        const count = cat === 'todas'
          ? (counts.todas ?? 0)
          : (counts[cat as CategoriaProduto] ?? 0)

        return (
          <button 
            key={cat} 
            id={`pill-${cat}`}
            onClick={() => scrollToCat(cat)} 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 11px',
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 700,
              flexShrink: 0,
              border: isActive ? '1.5px solid transparent' : '1.5px solid rgba(0,0,0,.07)',
              background: isActive ? '#f59e0b' : 'white',
              color: isActive ? '#78350f' : '#374151',
              boxShadow: isActive ? '0 3px 10px rgba(245,158,11,.4)' : 'none',
              cursor: 'pointer',
            }}
          >
            {icon && <span>{icon}</span>}
            <span>{label}</span>
            <span style={{
              fontSize: 9,
              fontWeight: 800,
              borderRadius: 99,
              padding: '1px 4px',
              lineHeight: 1.5,
              background: isActive ? 'rgba(0,0,0,.12)' : '#f0f2f8',
              color: isActive ? '#78350f' : '#9ca3af'
            }}>
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
