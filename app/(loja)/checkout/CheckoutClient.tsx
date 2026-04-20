'use client'

import React, { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { usePostHog } from 'posthog-js/react'
import { useCart } from '@/components/loja/CartProvider'
import { createOrderAction } from '@/app/actions/orders'
import { validarVoucherAction } from '@/app/actions/vouchers'
import type { MetodoPagamento, Voucher } from '@/types/database'
import type { DadosCartao } from '@/lib/pagamentos/types'

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function maskCard(v: string) {
  return v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})/g, '$1 ').trim()
}

function maskValidade(v: string) {
  return v.replace(/\D/g, '').slice(0, 4).replace(/(\d{2})(\d)/, '$1/$2')
}

const METODO_LABELS: Record<MetodoPagamento, string> = {
  pix: 'PIX', cartao: 'Cartão', boleto: 'Boleto'
}

const METODO_ICONS: Record<MetodoPagamento, string> = {
  pix: '⚡', cartao: '💳', boleto: '📄'
}

const CAT_ICONS: Record<string, string> = {
  eventos:'🎉', passeios:'🚌', segunda_chamada:'📝',
  materiais:'📚', uniforme:'👕', outros:'📦',
}

// ── component ─────────────────────────────────────────────────────────────────

export function CheckoutClient() {
  const router = useRouter()
  const posthog = usePostHog()
  const { items, total, clear, hydrated } = useCart()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  // Payment method
  const metodosDisponiveis = calcIntersection(items.map(i => i.produto.metodos_aceitos))
  const [metodo, setMetodo] = useState<MetodoPagamento | null>(
    metodosDisponiveis[0] ?? null
  )

  // Card form state
  const [cartao, setCartao] = useState<DadosCartao>({
    numero: '', nome: '', validade: '', cvv: '', parcelas: 1,
  })

  // Max parcelas (minimum across cart items)
  const maxParcelas = items.reduce(
    (min, i) => Math.min(min, i.produto.max_parcelas ?? 1), 12
  )

  const navigatingToOrderRef = useRef(false)

  // Voucher state
  const [voucherCode, setVoucherCode] = useState('')
  const [appliedVoucher, setAppliedVoucher] = useState<{ voucher: Voucher, valorDesconto: number } | null>(null)
  const [voucherError, setVoucherError] = useState('')
  const [isApplyingVoucher, startVoucherTransition] = useTransition()

  // Calcula subtotal elegivel e recalcula desconto em tempo real se carrinho mudar
  const subtotalElegivel = items.filter(i => i.produto.aceita_vouchers).reduce((sum, i) => sum + (i.produto.preco_promocional ?? i.produto.preco), 0)
  const totalGeral = total - (appliedVoucher?.valorDesconto ?? 0)

  useEffect(() => {
    if (hydrated && items.length === 0 && !navigatingToOrderRef.current) router.replace('/loja')
  }, [hydrated, items.length, router])

  useEffect(() => {
    if (hydrated && items.length > 0) {
      posthog?.capture('checkout_iniciado', {
        valor_total: total,
        quantidade_items: items.length
      })
    }
  }, [hydrated]) // Run once when hydrated

  function handleApplyVoucher() {
    if (!voucherCode.trim()) return
    setVoucherError('')
    startVoucherTransition(async () => {
      const res = await validarVoucherAction(voucherCode, subtotalElegivel)
      if (res.success && res.voucher) {
        setAppliedVoucher({ voucher: res.voucher, valorDesconto: res.valorDesconto! })
      } else {
        setVoucherError(res.error || 'Erro ao validar cupom')
        setAppliedVoucher(null)
      }
    })
  }

  function handleRemoveVoucher() {
    setAppliedVoucher(null)
    setVoucherCode('')
    setVoucherError('')
  }

  if (!hydrated || items.length === 0) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:200 }}>
        <div style={{ fontSize:32, opacity:.3 }}>🛒</div>
      </div>
    )
  }

  // ── submit ──────────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!metodo) { setError('Selecione uma forma de pagamento.'); return }
    if (metodo === 'cartao') {
      if (cartao.numero.replace(/\s/g,'').length < 16) { setError('Número do cartão inválido.'); return }
      if (!cartao.nome.trim()) { setError('Informe o nome impresso no cartão.'); return }
      if (cartao.validade.length < 5) { setError('Data de validade inválida.'); return }
      if (cartao.cvv.length < 3) { setError('CVV inválido.'); return }
    }
    setError('')
    startTransition(async () => {
      const result = await createOrderAction({
        items: items.map(i => ({
          produto_id: i.produto.id,
          aluno_id: i.aluno.id,
          variante_id: i.variante_id,
          variante: i.variante,
          preco_unitario: i.produto.preco_promocional ?? i.produto.preco,
          nome: i.produto.nome,
        })),
        metodo,
        parcelas: cartao.parcelas,
        dadosCartao: metodo === 'cartao' ? cartao : undefined,
        voucher_codigo: appliedVoucher?.voucher.codigo,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      navigatingToOrderRef.current = true
      clear()
      router.push(`/pedido/${result.pedido_id}`)
    })
  }

  // ── card preview ─────────────────────────────────────────────────────────
  const cardNum = cartao.numero || '•••• •••• •••• ••••'
  const cardNome = cartao.nome || 'NOME NO CARTÃO'
  const cardVal = cartao.validade || 'MM/AA'

  return (
    <div style={{ maxWidth:560, margin:'0 auto', padding:'0 0 80px' }}>

      {/* Header */}
      <div style={{
        position:'sticky', top:0, zIndex:100,
        background:'rgba(255,255,255,.92)', backdropFilter:'blur(16px)',
        borderBottom:'1px solid var(--border)', height:60,
        padding:'0 20px', display:'flex', alignItems:'center', gap:12,
      }}>
        <button onClick={() => router.back()} style={{
          width:36, height:36, borderRadius:'var(--r-sm)',
          background:'var(--surface-2)', border:'1.5px solid var(--border)',
          display:'flex', alignItems:'center', justifyContent:'center',
          cursor:'pointer', color:'var(--text-2)', flexShrink:0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span style={{ fontSize:16, fontWeight:800, color:'var(--text-1)', letterSpacing:'-.02em', flex:1 }}>
          Finalizar Compra
        </span>
        <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, color:'var(--success)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
          Ambiente seguro
        </span>
      </div>

      <form onSubmit={handleSubmit} style={{ padding:'20px 20px 0' }}>

        {/* Resumo dos itens */}
        <SectionLabel>Resumo do pedido</SectionLabel>
        <div style={{
          background:'var(--surface)', border:'1.5px solid var(--border)',
          borderRadius:'var(--r-lg)', overflow:'hidden', boxShadow:'var(--shadow-xs)',
          marginBottom:10,
        }}>
          {items.map((item, i) => (
            <div key={item.id} style={{
              display:'flex', alignItems:'center', gap:12, padding:'14px 16px',
              borderTop: i > 0 ? '1px solid var(--border)' : 'none',
            }}>
              {item.produto.imagem_url ? (
                <div style={{
                  width:44, height:44, borderRadius:'var(--r-sm)',
                  position: 'relative', overflow: 'hidden',
                  flexShrink:0, border: '1px solid var(--border)'
                }}>
                  <Image src={item.produto.imagem_url} alt={item.produto.nome} fill sizes="44px" style={{ objectFit: 'cover' }} />
                </div>
              ) : (
                <div style={{
                  width:44, height:44, borderRadius:'var(--r-sm)',
                  background:'var(--surface-2)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:20, flexShrink:0,
                }}>
                  {item.produto.icon ?? CAT_ICONS[item.produto.categoria] ?? '📦'}
                </div>
              )}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--text-1)' }}>
                  {item.produto.nome}
                </div>
                <div style={{ fontSize:12, color:'var(--text-3)', fontWeight:500, marginTop:2 }}>
                  {item.aluno.nome.split(' ')[0]} · {item.aluno.serie}
                </div>
                {item.variante && (
                  <div style={{ fontSize:11, color:'var(--brand)', fontWeight:700, marginTop:3 }}>
                    Tamanho {item.variante}
                  </div>
                )}
              </div>
              <div style={{ fontSize:16, fontWeight:800, color:'var(--text-1)', whiteSpace:'nowrap' }}>
                {fmtBRL(item.produto.preco_promocional ?? item.produto.preco)}
              </div>
            </div>
          ))}
        </div>

        {/* Voucher */}
        <div style={{ marginBottom: 24 }}>
          {appliedVoucher ? (
            <div style={{
              background:'#f0fdf4', border:'1.5px solid #a7f3d0', borderRadius:'var(--r-md)', padding:'12px 16px',
              display:'flex', alignItems:'center', justifyContent:'space-between',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
                <span style={{ fontSize:18 }}>🎉</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#047857' }}>Cupom {appliedVoucher.voucher.codigo} aplicado</div>
                  <div style={{ fontSize:12, color:'#065f46' }}>-{fmtBRL(appliedVoucher.valorDesconto)} no pedido</div>
                </div>
              </div>
              <button type="button" onClick={handleRemoveVoucher} style={{
                background:'none', border:'none', color:'#047857', fontSize:12, fontWeight:700, cursor:'pointer', textDecoration:'underline'
              }}>Remover</button>
            </div>
          ) : (
            <div>
              <div style={{ display:'flex', gap:8 }}>
                <input
                  placeholder="Cupom de desconto"
                  value={voucherCode}
                  onChange={e => setVoucherCode(e.target.value)}
                  style={{
                    flex:1, height:46, borderRadius:'var(--r-md)', border:'1.5px solid var(--border)', background:'var(--surface)',
                    padding:'0 14px', fontFamily:'inherit', fontSize:14, color:'var(--text-1)', textTransform:'uppercase'
                  }}
                />
                <button
                  type="button"
                  onClick={handleApplyVoucher}
                  disabled={isApplyingVoucher || !voucherCode.trim()}
                  style={{
                    height:46, padding:'0 20px', background: isApplyingVoucher || !voucherCode.trim() ? '#94a3b8' : 'var(--text-1)',
                    color:'white', border:'none', borderRadius:'var(--r-md)', fontSize:13, fontWeight:700, cursor:'pointer'
                  }}
                >
                  {isApplyingVoucher ? '...' : 'Aplicar'}
                </button>
              </div>
              {voucherError && <div style={{ fontSize:12, color:'var(--danger)', fontWeight:600, marginTop:6 }}>{voucherError}</div>}
            </div>
          )}
        </div>

        {/* Total */}
        <div style={{
          background:'var(--surface)', border:'1.5px solid var(--border)',
          borderRadius:'var(--r-lg)', padding:16, marginBottom:24,
          display:'flex', flexDirection:'column', gap:8,
          boxShadow:'var(--shadow-xs)',
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, color:'var(--text-2)', fontWeight:600 }}>
            <span>Subtotal ({items.length} {items.length === 1 ? 'item' : 'itens'})</span>
            <span>{fmtBRL(total)}</span>
          </div>
          
          {appliedVoucher && (
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, color:'var(--success)', fontWeight:700 }}>
              <span>Desconto ({appliedVoucher.voucher.codigo})</span>
              <span>-{fmtBRL(appliedVoucher.valorDesconto)}</span>
            </div>
          )}
          
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', borderTop:'1px dashed var(--border)', paddingTop:8, marginTop:4 }}>
            <span style={{ fontSize:16, fontWeight:700, color:'var(--text-1)' }}>Total a Pagar</span>
            <span style={{ fontSize:28, fontWeight:800, color:'var(--text-1)', letterSpacing:'-.03em', lineHeight: 1 }}>
              {fmtBRL(Math.max(0, totalGeral))}
            </span>
          </div>
        </div>

        {/* Métodos disponíveis */}
        <SectionLabel>Forma de pagamento</SectionLabel>

        {metodosDisponiveis.length === 0 ? (
          <div style={{
            background:'var(--danger-light)', border:'1px solid #fecaca',
            borderRadius:'var(--r-md)', padding:'12px 16px',
            fontSize:13, color:'var(--danger)', fontWeight:600, marginBottom:20,
          }}>
            ⚠️ Os itens do carrinho não têm métodos de pagamento compatíveis.
          </div>
        ) : (
          <>
            {/* Info sobre restrição */}
            {metodosDisponiveis.length < 3 && (
              <div style={{
                background:'var(--brand-light)', border:'1.5px solid #c7d2fe',
                borderRadius:'var(--r-md)', padding:'12px 16px', marginBottom:16,
                fontSize:13, color:'var(--brand)', lineHeight:1.6,
              }}>
                <strong style={{
                  display:'block', fontSize:11, textTransform:'uppercase',
                  letterSpacing:'.07em', marginBottom:4,
                }}>
                  Pagamentos disponíveis para este pedido
                </strong>
                Alguns itens limitam os métodos aceitos.
                Disponível: {metodosDisponiveis.map(m => METODO_LABELS[m]).join(' · ')}
              </div>
            )}

            {/* Seletor de método */}
            <div style={{
              display:'grid', gridTemplateColumns:`repeat(${metodosDisponiveis.length}, 1fr)`,
              gap:10, marginBottom:24,
            }}>
              {(['pix','cartao','boleto'] as MetodoPagamento[]).map(m => {
                const disponivel = metodosDisponiveis.includes(m)
                const ativo = metodo === m
                return (
                  <button key={m} type="button"
                    disabled={!disponivel}
                    onClick={() => setMetodo(m)}
                    style={{
                      background: ativo ? 'var(--brand-light)' : 'var(--surface)',
                      border: `1.5px solid ${ativo ? 'var(--brand)' : 'var(--border)'}`,
                      borderRadius:'var(--r-lg)', padding:'16px 10px',
                      textAlign:'center', cursor: disponivel ? 'pointer' : 'not-allowed',
                      display:'flex', flexDirection:'column', alignItems:'center', gap:8,
                      transition:'all .2s var(--ease)', boxShadow: ativo
                        ? '0 0 0 3px rgba(26,47,90,.1), var(--shadow-sm)'
                        : 'var(--shadow-xs)',
                      opacity: disponivel ? 1 : .35,
                    }}
                  >
                    <span style={{ fontSize:26, lineHeight:1 }}>{METODO_ICONS[m]}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:'var(--text-1)' }}>
                      {METODO_LABELS[m]}
                    </span>
                    <span style={{
                      fontSize:9, fontWeight:800, padding:'2px 7px',
                      borderRadius:'var(--r-pill)', textTransform:'uppercase',
                      letterSpacing:'.03em',
                      ...(m === 'pix'
                        ? { background:'var(--success-light)', color:'#047857' }
                        : { background:'var(--border)', color:'var(--text-3)' }),
                    }}>
                      {m === 'pix' ? 'Instantâneo' : m === 'cartao' ? `Até ${maxParcelas}x` : 'Vence em 3 dias'}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Painel PIX */}
            {metodo === 'pix' && (
              <PixInfo total={total} />
            )}

            {/* Painel Cartão */}
            {metodo === 'cartao' && (
              <CartaoForm
                cartao={cartao}
                onChange={setCartao}
                maxParcelas={maxParcelas}
                total={total}
                cardNum={cardNum}
                cardNome={cardNome}
                cardVal={cardVal}
              />
            )}

            {/* Painel Boleto */}
            {metodo === 'boleto' && (
              <BoletoInfo total={total} />
            )}
          </>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background:'var(--danger-light)', border:'1px solid #fecaca',
            borderRadius:'var(--r-md)', padding:'10px 14px',
            fontSize:13, fontWeight:600, color:'var(--danger)', marginBottom:16,
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* CTA */}
        {metodo && (
          <button type="submit" disabled={isPending} style={{
            width:'100%', height:56,
            background: isPending ? '#aab4c8' : 'var(--brand)',
            color:'white', border:'none', borderRadius:'var(--r-md)',
            fontFamily:'inherit', fontSize:16, fontWeight:700,
            cursor: isPending ? 'wait' : 'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', gap:10,
            transition:'all .2s var(--ease)',
            boxShadow: isPending ? 'none' : '0 4px 14px rgba(26,47,90,.35)',
            letterSpacing:'-.01em',
          }}>
            {isPending ? (
              <>
                <span style={{
                  width:18, height:18, border:'2.5px solid rgba(255,255,255,.3)',
                  borderTopColor:'white', borderRadius:'50%',
                  animation:'spin .7s linear infinite', display:'inline-block',
                }} />
                Processando…
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
                {metodo === 'pix' ? 'Gerar código PIX' : metodo === 'boleto' ? 'Gerar boleto' : `Pagar ${fmtBRL(Math.max(0, totalGeral))}`}
              </>
            )}
          </button>
        )}
      </form>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize:11, fontWeight:700, textTransform:'uppercase',
      letterSpacing:'.09em', color:'var(--text-3)', marginBottom:12, marginTop:24,
    }}>
      {children}
    </div>
  )
}

function PixInfo({ total }: { total: number }) {
  return (
    <div style={{
      background:'#f0fdf4', border:'1.5px solid #a7f3d0',
      borderRadius:'var(--r-lg)', padding:20, marginBottom:20,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
        <div style={{
          width:48, height:48, background:'linear-gradient(135deg,#00875a,#00b37e)',
          borderRadius:'var(--r-md)', display:'flex', alignItems:'center',
          justifyContent:'center', flexShrink:0, fontSize:24,
        }}>⚡</div>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:'#047857' }}>Pagamento instantâneo</div>
          <div style={{ fontSize:13, color:'#065f46', marginTop:2 }}>
            {total.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })} via PIX
          </div>
        </div>
      </div>
      {[
        'Clique em "Gerar código PIX" abaixo',
        'Abra o app do seu banco e acesse a área PIX',
        'Escaneie o QR Code ou cole o código copia-e-cola',
        'Confirmação em até 30 segundos',
      ].map((step, i) => (
        <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom: i < 3 ? 10 : 0 }}>
          <div style={{
            width:26, height:26, background:'white', border:'1.5px solid #a7f3d0',
            borderRadius:'50%', fontSize:12, fontWeight:700, color:'#047857',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          }}>
            {i + 1}
          </div>
          <div style={{ fontSize:13, color:'#065f46', lineHeight:1.6, paddingTop:3 }}>
            {step}
          </div>
        </div>
      ))}
    </div>
  )
}

