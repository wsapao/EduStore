'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Aluno } from '@/types/database'

const AVATAR_COLORS = [
  '#818cf8',
  '#f472b6',
  '#34d399',
  '#fbbf24',
  '#a78bfa',
]

interface Props {
  alunos: Aluno[]
}

export function ChildSelector({ alunos }: Props) {
  const router = useRouter()
  const sp = useSearchParams()
  const selectedId = sp.get('aluno') ?? alunos[0]?.id ?? ''
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedAluno = alunos.find(a => a.id === selectedId) || alunos[0]

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function select(id: string) {
    const params = new URLSearchParams(sp.toString())
    params.set('aluno', id)
    params.delete('categoria')
    router.push(`/loja?${params.toString()}`)
    setOpen(false)
  }

  if (alunos.length === 0) {
    return (
      <section style={{ padding: '14px 18px 0' }}>
        <div style={{
          background: 'var(--warn-soft)', border: '1px solid #fde68a',
          borderRadius: 16, padding: '14px 16px',
          fontSize: 13, color: '#78350f', fontWeight: 600, lineHeight: 1.5,
        }}>
          ⚠️ Nenhum aluno vinculado à sua conta.{' '}
          <a href="/perfil/alunos?onboarding=1" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            Vincular agora →
          </a>
        </div>
      </section>
    )
  }

  const avatarColor = AVATAR_COLORS[alunos.findIndex(a => a.id === selectedAluno?.id) % AVATAR_COLORS.length] || AVATAR_COLORS[0]
  const initials = selectedAluno ? selectedAluno.nome.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() : ''
  const showDropdown = alunos.length > 1

  return (
    <section style={{ padding: '14px 18px 0', position: 'relative', zIndex: 100 }} ref={containerRef}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--text-3)',
        letterSpacing: '0.06em', textTransform: 'uppercase',
        marginBottom: 8,
      }}>
        COMPRANDO PARA
      </div>

      <div 
        onClick={() => showDropdown && setOpen(!open)}
        style={{
          width: '100%', borderRadius: 16,
          border: '2px solid var(--brand)',
          background: 'var(--surface)', padding: '14px 16px',
          boxShadow: '0 2px 12px rgba(26,47,90,.10)',
          display: 'flex', gap: 14, alignItems: 'center',
          cursor: showDropdown ? 'pointer' : 'default',
        }}
      >
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: avatarColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 800, color: 'white', flexShrink: 0,
        }}>
          {initials}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 16, fontWeight: 800, color: 'var(--text-1)',
            letterSpacing: '-.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
          }}>
            {selectedAluno?.nome.split(' ')[0]} {selectedAluno?.nome.split(' ').slice(-1)[0]}
          </div>
          <div style={{
            fontSize: 13, fontWeight: 600, color: 'var(--text-3)', marginTop: 2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
          }}>
            {selectedAluno?.serie}{selectedAluno?.turma ? ` · ${selectedAluno.turma}` : ''}
          </div>
        </div>

        {showDropdown && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)' }}>TROCAR</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        )}
      </div>

      {open && showDropdown && (
        <div className="animate-fadeIn" style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 18, right: 18,
          background: 'var(--surface)', borderRadius: 16,
          border: '1.5px solid var(--border)',
          boxShadow: '0 8px 32px rgba(0,0,0,.12)',
          overflow: 'hidden', zIndex: 110,
        }}>
          {alunos.map((aluno, i) => {
            const isSelected = aluno.id === selectedId
            const color = AVATAR_COLORS[i % AVATAR_COLORS.length]
            const inits = aluno.nome.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()

            return (
              <button
                key={aluno.id}
                onClick={() => select(aluno.id)}
                style={{
                  width: '100%', minHeight: 64, padding: '10px 16px',
                  display: 'flex', alignItems: 'center', gap: 14,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  borderBottom: i < alunos.length - 1 ? '1px solid var(--border)' : 'none',
                  textAlign: 'left'
                }}
              >
                <div style={{
                  width: 42, height: 42, borderRadius: '50%',
                  background: color, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 15, fontWeight: 800, color: 'white',
                  flexShrink: 0
                }}>
                  {inits}
                </div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>
                    {aluno.nome.split(' ')[0]} {aluno.nome.split(' ').slice(-1)[0]}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)' }}>
                    {aluno.serie}{aluno.turma ? ` · ${aluno.turma}` : ''}
                  </div>
                </div>

                {isSelected && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
