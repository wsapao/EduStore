'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import type { Produto, Aluno, ProdutoVariante } from '@/types/database'
import { useCart } from '@/components/loja/CartProvider'

const CAT_BG: Record<string, string> = {
  eventos:        'linear-gradient(135deg,#ede9fe,#ddd6fe)',
  passeios:       'linear-gradient(135deg,#d1fae5,#a7f3d0)',
  segunda_chamada:'linear-gradient(135deg,#fef3c7,#fde68a)',
  materiais:      'linear-gradient(135deg,#dbeafe,#bfdbfe)',
  uniforme:       'linear-gradient(135deg,#fce7f3,#fbcfe8)',
  outros:         'linear-gradient(135deg,#f3f4f6,#e5e7eb)',
}

const DEFAULT_ICONS: Record<string, string> = {
  eventos:'🎉', passeios:'🚌', segunda_chamada:'📝',
  materiais:'📚', uniforme:'👕', outros:'📦',
}

const METODO_STYLES: Record<string, React.CSSProperties> = {
  pix:    { color:'#047857', background:'#d1fae5', borderColor:'#a7f3d0' },
  cartao: { color:'#1e40af', background:'#dbeafe', borderColor:'#bfdbfe' },
  boleto: { color:'#78350f', background:'#fef3c7', borderColor:'#fde68a' },
}
const METODO_LABELS: Record<string, string> = { pix:'PIX', cartao:'Cartão', boleto:'Boleto' }

