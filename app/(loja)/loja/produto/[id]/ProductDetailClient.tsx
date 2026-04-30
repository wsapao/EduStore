'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import type { Produto, Aluno, ProdutoVariante } from '@/types/database'
import { useCart } from '@/components/loja/CartProvider'

const CAT_THEMES: Record<string, { bg: string, text: string }> = {
  eventos:        { bg: 'linear-gradient(135deg,#a855f7,#7e22ce)', text: '#7e22ce' },
  passeios:       { bg: 'linear-gradient(135deg,#0ea5e9,#0284c7)', text: '#0369a1' },
  segunda_chamada:{ bg: 'linear-gradient(135deg,#fbbf24,#d97706)', text: '#d97706' },
  materiais:      { bg: 'linear-gradient(135deg,#10b981,#047857)', text: '#047857' },
  uniforme:       { bg: 'linear-gradient(135deg,#f43f5e,#be123c)', text: '#be123c' },
  outros:         { bg: 'linear-gradient(135deg,#64748b,#334155)', text: '#334155' },
}

const DEFAULT_ICONS: Record<string, string> = {
  eventos:'🎉', passeios:'🚌', segunda_chamada:'📝',
  materiais:'📚', uniforme:'👕', outros:'📦',
}

interface Props {
  produto: Produto
  variantesDetalhadas: ProdutoVariante[]
  alunos: Aluno[]
  initialAlunoId: string | null
}

