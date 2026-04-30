'use client'

import React, { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { buscarAlunoCantinaAction, confirmarCompraCantinaAction } from '@/app/actions/cantina'
import type { CantinaProduto } from '@/types/database'

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface CartItem {
  produto: CantinaProduto
  quantidade: number
}

// Interfaces baseadas no que a query do Supabase retorna
interface AlunoResult {
  id: string
  nome: string
  serie: string
  turma: string | null
  cantina_carteiras: { id: string; saldo: number; limite_diario: number | null; ativo: boolean; bloqueio_motivo: string | null; has_pin?: boolean; nfc_id?: string | null }[] | null
  cantina_restricoes: { produto_id: string; motivo: string | null }[] | null
}

export function PDVClient({ produtos }: { produtos: CantinaProduto[] }) {
  const router = useRouter()

  // Estado do Carrinho
  const [cart, setCart] = useState<CartItem[]>([])

  // Estado da Busca de Aluno
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, startSearchTransition] = useTransition()
  const [searchResults, setSearchResults] = useState<AlunoResult[]>([])
  const [selectedAluno, setSelectedAluno] = useState<AlunoResult | null>(null)

  // Estado do Checkout
  const [isFinalizing, startFinalizeTransition] = useTransition()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPinModal, setShowPinModal] = useState(false)
  const [pinInput, setPinInput] = useState('')

  // Agrupar produtos por categoria
  const categorias = useMemo(() => {
    const cats = Array.from(new Set(produtos.map(p => p.categoria)))
    return cats.sort()
  }, [produtos])

  const [activeCategory, setActiveCategory] = useState<string>(categorias[0] ?? '')

  const produtosAtivos = useMemo(() => {
    return produtos.filter(p => p.categoria === activeCategory)
  }, [produtos, activeCategory])

  const totalCart = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.produto.preco * item.quantidade, 0)
  }, [cart])

  const restricoesSet = useMemo(() => {
    if (!selectedAluno || !selectedAluno.cantina_restricoes) return new Set<string>()
    return new Set(selectedAluno.cantina_restricoes.map(r => r.produto_id))
  }, [selectedAluno])

  const carteira = selectedAluno?.cantina_carteiras?.[0]

  function handleSearch(q: string) {
    setSearchQuery(q)
    if (!q.trim()) {
      setSearchResults([])
      return
    }
    startSearchTransition(async () => {
      const res = await buscarAlunoCantinaAction(q)
      if (res.data) {
        setSearchResults(res.data as unknown as AlunoResult[])
      }
    })
  }

  function handleAddToCart(p: CantinaProduto) {
    if (restricoesSet.has(p.id)) return // Bloqueado

    setCart(prev => {
      const existing = prev.find(i => i.produto.id === p.id)
      if (existing) {
        return prev.map(i => i.produto.id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i)
      }
      return [...prev, { produto: p, quantidade: 1 }]
    })
  }

  function handleRemoveOne(pId: string) {
    setCart(prev => {
      return prev.map(i => {
        if (i.produto.id === pId) {
          return { ...i, quantidade: i.quantidade - 1 }
        }
        return i
      }).filter(i => i.quantidade > 0)
    })
  }

  function clearCart() {
    setCart([])
    setError('')
    setSuccess('')
    setPinInput('')
    setShowPinModal(false)
  }

  function clearAluno() {
    setSelectedAluno(null)
    setSearchQuery('')
    setSearchResults([])
    setError('')
    setSuccess('')
    setPinInput('')
    setShowPinModal(false)
  }

  function handleFinalize() {
    if (!selectedAluno) {
      setError('Selecione um aluno para debitar o saldo.')
      return
    }
    if (!carteira) {
      setError('Este aluno não possui carteira digital ativa.')
      return
    }
    if (!carteira.ativo) {
      setError(`Carteira bloqueada: ${carteira.bloqueio_motivo || 'Motivo não especificado'}`)
      return
    }
    if (carteira.saldo < totalCart) {
      setError('Saldo insuficiente.')
      return
    }
    // TODO: Considerar limite_diario

    if (carteira.has_pin && !pinInput && !showPinModal) {
      setShowPinModal(true)
      return
    }

    setError('')
    setSuccess('')
    startFinalizeTransition(async () => {
      const res = await confirmarCompraCantinaAction(
        selectedAluno.id,
        cart.map(c => ({ produto_id: c.produto.id, quantidade: c.quantidade, preco_unitario: c.produto.preco })),
        carteira.has_pin ? pinInput : undefined
      )

      if (!res.success) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((res as any).requiresPin) {
          setShowPinModal(true)
          setPinInput('')
        }
        setError(res.error || 'Erro ao processar venda.')
      } else {
        setShowPinModal(false)
        setPinInput('')
        setSuccess(`Venda #${res.numero} confirmada! Novo saldo: ${fmtBRL(res.saldo_apos ?? 0)}`)
        setCart([])
        // Limpar o aluno após 3 segundos para próximo atendimento, ou deixar na tela
        setTimeout(() => {
          setSuccess('')
          clearAluno()
        }, 3000)
      }
    })
  }

  return (
    <div style={{ display: 'flex', height: '100%', backgroundColor: '#f1f5f9' }}>
      
      {/* Esquerda: Produtos e Categorias */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* Header de Categorias */}
        <div style={{ 
          padding: '16px 24px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0',
          display: 'flex', gap: 12, overflowX: 'auto', flexShrink: 0
        }}>
          {categorias.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '10px 20px', borderRadius: 999, border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap',
                backgroundColor: activeCategory === cat ? '#0f172a' : '#f8fafc',
                color: activeCategory === cat ? 'white' : '#64748b',
                boxShadow: activeCategory === cat ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid de Produtos */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
            gap: 16 
          }}>
            {produtosAtivos.map(p => {
              const restricted = restricoesSet.has(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => handleAddToCart(p)}
                  disabled={restricted}
                  style={{
                    backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: 16,
                    padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: 12, cursor: restricted ? 'not-allowed' : 'pointer',
                    opacity: restricted ? 0.4 : 1, transition: 'all 0.2s',
                    position: 'relative', overflow: 'hidden',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                  }}
                  onMouseOver={(e) => {
                    if (!restricted) e.currentTarget.style.borderColor = '#94a3b8'
                  }}
                  onMouseOut={(e) => {
                    if (!restricted) e.currentTarget.style.borderColor = '#e2e8f0'
                  }}
                >
                  <div style={{ fontSize: 40, marginTop: 10 }}>{p.icone}</div>
                  <div style={{ width: '100%', textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 4, lineHeight: 1.2 }}>{p.nome}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#059669' }}>{fmtBRL(p.preco)}</div>
                  </div>
                  {restricted && (
                    <div style={{ 
                      position: 'absolute', top: 12, right: 12, 
                      backgroundColor: '#fee2e2', color: '#dc2626', 
                      width: 24, height: 24, borderRadius: '50%', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 'bold', fontSize: 14
                    }}>✕</div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Direita: Carrinho e Checkout */}
      <div style={{ 
        width: 380, backgroundColor: 'white', borderLeft: '1px solid #e2e8f0',
        display: 'flex', flexDirection: 'column', flexShrink: 0
      }}>
        {/* Identificação do Aluno */}
        <div style={{ padding: 20, borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
          {selectedAluno ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                  Aluno Identificado
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{selectedAluno.nome}</div>
                <div style={{ fontSize: 13, color: '#64748b' }}>{selectedAluno.serie}</div>
                
                {carteira ? (
                  <div style={{ marginTop: 12, padding: '8px 12px', backgroundColor: carteira.ativo ? '#ecfdf5' : '#fef2f2', borderRadius: 8, display: 'inline-block' }}>
                    <div style={{ fontSize: 11, color: carteira.ativo ? '#065f46' : '#991b1b', fontWeight: 600 }}>SALDO DISPONÍVEL</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: carteira.ativo ? '#047857' : '#b91c1c' }}>
                      {fmtBRL(carteira.saldo)}
                    </div>
                    {!carteira.ativo && (
                      <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 700, marginTop: 4 }}>
                        Bloqueado: {carteira.bloqueio_motivo || 'Sem motivo'}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ marginTop: 12, fontSize: 12, color: '#ef4444', fontWeight: 600 }}>
                    Aluno sem carteira digital ativa.
                  </div>
                )}
              </div>
              <button 
                onClick={clearAluno}
                style={{ 
                  background: 'none', border: 'none', color: '#94a3b8', 
                  cursor: 'pointer', fontSize: 24, padding: 4 
                }}
              >×</button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Identificar aluno (nome)..."
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 12,
                  border: '1.5px solid #cbd5e1', fontSize: 14, outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              {isSearching && (
                <div style={{ position: 'absolute', right: 16, top: 14, fontSize: 12, color: '#94a3b8' }}>Buscando...</div>
              )}
              
              {searchResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 8,
                  backgroundColor: 'white', borderRadius: 12, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #e2e8f0', zIndex: 10, maxHeight: 300, overflowY: 'auto'
                }}>
                  {searchResults.map(aluno => (
                    <button
                      key={aluno.id}
                      onClick={() => {
                        setSelectedAluno(aluno)
                        setSearchQuery('')
                        setSearchResults([])
                        setError('')
                        setSuccess('')
                      }}
                      style={{
                        width: '100%', padding: '12px 16px', border: 'none', borderBottom: '1px solid #f1f5f9',
                        backgroundColor: 'white', textAlign: 'left', cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', gap: 2
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{aluno.nome}</span>
                      <span style={{ fontSize: 12, color: '#64748b' }}>{aluno.serie}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Itens do Carrinho */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {cart.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              <span style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>🛒</span>
              <span style={{ fontSize: 14, fontWeight: 500 }}>Carrinho vazio</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {cart.map(item => (
                <div key={item.produto.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ 
                      width: 40, height: 40, backgroundColor: '#f1f5f9', borderRadius: 8, 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 
                    }}>{item.produto.icone}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{item.produto.nome}</div>
                      <div style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>{fmtBRL(item.produto.preco)}</div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, backgroundColor: '#f8fafc', borderRadius: 8, padding: '4px 8px', border: '1px solid #e2e8f0' }}>
                    <button 
                      onClick={() => handleRemoveOne(item.produto.id)}
                      style={{ background: 'none', border: 'none', fontSize: 16, color: '#64748b', cursor: 'pointer', padding: '0 4px' }}
                    >−</button>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', minWidth: 16, textAlign: 'center' }}>{item.quantidade}</span>
                    <button 
                      onClick={() => handleAddToCart(item.produto)}
                      style={{ background: 'none', border: 'none', fontSize: 16, color: '#64748b', cursor: 'pointer', padding: '0 4px' }}
                    >+</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer do Checkout */}
        <div style={{ padding: 24, borderTop: '1px solid #e2e8f0', backgroundColor: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Total</span>
            <span style={{ fontSize: 32, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{fmtBRL(totalCart)}</span>
          </div>

          {error && (
            <div style={{ backgroundColor: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ backgroundColor: '#ecfdf5', color: '#047857', padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
              {success}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <button 
              onClick={clearCart}
              disabled={cart.length === 0 || isFinalizing}
              style={{ 
                padding: '0 20px', height: 56, borderRadius: 12, border: '1.5px solid #e2e8f0', 
                backgroundColor: 'white', color: '#64748b', fontWeight: 700, fontSize: 15,
                cursor: cart.length === 0 ? 'not-allowed' : 'pointer', opacity: cart.length === 0 ? 0.5 : 1
              }}
            >
              Limpar
            </button>
            <button 
              onClick={handleFinalize}
              disabled={cart.length === 0 || isFinalizing}
              style={{ 
                flex: 1, height: 56, borderRadius: 12, border: 'none', 
                backgroundColor: cart.length === 0 ? '#94a3b8' : '#059669', 
                color: 'white', fontWeight: 800, fontSize: 16,
                cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                boxShadow: cart.length > 0 ? '0 4px 14px -2px rgba(5, 150, 105, 0.4)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
              }}
            >
              {isFinalizing ? 'Processando...' : 'Cobrar Saldo'}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Validação de PIN */}
      {showPinModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: 24, width: 320, padding: 24,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            display: 'flex', flexDirection: 'column', alignItems: 'center'
          }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>Digite a Senha</h3>
            <p style={{ fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 24 }}>
              Esta carteira requer a senha de 4 dígitos para autorizar a compra.
            </p>

            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{
                  width: 48, height: 56, borderRadius: 12, border: '2px solid #e2e8f0',
                  backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, fontWeight: 800, color: '#0f172a',
                  borderColor: pinInput.length === i ? '#6366f1' : '#e2e8f0',
                }}>
                  {pinInput[i] ? '•' : ''}
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, width: '100%', marginBottom: 24 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'OK'].map(key => (
                <button
                  key={key}
                  onClick={() => {
                    if (key === 'C') setPinInput('')
                    else if (key === 'OK') handleFinalize()
                    else if (pinInput.length < 4) setPinInput(p => p + key)
                  }}
                  style={{
                    height: 56, borderRadius: 16, border: 'none',
                    backgroundColor: key === 'OK' ? '#0f172a' : key === 'C' ? '#fef2f2' : '#f1f5f9',
                    color: key === 'OK' ? 'white' : key === 'C' ? '#ef4444' : '#1e293b',
                    fontSize: typeof key === 'number' ? 24 : 16,
                    fontWeight: 800, cursor: 'pointer',
                    boxShadow: key === 'OK' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
                  }}
                >
                  {key}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setShowPinModal(false)
                setPinInput('')
              }}
              style={{
                background: 'none', border: 'none', color: '#64748b',
                fontSize: 14, fontWeight: 600, cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
