"use client"

import React, { useState, useMemo } from 'react'
import { useCart } from './CartProvider'
import { buildAlunoNomesExibicao } from '@/lib/loja/aluno-display'
import type { Escola, Responsavel, Aluno } from '@/types/database'
import { ChildSelector } from './ChildSelector'
import { XkolaStoreBrand } from './XkolaStoreBrand'

interface StoreHeroProps {
  responsavel: Responsavel
  escola: Escola
  selectedAluno: Aluno | null
  alunos: Aluno[]
}

export function StoreHero({ responsavel, escola, selectedAluno, alunos }: StoreHeroProps) {
  const { items, open } = useCart()
  const [showChildSelector, setShowChildSelector] = useState(false)

  const cartItemsCount = items.length
  
  const hour = new Date().getHours()
  let greeting = 'Boa noite'
  if (hour < 12) greeting = 'Bom dia'
  else if (hour < 18) greeting = 'Boa tarde'

  const avatarColor = selectedAluno?.cor ?? '#6155f5'
  const initials = selectedAluno ? (selectedAluno.nome || '').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() : '?'
  const nomes = useMemo(() => buildAlunoNomesExibicao(alunos), [alunos])

  return (
    <div style={{
      background: 'linear-gradient(175deg, #2c2c2e 0%, #1c1c1e 70%)',
      borderRadius: '0 0 28px 28px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.04) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
        borderRadius: '0 0 28px 28px'
      }} />
      
      <div style={{
        position: 'absolute', top: -50, right: -30, width: 160, height: 160,
        borderRadius: '50%', background: 'rgba(249,115,22,.16)', filter: 'blur(32px)'
      }} />

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px 0', height: 52, position: 'relative', zIndex: 2
      }}>
        <XkolaStoreBrand escolaNome={escola.nome} theme="dark" compact />
        
        <button 
          onClick={open}
          style={{
            width: 36, height: 36, borderRadius: 11, background: 'rgba(255,255,255,.1)',
            border: '1px solid rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', cursor: 'pointer'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 001.98 1.61h9.72a2 2 0 001.98-1.61L23 6H6"/>
          </svg>
          {cartItemsCount > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4, width: 16, height: 16,
              background: '#ff383c', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 'bold', color: 'white', border: '2px solid #1c1c1e'
            }}>
              {cartItemsCount}
            </span>
          )}
        </button>
      </div>

      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '14px 16px 22px', position: 'relative', zIndex: 2
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: avatarColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19,
          fontWeight: 800, color: 'white', border: '2px solid rgba(255,255,255,.15)',
          boxShadow: '0 0 0 3px rgba(255,255,255,.08), 0 6px 20px rgba(0,0,0,.3)', marginBottom: 10
        }}>
          {initials}
        </div>

        {selectedAluno ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,.85)', letterSpacing: '.02em', marginBottom: 2 }}>
              {greeting}, responsável
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'white', letterSpacing: '-.03em', marginBottom: 5 }}>
              {nomes.get(selectedAluno.id)?.primeiro || (selectedAluno.nome || '').split(' ')[0]}
            </div>
            <div style={{
              background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)',
              borderRadius: 99, padding: '3px 10px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.6)'
            }}>
              {selectedAluno.serie}{selectedAluno.turma ? ` · ${selectedAluno.turma}` : ''}
            </div>
            <button 
              onClick={() => setShowChildSelector(!showChildSelector)}
              style={{ fontSize: 11, fontWeight: 600, color: '#fb923c', marginTop: 8, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Trocar filho ↓
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,.85)', letterSpacing: '.02em', marginBottom: 2 }}>
              {greeting}, {responsavel?.nome?.split(' ')[0] ?? 'Usuário'}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'white', letterSpacing: '-.03em', marginBottom: 5 }}>
              Bem-vindo(a)!
            </div>
          </>
        )}
      </div>

      {showChildSelector && (
        <div style={{ position: 'relative', zIndex: 20, padding: '0 16px 16px', animation: 'fadeUp 0.2s ease-out' }}>
          <div style={{ background: 'white', borderRadius: 20, padding: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
             <ChildSelector alunos={alunos} defaultOpen />
          </div>
        </div>
      )}
    </div>
  )
}