export function ProductDetailClient({ produto, variantesDetalhadas, alunos, initialAlunoId }: Props) {
  const router = useRouter()
  const { add, remove, hasItem, open } = useCart()
  const [selectedAlunoId, setSelectedAlunoId] = useState(initialAlunoId)
  const primeiraVarianteDisponivel = variantesDetalhadas.length > 0
    ? (variantesDetalhadas.find((variante) => variante.disponivel && (variante.estoque === null || variante.estoque > 0))?.nome ?? null)
    : (produto.variantes?.[0] ?? null)
  const [selectedVariante, setSelectedVariante] = useState<string | null>(primeiraVarianteDisponivel)

  const selectedAluno = alunos.find(a => a.id === selectedAlunoId) ?? alunos[0] ?? null
  const exigeVariante = !!produto.variantes?.length
  const selectedVarianteDetalhe = variantesDetalhadas.find((variante) => variante.nome === selectedVariante) ?? null
  const varianteDisponivel = !selectedVarianteDetalhe || (
    selectedVarianteDetalhe.disponivel && (selectedVarianteDetalhe.estoque === null || selectedVarianteDetalhe.estoque > 0)
  )
  const inCart = selectedAluno ? hasItem(produto.id, selectedAluno.id, selectedVariante) : false

  const theme = CAT_THEMES[produto.categoria] ?? CAT_THEMES.outros
  const icon = produto.icon ?? DEFAULT_ICONS[produto.categoria] ?? '📦'

  function handleToggleCart() {
    if (!selectedAluno) return
    if (exigeVariante && (!selectedVariante || !varianteDisponivel)) return
    if (inCart) {
      remove(`${produto.id}__${selectedAluno.id}__${selectedVariante ?? 'sem-variante'}`)
    } else {
      add(produto, selectedAluno, selectedVarianteDetalhe?.id ?? null, selectedVariante)
      open()
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day:'numeric', month:'long', year:'numeric'
    })
  }

  const isUrgent = produto.prazo_compra && Math.ceil((new Date(produto.prazo_compra).getTime() - Date.now()) / 86400000) <= 4

  return (
    <div style={{ background: '#0a1220', minHeight: '100vh', paddingBottom: 100 }}>
      {/* Wrapper no style original de phone frame */}
      <div style={{ background: '#f0f2f8', minHeight: '100vh', display: 'flex', flexDirection: 'column', paddingBottom: 80 }}>
        
        {/* Hero */}
        <div style={{
          height: 170, background: theme.bg, position: 'relative', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.1) 1px, transparent 1px)',
            backgroundSize: '18px 18px'
          }} />
          
          <button 
            onClick={() => router.back()} 
            style={{
              position: 'absolute', top: 12, left: 12, width: 32, height: 32, borderRadius: 10,
              background: 'rgba(0,0,0,.25)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', zIndex: 2, cursor: 'pointer'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>

          {produto.imagem_url ? (
            <Image src={produto.imagem_url} alt={produto.nome} fill sizes="100vw" style={{ objectFit: 'cover' }} priority />
          ) : (
            <span style={{ fontSize: 56, filter: 'drop-shadow(0 5px 14px rgba(0,0,0,.25))', position: 'relative', zIndex: 1 }}>
              {icon}
            </span>
          )}

          {isUrgent && (
            <div style={{
              position: 'absolute', top: 12, right: 12, fontSize: 8, fontWeight: 800, padding: '3px 7px',
              borderRadius: 99, background: 'rgba(220,38,38,.75)', color: 'white', letterSpacing: '.04em', backdropFilter: 'blur(8px)'
            }}>
              ⏰ Termina logo!
            </div>
          )}

          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 50, background: 'linear-gradient(to top, white, transparent)' }} />
        </div>

        {/* Body */}
        <div style={{ padding: '6px 14px 0', background: 'white', flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: theme.text, marginBottom: 4 }}>
            {produto.categoria.replace('_', ' ')}
          </div>
          <div style={{ fontSize: 19, fontWeight: 900, color: '#0a1628', letterSpacing: '-.03em', lineHeight: 1.2, marginBottom: 6 }}>
            {produto.nome}
          </div>
          {produto.descricao && (
            <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.7, marginBottom: 12 }}>
              {produto.descricao}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 12 }}>
            {produto.data_evento && (
              <div style={{ background: '#f8f9fd', border: '1px solid rgba(0,0,0,.07)', borderRadius: 11, padding: '9px 11px' }}>
                <div style={{ fontSize: 14, marginBottom: 3 }}>📅</div>
                <div style={{ fontSize: 9, fontWeight: 600, color: '#9ca3af', marginBottom: 1 }}>Data do evento</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0a1628', lineHeight: 1.3 }}>{formatDate(produto.data_evento)}</div>
              </div>
            )}
            {produto.prazo_compra && (
              <div style={{
                background: isUrgent ? '#fef2f2' : '#f8f9fd', border: `1px solid ${isUrgent ? '#fecaca' : 'rgba(0,0,0,.07)'}`,
                borderRadius: 11, padding: '9px 11px'
              }}>
                <div style={{ fontSize: 14, marginBottom: 3 }}>⏰</div>
                <div style={{ fontSize: 9, fontWeight: 600, color: '#9ca3af', marginBottom: 1 }}>Prazo de compra</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: isUrgent ? '#dc2626' : '#0a1628', lineHeight: 1.3 }}>
                  {formatDate(produto.prazo_compra)}
                </div>
              </div>
            )}
            {produto.max_parcelas > 1 && (
              <div style={{ background: '#f8f9fd', border: '1px solid rgba(0,0,0,.07)', borderRadius: 11, padding: '9px 11px' }}>
                <div style={{ fontSize: 14, marginBottom: 3 }}>💳</div>
                <div style={{ fontSize: 9, fontWeight: 600, color: '#9ca3af', marginBottom: 1 }}>Parcelamento</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0a1628', lineHeight: 1.3 }}>Até {produto.max_parcelas}x sem juros</div>
              </div>
            )}
            {produto.series && produto.series.length > 0 && (
              <div style={{ background: '#f8f9fd', border: '1px solid rgba(0,0,0,.07)', borderRadius: 11, padding: '9px 11px' }}>
                <div style={{ fontSize: 14, marginBottom: 3 }}>🎓</div>
                <div style={{ fontSize: 9, fontWeight: 600, color: '#9ca3af', marginBottom: 1 }}>Turmas</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0a1628', lineHeight: 1.3 }}>{produto.series.join(', ')}</div>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>
              Formas de pagamento
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              <div style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: '#d1fae5', color: '#065f46' }}>⚡ PIX</div>
              <div style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: '#dbeafe', color: '#1e40af' }}>💳 Cartão</div>
            </div>
          </div>

          {variantesDetalhadas.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>
                Tamanho / Variação
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {variantesDetalhadas.map((variante) => {
                  const isSelected = variante.nome === selectedVariante
                  const disabled = !variante.disponivel || variante.estoque === 0
                  return (
                    <button
                      key={variante.id}
                      onClick={() => !disabled && setSelectedVariante(variante.nome)}
                      disabled={disabled}
                      style={{
                        minWidth: 46, padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 800, textAlign: 'center', cursor: disabled ? 'not-allowed' : 'pointer',
                        border: isSelected ? '2px solid #f59e0b' : '2px solid rgba(0,0,0,.08)',
                        background: disabled ? 'rgba(0,0,0,.04)' : isSelected ? '#fef9ec' : 'white',
                        color: disabled ? '#9ca3af' : isSelected ? '#b45309' : '#0a1628',
                        boxShadow: isSelected ? '0 2px 8px rgba(245,158,11,.3)' : 'none',
                        opacity: disabled ? 0.6 : 1
                      }}
                    >
                      {variante.nome}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {alunos.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>
                Para qual filho?
              </div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }} className="no-scrollbar">
                {alunos.map((aluno) => {
                  const isSelected = aluno.id === selectedAlunoId
                  const initials = aluno.nome.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase()
                  const hexColor = aluno.cor ?? '#6366f1'
                  return (
                    <button 
                      key={aluno.id} 
                      onClick={() => setSelectedAlunoId(aluno.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 7, padding: '7px 11px', borderRadius: 12, flexShrink: 0, cursor: 'pointer',
                        border: isSelected ? `2px solid ${hexColor}` : '2px solid rgba(0,0,0,.08)',
                        background: isSelected ? `${hexColor}15` : 'white',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: hexColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: 'white' }}>
                        {initials}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#0a1628' }}>{aluno.nome.split(' ')[0]}</div>
                        <div style={{ fontSize: 9, color: '#9ca3af' }}>{aluno.serie}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid rgba(0,0,0,.07)', padding: '12px 14px 14px', display: 'flex', alignItems: 'center', gap: 12,
          position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(255,255,255,.98)', backdropFilter: 'blur(16px)', zIndex: 50
        }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 600, color: '#9ca3af', marginBottom: 1 }}>Valor total</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#0a1628', letterSpacing: '-.04em', lineHeight: 1 }}>
              {(produto.preco_promocional ?? produto.preco).toLocaleString('pt-BR', { style:'currency', currency:'BRL' })}
            </div>
          </div>
          <button
            onClick={handleToggleCart}
            disabled={produto.esgotado || !selectedAluno || (exigeVariante && (!selectedVariante || !varianteDisponivel))}
            style={{
              height: 46, padding: '0 14px', borderRadius: 12, fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, flex: 1, border: 'none', cursor: 'pointer',
              background: produto.esgotado || !selectedAluno || (exigeVariante && (!selectedVariante || !varianteDisponivel)) ? '#e5e7eb' : inCart ? '#16a34a' : '#f59e0b',
              color: produto.esgotado || !selectedAluno || (exigeVariante && (!selectedVariante || !varianteDisponivel)) ? '#9ca3af' : inCart ? 'white' : '#78350f',
              boxShadow: produto.esgotado || !selectedAluno || (exigeVariante && (!selectedVariante || !varianteDisponivel)) ? 'none' : inCart ? '0 3px 10px rgba(22,163,74,.4)' : '0 3px 10px rgba(245,158,11,.4)'
            }}
          >
            {inCart ? 'No carrinho' : produto.esgotado ? 'Esgotado' : exigeVariante && !selectedVariante ? 'Escolha o tamanho' : exigeVariante && !varianteDisponivel ? 'Sem estoque' : 'Adicionar ao carrinho'}
          </button>
        </div>
      </div>
    </div>
  )
}
