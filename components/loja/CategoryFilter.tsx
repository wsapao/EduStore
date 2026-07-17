'use client'

import React, { useEffect, useState, useRef } from 'react'

import { CATEGORIAS, getDefaultCategoryMeta } from '@/lib/categorias/defaults'

// Reexports preservam imports legados (`import { CATEGORIAS, getDefaultCategoryMeta } from '@/components/loja/CategoryFilter'`)
export { CATEGORIAS, getDefaultCategoryMeta }

export type CategoryTab = {
  key: string
  label: string
  icon: string
}

interface Props {
  counts: Partial<Record<string, number>>
  tabs?: CategoryTab[]
}

export function CategoryFilter({ counts, tabs }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>('todas')
  const scrollRef = useRef<HTMLDivElement>(null)

  const visibleTabs = [
    { key: 'todas', ...getDefaultCategoryMeta('todas') },
    ...(
      tabs?.filter((tab) => (counts[tab.key] ?? 0) > 0)
      ?? Object.entries(CATEGORIAS)
        .filter(([cat]) => cat !== 'todas' && (counts[cat] ?? 0) > 0)
        .map(([key, meta]) => ({ key, ...meta }))
    ),
  ]

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

  if (visibleTabs.length <= 1) return null

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
      {visibleTabs.map(({ key, label, icon }) => {
        const isActive = activeCategory === key
        const count = key === 'todas'
          ? (counts.todas ?? 0)
          : (counts[key] ?? 0)

        return (
          <button
            key={key}
            id={`pill-${key}`}
            onClick={() => scrollToCat(key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 12px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              flexShrink: 0,
              border: isActive ? '1px solid transparent' : '1px solid rgba(60,60,67,.12)',
              background: isActive ? '#007aff' : 'white',
              color: isActive ? 'white' : '#3c3c43',
              boxShadow: isActive ? '0 3px 10px rgba(0,122,255,.35)' : 'none',
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
              background: isActive ? 'rgba(255,255,255,.28)' : 'rgba(118,118,128,.12)',
              color: isActive ? 'white' : '#8e8e93'
            }}>
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
