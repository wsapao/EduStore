'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import type { Produto, Aluno } from '@/types/database'
import { useCart } from './CartProvider'

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const CAT_THEMES: Record<string, { bg: string, text: string }> = {
  eventos:        { bg: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', text: '#6d28d9' },
  passeios:       { bg: 'linear-gradient(135deg,#0ea5e9,#0284c7)', text: '#0369a1' },
  segunda_chamada:{ bg: 'linear-gradient(135deg,#f59e0b,#d97706)', text: '#b45309' },
  materiais:      { bg: 'linear-gradient(135deg,#10b981,#059669)', text: '#047857' },
  uniforme:       { bg: 'linear-gradient(135deg,#f43f5e,#e11d48)', text: '#be123c' },
  outros:         { bg: 'linear-gradient(135deg,#6b7280,#4b5563)', text: '#374151' },
}

const DEFAULT_ICONS: Record<string, string> = {
  eventos:        '🎉',
  passeios:       '🚌',
  segunda_chamada:'📝',
  materiais:      '📚',
  uniforme:       '👕',
  outros:         '📦',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })
}

function getUrgencia(prazo: string | null): { isUrgent: boolean; text: string } {
  if (!prazo) return { isUrgent: false, text: '' }
  const diff = Math.ceil((new Date(prazo).getTime() - Date.now()) / 86400000)
  if (diff < 0) return { isUrgent: false, text: '' }
  if (diff === 0) return { isUrgent: true, text: 'Hoje!' }
  if (diff === 1) return { isUrgent: true, text: 'Amanhã!' }
  if (diff <= 4) return { isUrgent: true, text: `${diff} dias` }
  return { isUrgent: false, text: '' }
}

interface Props {
  produto: Produto
  aluno: Aluno
  index?: number
  vagasRestantes?: number | null
}

