'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Produto, Aluno } from '@/types/database'
import { useCart } from './CartProvider'

// ── Category styles ───────────────────────────────────────────────────────────

const CAT_BG: Record<string, string> = {
  eventos:        'linear-gradient(135deg,#ede9fe,#ddd6fe)',
  passeios:       'linear-gradient(135deg,#d1fae5,#a7f3d0)',
  segunda_chamada:'linear-gradient(135deg,#fef3c7,#fde68a)',
  materiais:      'linear-gradient(135deg,#dbeafe,#bfdbfe)',
  uniforme:       'linear-gradient(135deg,#fce7f3,#fbcfe8)',
  outros:         'linear-gradient(135deg,#f3f4f6,#e5e7eb)',
}

const DEFAULT_ICONS: Record<string, string> = {
  eventos:        '🎉',
  passeios:       '🚌',
  segunda_chamada:'📝',
  materiais:      '📚',
  uniforme:       '👕',
  outros:         '📦',
}

const METODO_STYLES: Record<string, React.CSSProperties> = {
  pix:    { color:'#047857', background:'#d1fae5', borderColor:'#a7f3d0' },
  cartao: { color:'#1e40af', background:'#dbeafe', borderColor:'#bfdbfe' },
  boleto: { color:'#78350f', background:'#fef3c7', borderColor:'#fde68a' },
}
const METODO_LABELS: Record<string, string> = { pix:'PIX', cartao:'Cartão', boleto:'Boleto' }

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day:'numeric', month:'short' })
}