const AVATAR_COLORS = [
  'linear-gradient(135deg,#667eea,#764ba2)',
  'linear-gradient(135deg,#f093fb,#f5576c)',
  'linear-gradient(135deg,#4facfe,#00f2fe)',
  'linear-gradient(135deg,#43e97b,#38f9d7)',
]

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

  const bg = CAT_BG[produto.categoria] ?? CAT_BG.outros
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
      weekday:'long', day:'numeric', month:'long', year:'numeric',
    })
  }

  return (
    <div style={{ maxWidth:560, margin:'0 auto', padding:'20px 20px 40px' }}>
      {/* Back */}
      <button onClick={() => router.back()} style={{
        display:'flex', alignItems:'center', gap:6,
        background:'none', border:'none', cursor:'pointer',
        fontSize:14, fontWeight:600, color:'var(--text-3)',
        marginBottom:20, padding:0, fontFamily:'inherit',
        transition:'color .15s',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Voltar ao catálogo
      </button>

      {/* Card */}
      <div style={{
        background:'var(--surface)', borderRadius:'var(--r-xl)',
        border:'1.5px solid var(--border)', overflow:'hidden',
        boxShadow:'var(--shadow-md)', animation:'fade-up .3s var(--ease) both',
      }}>
        {/* Hero */}
        <div style={{
          height:produto.imagem_url ? 280 : 160, background: bg,
          display:'flex', alignItems:'center', justifyContent:'center',
          position:'relative', overflow: 'hidden'
        }}>
          {produto.imagem_url && (
            <Image src={produto.imagem_url} alt={produto.nome} fill sizes="(max-width: 600px) 100vw, 560px" style={{ objectFit: 'cover' }} priority />
          )}
          {produto.imagem_url && (
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top, rgba(0,0,0,0.4), transparent)' }} />
          )}
          {produto.esgotado && (
            <div style={{
              position:'absolute', top:12, left:12,
              background:'var(--text-2)', color:'white',
              fontSize:10, fontWeight:800, textTransform:'uppercase',
              letterSpacing:'.04em', padding:'4px 10px', borderRadius:'var(--r-pill)',
            }}>
              Esgotado
            </div>
          )}
          {!produto.imagem_url && (
            <span style={{ fontSize:64, filter:'drop-shadow(0 4px 8px rgba(0,0,0,.15))' }}>
              {icon}
            </span>
          )}
        </div>

        {/* Body */}
        <div style={{ padding:24 }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--text-3)', marginBottom:6 }}>
            {produto.categoria.replace('_', ' ')}
          </div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text-1)', letterSpacing:'-.02em', marginBottom:8 }}>
            {produto.nome}
          </h1>
          {produto.descricao && (
            <p style={{ fontSize:14, color:'var(--text-2)', lineHeight:1.7, marginBottom:20 }}>
              {produto.descricao}
            </p>
          )}

          {/* Details grid */}
          <div style={{
            display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20,
          }}>
            {produto.data_evento && (
              <InfoCard icon="📅" label="Data do evento" value={formatDate(produto.data_evento)} />
            )}
            {produto.prazo_compra && (
              <InfoCard icon="⏰" label="Prazo de compra" value={formatDate(produto.prazo_compra)} urgent />
            )}
            {produto.max_parcelas > 1 && (
              <InfoCard icon="💳" label="Parcelamento" value={`Até ${produto.max_parcelas}x`} />
            )}
            {produto.series && produto.series.length > 0 && (
              <InfoCard icon="🎓" label="Turmas" value={produto.series.join(', ')} />
            )}
          </div>

          {/* Payment methods */}
          {produto.metodos_aceitos?.length > 0 && (
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8 }}>
                Formas de pagamento
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {produto.metodos_aceitos.map(m => (
                  <span key={m} style={{
                    fontSize:12, fontWeight:700, borderRadius:'var(--r-pill)',
                    padding:'5px 12px', border:'1px solid',
                    ...METODO_STYLES[m],
                  }}>
                    {METODO_LABELS[m]}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Aluno selector */}
          {alunos.length > 0 && (
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>
                Para qual filho?
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {alunos.map((aluno, i) => {
                  const isSelected = aluno.id === selectedAlunoId
                  const initials = aluno.nome.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase()
                  return (
                    <button key={aluno.id} onClick={() => setSelectedAlunoId(aluno.id)} style={{
                      display:'flex', alignItems:'center', gap:8,
                      padding:'8px 12px', borderRadius:'var(--r-lg)',
                      border:`1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                      background: isSelected ? 'var(--brand-light)' : 'var(--surface)',
                      cursor:'pointer', transition:'all .15s', fontFamily:'inherit',
                      boxShadow: isSelected ? '0 0 0 3px var(--accent-glow)' : 'none',
                    }}>
                      <div style={{
                        width:28, height:28, borderRadius:'50%',
                        background: AVATAR_COLORS[i % AVATAR_COLORS.length],
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:11, fontWeight:800, color:'white', flexShrink:0,
                      }}>
                        {initials}
                      </div>
                      <div style={{ textAlign:'left' }}>
                        <div style={{ fontSize:13, fontWeight:700, color:'var(--text-1)', lineHeight:1.2 }}>
                          {aluno.nome.split(' ')[0]}
                        </div>
                        <div style={{ fontSize:11, color:'var(--text-3)' }}>{aluno.serie}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {variantesDetalhadas.length > 0 && (
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>
                Escolha o tamanho
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {variantesDetalhadas.map((variante) => {
                  const isSelected = variante.nome === selectedVariante
                  return (
                    <button
                      key={variante.id}
                      type="button"
                      onClick={() => variante.disponivel && (variante.estoque === null || variante.estoque > 0) && setSelectedVariante(variante.nome)}
                      disabled={!variante.disponivel || variante.estoque === 0}
                      style={{
                        minWidth:56, padding:'10px 14px', borderRadius:'var(--r-md)',
                        border:`1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                        background: isSelected ? 'var(--brand-light)' : 'var(--surface)',
                        color: isSelected ? 'var(--brand)' : (!variante.disponivel || variante.estoque === 0) ? 'var(--text-3)' : 'var(--text-1)',
                        fontSize:13, fontWeight:800, cursor: variante.disponivel && variante.estoque !== 0 ? 'pointer' : 'not-allowed',
                        boxShadow: isSelected ? '0 0 0 3px var(--accent-glow)' : 'none',
                        transition:'all .15s', opacity: variante.disponivel && variante.estoque !== 0 ? 1 : 0.45,
                      }}
                    >
                      {variante.nome}
                      {variante.estoque !== null && (
                        <span style={{ display:'block', fontSize:10, fontWeight:700, marginTop:3 }}>
                          {variante.estoque > 0 ? `${variante.estoque} un.` : 'Sem estoque'}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Price + CTA */}
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'20px 0 0', borderTop:'1px solid var(--border)', gap:16,
          }}>
            <div>
              <div style={{ fontSize:12, color:'var(--text-3)', fontWeight:500, marginBottom:2 }}>
                Valor
              </div>
              {produto.preco_promocional && (
                <div style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'line-through', fontWeight: 600, marginBottom: 2 }}>
                  {produto.preco.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })}
                </div>
              )}
              {selectedVariante && (
                <div style={{ fontSize:12, color:'var(--text-2)', fontWeight:700, marginBottom:4 }}>
                  Tamanho {selectedVariante}
                </div>
              )}
              {selectedVarianteDetalhe && selectedVarianteDetalhe.estoque !== null && (
                <div style={{ fontSize:11, color: varianteDisponivel ? 'var(--text-3)' : 'var(--danger)', fontWeight:700, marginBottom:4 }}>
                  {selectedVarianteDetalhe.estoque > 0 ? `${selectedVarianteDetalhe.estoque} unidade(s) disponíveis` : 'Sem estoque disponível'}
                </div>
              )}
              <div style={{ fontSize:28, fontWeight:800, color: produto.preco_promocional ? 'var(--brand)' : 'var(--text-1)', letterSpacing:'-.03em' }}>
                {(produto.preco_promocional ?? produto.preco).toLocaleString('pt-BR', { style:'currency', currency:'BRL' })}
              </div>
            </div>
            <button
              onClick={handleToggleCart}
              disabled={produto.esgotado || !selectedAluno || (exigeVariante && (!selectedVariante || !varianteDisponivel))}
              style={{
                flex:1, maxWidth:220, height:52,
                background: inCart ? 'var(--success)' : 'var(--brand)',
                color:'white', border:'none', borderRadius:'var(--r-md)',
                fontFamily:'inherit', fontSize:15, fontWeight:700,
                cursor: produto.esgotado || !selectedAluno || (exigeVariante && (!selectedVariante || !varianteDisponivel)) ? 'not-allowed' : 'pointer',
                opacity: produto.esgotado || !selectedAluno || (exigeVariante && (!selectedVariante || !varianteDisponivel)) ? .5 : 1,
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                transition:'all .2s var(--ease)',
                boxShadow: inCart ? '0 4px 14px rgba(16,185,129,.4)' : '0 4px 14px rgba(26,47,90,.35)',
              }}
            >
              {inCart ? (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  No carrinho
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                    <path d="M1 1h4l2.68 13.39a2 2 0 001.98 1.61h9.72a2 2 0 001.98-1.61L23 6H6"/>
                  </svg>
                  {produto.esgotado ? 'Esgotado' : exigeVariante && !selectedVariante ? 'Escolha o tamanho' : exigeVariante && !varianteDisponivel ? 'Sem estoque' : 'Adicionar ao carrinho'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoCard({ icon, label, value, urgent }: {
  icon: string; label: string; value: string; urgent?: boolean
}) {
  return (
    <div style={{
      background: urgent ? 'var(--danger-light)' : 'var(--surface-2)',
      border: `1px solid ${urgent ? '#fecaca' : 'var(--border)'}`,
      borderRadius:'var(--r-md)', padding:'10px 12px',
    }}>
      <div style={{ fontSize:16, marginBottom:4 }}>{icon}</div>
      <div style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', marginBottom:2 }}>{label}</div>
      <div style={{
        fontSize:12, fontWeight:700,
        color: urgent ? 'var(--danger)' : 'var(--text-1)',
        lineHeight:1.4,
      }}>
        {value}
      </div>
    </div>
  )
}