export function ProductCard({ produto, aluno, index = 0, vagasRestantes }: Props) {
  const { add, remove, hasItem } = useCart()
  const router = useRouter()
  const [isPressing, setIsPressing] = useState(false)
  const exigeVariante = !!produto.variantes?.length
  const inCart = !exigeVariante && hasItem(produto.id, aluno.id)
  const icon = produto.icon ?? DEFAULT_ICONS[produto.categoria] ?? '📦'
  
  const urgencia = getUrgencia(produto.prazo_compra)
  const isUrgent = urgencia.isUrgent && !produto.esgotado

  const theme = CAT_THEMES[produto.categoria] ?? CAT_THEMES.outros

  function handleAdd(e: React.MouseEvent) {
    e.stopPropagation()
    if (produto.esgotado) return
    if (exigeVariante) {
      router.push(`/loja/produto/${produto.id}?aluno=${aluno.id}`)
      return
    }
    if (inCart) {
      remove(`${produto.id}__${aluno.id}__sem-variante`)
    } else {
      add(produto, aluno)
    }
  }

  return (
    <div
      onClick={() => router.push(`/loja/produto/${produto.id}?aluno=${aluno.id}`)}
      style={{
        background: 'white',
        border: '1.5px solid rgba(0,0,0,.07)',
        borderRadius: 18,
        overflow: 'hidden',
        margin: '0 14px 10px',
        boxShadow: '0 2px 8px rgba(0,0,0,.06)',
        opacity: produto.esgotado ? 0.6 : 1,
        pointerEvents: produto.esgotado ? 'none' : 'auto',
        animation: `fadeUp 0.3s ease ${index * 0.04}s both`,
        cursor: 'pointer'
      }}
    >
      <div style={{
        height: 76,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        background: theme.bg
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '14px 14px'
        }} />
        
        {produto.imagem_url ? (
          <Image src={produto.imagem_url} alt={produto.nome} fill sizes="150px" style={{ objectFit: 'cover' }} />
        ) : (
          <div style={{
            fontSize: 30,
            filter: 'drop-shadow(0 2px 5px rgba(0,0,0,.2))',
            position: 'relative', zIndex: 1
          }}>
            {icon}
          </div>
        )}

        {produto.esgotado && (
          <div style={{
            position: 'absolute', top: 7, left: 9, fontSize: 8, fontWeight: 800,
            padding: '3px 7px', borderRadius: 99, background: 'rgba(0,0,0,.6)',
            color: 'white', letterSpacing: '.04em', backdropFilter: 'blur(8px)'
          }}>
            ESGOTADO
          </div>
        )}
        {!produto.esgotado && isUrgent && (
          <div style={{
            position: 'absolute', top: 7, left: 9, fontSize: 8, fontWeight: 800,
            padding: '3px 7px', borderRadius: 99, background: 'rgba(220,38,38,.75)',
            color: 'white', letterSpacing: '.04em', backdropFilter: 'blur(8px)'
          }}>
            ⏰ {urgencia.text}
          </div>
        )}
        {inCart && (
          <div style={{
            position: 'absolute', top: 7, right: 9, fontSize: 8, fontWeight: 800,
            padding: '3px 7px', borderRadius: 99, background: 'rgba(22,163,74,.8)',
            color: 'white'
          }}>
            ✓ No carrinho
          </div>
        )}
        {!produto.esgotado && !inCart && vagasRestantes !== null && vagasRestantes !== undefined && vagasRestantes <= 10 && (
          <div style={{
            position: 'absolute', top: 7, right: 9, fontSize: 8, fontWeight: 800,
            padding: '3px 7px', borderRadius: 99, background: 'rgba(245,158,11,.85)',
            color: '#78350f', backdropFilter: 'blur(8px)'
          }}>
            {vagasRestantes === 0 ? 'Última vaga' : `${vagasRestantes} vagas`}
          </div>
        )}
      </div>

      <div style={{ padding: '11px 13px 9px' }}>
        <div style={{
          fontSize: 9, fontWeight: 800, letterSpacing: '.07em',
          textTransform: 'uppercase', marginBottom: 3, color: theme.text
        }}>
          {produto.categoria.replace('_', ' ')}
        </div>
        <div style={{
          fontSize: 13, fontWeight: 800, color: '#0a1628',
          letterSpacing: '-.02em', lineHeight: 1.3, marginBottom: 4
        }}>
          {produto.nome}
        </div>
        {produto.descricao && (
          <div style={{
            fontSize: 10, color: '#9ca3af', lineHeight: 1.5,
            marginBottom: 7, display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden'
          }}>
            {produto.descricao}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {produto.data_evento && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '3px 7px', borderRadius: 7,
              background: '#f0f2f8', color: '#374151', border: '1px solid rgba(0,0,0,.07)',
              display: 'inline-block'
            }}>
              📅 {formatDate(produto.data_evento)}
            </span>
          )}
          {exigeVariante && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '3px 7px', borderRadius: 7,
              background: '#f0f2f8', color: '#374151', border: '1px solid rgba(0,0,0,.07)',
              display: 'inline-block'
            }}>
              Variantes
            </span>
          )}
          {!produto.esgotado && isUrgent && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '3px 7px', borderRadius: 7,
              background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
              display: 'inline-block'
            }}>
              ⏰ Termina {urgencia.text.toLowerCase()}
            </span>
          )}
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 13px 12px', borderTop: '1px solid rgba(0,0,0,.06)', gap: 10
      }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 600, color: '#9ca3af', marginBottom: 1 }}>
            Valor total
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#0a1628', letterSpacing: '-.04em', lineHeight: 1 }}>
            {fmtBRL(produto.preco_promocional ?? produto.preco)}
          </div>
        </div>

        <button
          onClick={handleAdd}
          onMouseDown={() => setIsPressing(true)}
          onMouseUp={() => setIsPressing(false)}
          onMouseLeave={() => setIsPressing(false)}
          disabled={produto.esgotado}
          style={{
            height: 40, padding: '0 14px', borderRadius: 12,
            background: produto.esgotado ? '#e5e7eb' : inCart ? '#16a34a' : '#f59e0b',
            border: 'none', fontSize: 12, fontWeight: 800,
            color: produto.esgotado ? '#9ca3af' : inCart ? 'white' : '#78350f',
            display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
            boxShadow: produto.esgotado ? 'none' : inCart ? '0 3px 10px rgba(22,163,74,.4)' : '0 3px 10px rgba(245,158,11,.4)',
            transform: isPressing && !produto.esgotado ? 'scale(0.95)' : 'scale(1)',
            transition: 'all 0.2s', cursor: produto.esgotado ? 'not-allowed' : 'pointer'
          }}
        >
          {produto.esgotado ? 'Esgotado' : inCart ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg> Adicionado
            </>
          ) : (
            <>Adicionar <span>+</span></>
          )}
        </button>
      </div>
    </div>
  )
}