function BoletoInfo({ total }: { total: number }) {
  return (
    <div style={{
      background:'#fefce8', border:'1.5px solid #fde68a',
      borderRadius:'var(--r-lg)', padding:20, marginBottom:20,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
        <div style={{
          width:48, height:48, background:'linear-gradient(135deg,#d97706,#f59e0b)',
          borderRadius:'var(--r-md)', display:'flex', alignItems:'center',
          justifyContent:'center', flexShrink:0, fontSize:24,
        }}>📄</div>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:'#78350f' }}>Boleto bancário</div>
          <div style={{ fontSize:13, color:'#92400e', marginTop:2 }}>
            {total.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })} · Vence em 3 dias úteis
          </div>
        </div>
      </div>
      <div style={{ fontSize:13, color:'#78350f', lineHeight:1.7, fontWeight:500 }}>
        ⚠️ <strong>Atenção:</strong> o pedido ficará como pendente até a confirmação do pagamento (1–2 dias úteis após o pagamento).
        O boleto vence em <strong>3 dias úteis</strong> após a emissão.
      </div>
    </div>
  )
}

interface CartaoFormProps {
  cartao: DadosCartao
  onChange: (c: DadosCartao) => void
  maxParcelas: number
  total: number
  cardNum: string
  cardNome: string
  cardVal: string
}