function isUrgent(prazo: string | null) {
  if (!prazo) return false
  const diff = (new Date(prazo).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return diff >= 0 && diff <= 3
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  produto: Produto
  aluno: Aluno
  index?: number
  vagasRestantes?: number | null  // null = sem limite, número = vagas sobrando
}

export function ProductCard({ produto, aluno, index = 0, vagasRestantes }: Props) {
  const { add, remove, hasItem } = useCart()
  const router = useRouter()
  const [justAdded, setJustAdded] = useState(false)
  const exigeVariante = !!produto.variantes?.length
  const inCart = !exigeVariante && hasItem(produto.id, aluno.id)
  const icon = produto.icon ?? DEFAULT_ICONS[produto.categoria] ?? '📦'
  const bg = CAT_BG[produto.categoria] ?? CAT_BG.outros
  const urgent = isUrgent(produto.prazo_compra)

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
      setJustAdded(true)
      setTimeout(() => setJustAdded(false), 1800)
    }
  }

  return (
    <div
      onClick={() => router.push(`/loja/produto/${produto.id}?aluno=${aluno.id}`)}
      style={{
        background:'var(--surface)', borderRadius:'var(--r-lg)', overflow:'hidden',
        border: `1.5px solid ${inCart ? 'var(--accent)' : 'var(--border)'}`,
        boxShadow: inCart ? '0 0 0 3px var(--accent-glow), var(--shadow-sm)' : 'var(--shadow-xs)',
        display:'flex', flexDirection:'column', cursor:'pointer',
        transition:'all .25s var(--ease)', position:'relative',
        opacity: produto.esgotado ? .55 : 1,
        pointerEvents: produto.esgotado ? 'none' : 'auto',
        animation:`fade-up .4s var(--ease) ${index * 0.05}s both`,
      }}
      onMouseEnter={e => {
        if (!produto.esgotado) {
          const el = e.currentTarget as HTMLElement
          el.style.borderColor = 'var(--accent)'
          el.style.boxShadow = '0 0 0 3px var(--accent-glow), var(--shadow-md)'
          el.style.transform = 'translateY(-2px)'
        }
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = inCart ? 'var(--accent)' : 'var(--border)'
        el.style.boxShadow = inCart ? '0 0 0 3px var(--accent-glow), var(--shadow-sm)' : 'var(--shadow-xs)'
        el.style.transform = 'translateY(0)'
      }}
    >
      {/* Card top — colored header */}
      <div style={{
        height:80, display:'flex', alignItems:'center', justifyContent:'center',
        background: bg, position:'relative', overflow:'hidden',
      }}>
        {/* Badges */}
        <div style={{ position:'absolute', top:8, left:8, display:'flex', flexDirection:'column', gap:4, zIndex:2 }}>
          {produto.esgotado && <Badge variant="esgotado">Esgotado</Badge>}
          {!produto.esgotado && urgent && <Badge variant="urgente">Urgente</Badge>}
          {!produto.esgotado && vagasRestantes !== null && vagasRestantes !== undefined && vagasRestantes <= 10 && (
            <Badge variant={vagasRestantes <= 3 ? 'urgente' : 'vagas'}>
              {vagasRestantes === 0 ? 'Última vaga!' : `${vagasRestantes} vagas`}
            </Badge>
          )}
        </div>

        <span style={{
          fontSize:32, position:'relative', zIndex:1,
          filter:'drop-shadow(0 2px 4px rgba(0,0,0,.15))',
        }}>
          {icon}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding:'12px 14px', flex:1, display:'flex', flexDirection:'column', gap:6 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'var(--text-1)', lineHeight:1.3, letterSpacing:'-.01em' }}>
          {produto.nome}
        </div>
        {produto.descricao && (
          <div style={{
            fontSize:11, color:'var(--text-3)', lineHeight:1.5, fontWeight:500, flex:1,
            display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden',
          }}>
            {produto.descricao}
          </div>
        )}

        {/* Meta tags */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:2 }}>
          {produto.variantes && produto.variantes.length > 0 && (
            <MetaTag>
              <ShirtIcon />
              {produto.variantes.length} tamanhos
            </MetaTag>
          )}
          {produto.data_evento && (
            <MetaTag>
              <CalendarIcon />
              {formatDate(produto.data_evento)}
            </MetaTag>
          )}
          {produto.prazo_compra && (
            <MetaTag urgent={urgent}>
              <ClockIcon />
              Prazo {formatDate(produto.prazo_compra)}
            </MetaTag>
          )}
        </div>
      </div>

      {/* Payment methods */}
      {produto.metodos_aceitos?.length > 0 && (
        <div style={{ display:'flex', gap:4, padding:'0 14px 10px', flexWrap:'wrap' }}>
          {produto.metodos_aceitos.map(m => (
            <span key={m} style={{
              fontSize:9, fontWeight:700, borderRadius:'var(--r-pill)',
              padding:'2px 7px', border:'1px solid',
              ...METODO_STYLES[m],
            }}>
              {METODO_LABELS[m]}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{
        padding:'10px 14px 14px', display:'flex',
        alignItems:'center', justifyContent:'space-between', gap:8,
        borderTop:'1px solid var(--border)',
      }}>
        <div style={{ fontSize:17, fontWeight:800, color:'var(--text-1)', letterSpacing:'-.02em' }}>
          <span style={{ fontSize:10, fontWeight:600, color:'var(--text-3)', verticalAlign:'super', marginRight:1 }}>R$</span>
          {Math.floor(produto.preco).toLocaleString('pt-BR')}
          {produto.preco % 1 !== 0 && (
            <span style={{ fontSize:12 }}>,{String(Math.round((produto.preco % 1) * 100)).padStart(2,'0')}</span>
          )}
        </div>

        <button
          onClick={handleAdd}
          disabled={produto.esgotado}
          title={inCart ? 'Remover do carrinho' : 'Adicionar ao carrinho'}
          style={{
            width:34, height:34, borderRadius:'50%',
            background: inCart ? 'var(--success)' : 'var(--brand)',
            border:'none', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            transition:'all .2s var(--spring)', flexShrink:0,
            boxShadow: inCart ? '0 2px 8px rgba(16,185,129,.35)' : '0 2px 8px rgba(26,47,90,.3)',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.12)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
        >
          {justAdded || inCart ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          ) : exigeVariante ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Badge({ variant, children }: { variant: 'urgente'|'esgotado'|'novo'|'vagas'; children: React.ReactNode }) {
  const styles: Record<string, React.CSSProperties> = {
    urgente:  { background:'var(--danger)', color:'white' },
    esgotado: { background:'var(--text-2)', color:'white' },
    novo:     { background:'var(--accent)',  color:'white' },
    vagas:    { background:'#f59e0b', color:'white' },
  }
  return (
    <span style={{
      fontSize:9, fontWeight:800, textTransform:'uppercase',
      letterSpacing:'.04em', padding:'3px 7px', borderRadius:'var(--r-pill)',
      lineHeight:1.4, ...styles[variant],
    }}>
      {children}
    </span>
  )
}

function MetaTag({ children, urgent }: { children: React.ReactNode; urgent?: boolean }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      fontSize:10, fontWeight:600,
      color: urgent ? 'var(--danger)' : 'var(--text-3)',
      background: urgent ? 'var(--danger-light)' : 'var(--surface-2)',
      borderRadius:'var(--r-pill)', padding:'3px 8px',
      border:`1px solid ${urgent ? '#fecaca' : 'var(--border)'}`,
    }}>
      {children}
    </span>
  )
}

function CalendarIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  )
}

function ShirtIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3l5 4-3 5v8a1 1 0 01-1 1H7a1 1 0 01-1-1v-8L3 7l5-4 2 3h4l2-3z"/>
    </svg>
  )
}
