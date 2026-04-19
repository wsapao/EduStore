'use client'

import React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Aluno } from '@/types/database'
import { useCart } from './CartProvider'

const AVATAR_COLORS = [
  'linear-gradient(135deg,#667eea,#764ba2)',
  'linear-gradient(135deg,#f093fb,#f5576c)',
  'linear-gradient(135deg,#4facfe,#00f2fe)',
  'linear-gradient(135deg,#43e97b,#38f9d7)',
  'linear-gradient(135deg,#fa709a,#fee140)',
]

interface Props {
  alunos: Aluno[]
}

export function ChildSelector({ alunos }: Props) {
  const router = useRouter()
  const sp = useSearchParams()
  const { items } = useCart()
  const selectedId = sp.get('aluno') ?? alunos[0]?.id ?? ''

  function select(id: string) {
    const params = new URLSearchParams(sp.toString())
    params.set('aluno', id)
    params.delete('categoria')
    router.push(`/loja?${params.toString()}`)
  }

  if (alunos.length === 0) {
    return (
      <section style={{ padding:'16px 20px 0' }}>
        <div style={{
          background:'var(--warn-light)', border:'1px solid #fde68a',
          borderRadius:'var(--r-md)', padding:'12px 16px',
          fontSize:13, color:'#78350f', fontWeight:600, lineHeight:1.5,
        }}>
          ⚠️ Nenhum aluno vinculado à sua conta.{' '}
          <a href="/perfil/alunos?onboarding=1" style={{ color:'var(--accent)', textDecoration:'none' }}>
            Vincular agora →
          </a>
        </div>
      </section>
    )
  }

  return (
    <section style={{ padding:'20px 20px 0' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <span style={{
          fontSize:11, fontWeight:700, textTransform:'uppercase',
          letterSpacing:'.08em', color:'var(--text-3)',
        }}>
          Meus filhos
        </span>
      </div>

      <div style={{
        display:'flex', gap:10, overflowX:'auto',
        paddingBottom:2, scrollbarWidth:'none',
      }}>
        {alunos.map((aluno, i) => {
          const isActive = aluno.id === selectedId
          const cartCount = items.filter(it => it.aluno.id === aluno.id).length
          const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length]
          const initials = aluno.nome.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()

          return (
            <button key={aluno.id} onClick={() => select(aluno.id)} style={{
              display:'flex', alignItems:'center', gap:10,
              background: isActive ? 'var(--brand-light)' : 'var(--surface)',
              border: `1.5px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius:'var(--r-xl)', padding:'10px 16px 10px 10px',
              cursor:'pointer', transition:'all .2s var(--ease)', flexShrink:0,
              boxShadow: isActive
                ? '0 0 0 3px var(--accent-glow), var(--shadow-sm)'
                : 'var(--shadow-xs)',
              fontFamily:'inherit',
            }}>
              {/* Avatar */}
              <div style={{
                width:40, height:40, borderRadius:'var(--r-pill)',
                background: avatarColor,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:14, fontWeight:800, color:'white', flexShrink:0,
                position:'relative',
              }}>
                {initials}
                <span style={{
                  position:'absolute', bottom:0, right:0,
                  width:11, height:11, background:'var(--success)',
                  borderRadius:'50%', border:'2px solid white',
                }} />
              </div>

              {/* Info */}
              <div style={{ lineHeight:1.3, textAlign:'left' }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--text-1)', whiteSpace:'nowrap' }}>
                  {aluno.nome.split(' ')[0]}
                </div>
                <div style={{ fontSize:11, color:'var(--text-3)', fontWeight:500, whiteSpace:'nowrap' }}>
                  {aluno.serie}{aluno.turma ? ` · ${aluno.turma}` : ''}
                </div>
              </div>

              {/* Cart badge */}
              <span style={{
                fontSize:10, fontWeight:700,
                background: cartCount > 0 ? 'var(--accent)' : 'var(--border)',
                color: cartCount > 0 ? 'white' : 'var(--text-3)',
                borderRadius:'var(--r-pill)', padding:'2px 7px',
                whiteSpace:'nowrap', marginLeft:2, flexShrink:0,
              }}>
                {cartCount > 0 ? `${cartCount} ${cartCount === 1 ? 'item' : 'itens'}` : '0 itens'}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