function CartaoForm({ cartao, onChange, maxParcelas, total, cardNum, cardNome, cardVal }: CartaoFormProps) {
  function field(key: keyof DadosCartao) {
    return (value: string | number) => onChange({ ...cartao, [key]: value })
  }

  return (
    <div style={{
      background:'var(--surface)', border:'1.5px solid var(--border)',
      borderRadius:'var(--r-lg)', padding:22, marginBottom:20,
      boxShadow:'var(--shadow-xs)',
    }}>
      {/* Card preview */}
      <div style={{
        background:'linear-gradient(135deg,var(--brand),#3b82f6)',
        borderRadius:'var(--r-lg)', padding:22, marginBottom:22,
        color:'white', position:'relative', overflow:'hidden',
        height:130, display:'flex', flexDirection:'column', justifyContent:'space-between',
        boxShadow:'0 6px 24px rgba(26,47,90,.4)',
      }}>
        <div style={{
          position:'absolute', right:-30, top:-30, width:160, height:160,
          background:'rgba(255,255,255,.06)', borderRadius:'50%',
        }} />
        <div style={{
          width:36, height:26, background:'rgba(255,255,255,.2)',
          borderRadius:5, position:'relative', zIndex:1,
        }} />
        <div>
          <div style={{
            fontSize:15, fontWeight:600, letterSpacing:'.18em', opacity:.9,
            position:'relative', zIndex:1, fontVariantNumeric:'tabular-nums',
          }}>
            {cardNum}
          </div>
          <div style={{
            display:'flex', justifyContent:'space-between', alignItems:'flex-end',
            position:'relative', zIndex:1, marginTop:6,
          }}>
            <div>
              <div style={{ fontSize:9, opacity:.55, textTransform:'uppercase', letterSpacing:'.1em', fontWeight:600 }}>
                Nome
              </div>
              <div style={{ fontSize:13, fontWeight:700 }}>{cardNome.toUpperCase().slice(0,22)}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:9, opacity:.55, textTransform:'uppercase', letterSpacing:'.1em', fontWeight:600 }}>
                Validade
              </div>
              <div style={{ fontSize:13, fontWeight:700 }}>{cardVal}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Fields */}
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <CardField label="Número do cartão">
          <input value={cartao.numero} onChange={e => field('numero')(maskCard(e.target.value))}
            placeholder="0000 0000 0000 0000" maxLength={19}
            style={inputStyle} />
        </CardField>
        <CardField label="Nome impresso no cartão">
          <input value={cartao.nome} onChange={e => field('nome')(e.target.value.toUpperCase())}
            placeholder="NOME SOBRENOME" style={inputStyle} />
        </CardField>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <CardField label="Validade">
            <input value={cartao.validade} onChange={e => field('validade')(maskValidade(e.target.value))}
              placeholder="MM/AA" maxLength={5} style={inputStyle} />
          </CardField>
          <CardField label="CVV">
            <input value={cartao.cvv} onChange={e => field('cvv')(e.target.value.replace(/\D/g,'').slice(0,4))}
              placeholder="123" maxLength={4} type="password" style={inputStyle} />
          </CardField>
        </div>

        {/* Parcelas */}
        {maxParcelas > 1 && (
          <CardField label="Parcelas">
            <select value={cartao.parcelas} onChange={e => field('parcelas')(Number(e.target.value))}
              style={{ ...inputStyle, cursor:'pointer' }}>
              {Array.from({ length: maxParcelas }, (_, i) => i + 1).map(n => {
                const parcVal = total / n
                return (
                  <option key={n} value={n}>
                    {n}x de {parcVal.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })}
                    {n === 1 ? ' (sem juros)' : ''}
                  </option>
                )
              })}
            </select>
          </CardField>
        )}
      </div>
    </div>
  )
}

function CardField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display:'block', fontSize:12, fontWeight:700, color:'var(--text-2)',
        marginBottom:6, letterSpacing:'-.01em',
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width:'100%', height:46, borderRadius:'var(--r-md)',
  border:'1.5px solid var(--border)', background:'var(--surface)',
  padding:'0 14px', fontFamily:'inherit', fontSize:14,
  color:'var(--text-1)', outline:'none', transition:'border-color .15s',
}

// ── Util ───────────────────────────────────────────────────────────────────────

function calcIntersection(arrays: MetodoPagamento[][]): MetodoPagamento[] {
  if (arrays.length === 0) return []
  return arrays.reduce((acc, cur) => acc.filter(m => cur.includes(m)))
}
