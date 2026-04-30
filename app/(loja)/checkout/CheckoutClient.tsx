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

const CAT_ICONS: Record<string, string> = {
  eventos: '🎉', passeios: '🚌', segunda_chamada: '📝',
  materiais: '📚', uniforme: '👕', outros: '📦',
}

// ── component ─────────────────────────────────────────────────────────────────

export function CheckoutClient() {
  const router = useRouter()
  const posthog = usePostHog()
  const { items, total, clear, hydrated } = useCart()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const metodosDisponiveis = calcIntersection(items.map(i => i.produto.metodos_aceitos))
  const [metodo, setMetodo] = useState<MetodoPagamento | null>(
    metodosDisponiveis[0] ?? null
  )

  const [cartao, setCartao] = useState<DadosCartao>({
    numero: '', nome: '', validade: '', cvv: '', parcelas: 1,
  })

  const maxParcelas = items.reduce(
    (min, i) => Math.min(min, i.produto.max_parcelas ?? 1), 12
  )

  const navigatingToOrderRef = useRef(false)

  const [voucherCode, setVoucherCode] = useState('')
  const [appliedVoucher, setAppliedVoucher] = useState<{ voucher: Voucher, valorDesconto: number } | null>(null)
  const [voucherError, setVoucherError] = useState('')
  const [isApplyingVoucher, startVoucherTransition] = useTransition()
  const [showVoucher, setShowVoucher] = useState(false)

  const subtotalElegivel = items.filter(i => i.produto.aceita_vouchers).reduce((sum, i) => sum + (i.produto.preco_promocional ?? i.produto.preco), 0)
  const totalGeral = total - (appliedVoucher?.valorDesconto ?? 0)

  const itensComTermo = items.filter(i => i.produto.exige_termo)
  const requiresTermo = itensComTermo.length > 0
  const [termosAceitos, setTermosAceitos] = useState(false)
  const [viewingTermoId, setViewingTermoId] = useState<string | null>(null)

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
  }, [hydrated]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleApplyVoucher() {
    if (!voucherCode.trim()) return
    setVoucherError('')
    startVoucherTransition(async () => {
      const res = await validarVoucherAction(voucherCode, subtotalElegivel)
      if (res.success && res.voucher) {
        setAppliedVoucher({ voucher: res.voucher, valorDesconto: res.valorDesconto! })
      } else {
        setVoucherError(res.error || 'Cupom inválido ou já utilizado')
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ fontSize: 48, opacity: .25 }}>🛒</div>
      </div>
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!metodo) { setError('Escolha uma forma de pagamento para continuar.'); return }
    if (metodo === 'cartao') {
      if (cartao.numero.replace(/\s/g, '').length < 16) { setError('Número do cartão incompleto.'); return }
      if (!cartao.nome.trim()) { setError('Digite o nome como está no cartão.'); return }
      if (cartao.validade.length < 5) { setError('Data de validade incompleta.'); return }
      if (cartao.cvv.length < 3) { setError('Código de segurança (CVV) inválido.'); return }
    }
    if (requiresTermo && !termosAceitos) {
      setError('Por favor, leia e aceite os Termos de Responsabilidade para continuar.')
      return
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
        termo_aceito: requiresTermo ? termosAceitos : undefined,
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

  const cardNum = cartao.numero || '•••• •••• •••• ••••'
  const cardNome = cartao.nome || 'NOME NO CARTÃO'
  const cardVal = cartao.validade || 'MM/AA'

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f3', paddingBottom: 100 }}>

      {/* ── Header ─────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        height: 64, padding: '0 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'rgba(250,248,243,.95)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(0,0,0,.07)',
      }}>
        <button
          onClick={() => router.back()}
          aria-label="Voltar"
          style={{
            width: 48, height: 48, borderRadius: 14,
            border: '1.5px solid rgba(0,0,0,.1)', background: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#374151', cursor: 'pointer', flexShrink: 0,
            boxShadow: '0 1px 4px rgba(0,0,0,.06)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span style={{ flex: 1, fontSize: 18, fontWeight: 800, color: '#0a1628', letterSpacing: '-.03em' }}>
          Finalizar pedido
        </span>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: '#dcfce7', borderRadius: 99, padding: '6px 12px',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>Seguro</span>
        </div>
      </div>

      <form onSubmit={handleSubmit}>

        {/* ── Seção 1: Resumo ──────────────────────────── */}
        <div style={{ padding: '28px 16px 0' }}>
          <SectionHeader number={1} label="Seu pedido" />

          <div style={{
            background: 'white', borderRadius: 20, overflow: 'hidden',
            border: '1.5px solid rgba(0,0,0,.07)',
            boxShadow: '0 2px 12px rgba(0,0,0,.06)',
          }}>
            {items.map((item, i) => (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '16px 18px',
                borderTop: i > 0 ? '1px solid #f3f4f6' : 'none',
              }}>
                {item.produto.imagem_url ? (
                  <div style={{
                    width: 56, height: 56, borderRadius: 14,
                    position: 'relative', overflow: 'hidden', flexShrink: 0,
                  }}>
                    <Image src={item.produto.imagem_url} alt={item.produto.nome} fill sizes="56px" style={{ objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div style={{
                    width: 56, height: 56, borderRadius: 14, background: '#fef9ec',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 26, flexShrink: 0, border: '1.5px solid #fde68a',
                  }}>
                    {item.produto.icon ?? CAT_ICONS[item.produto.categoria] ?? '📦'}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', lineHeight: 1.3 }}>
                    {item.produto.nome}
                  </div>
                  <div style={{ fontSize: 14, color: '#9ca3af', fontWeight: 600, marginTop: 3 }}>
                    Para {item.aluno.nome.split(' ')[0]}{item.variante ? ` · Tamanho ${item.variante}` : ''}
                  </div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', flexShrink: 0 }}>
                  {fmtBRL(item.produto.preco_promocional ?? item.produto.preco)}
                </div>
              </div>
            ))}

            {/* Total dentro do card */}
            <div style={{
              padding: '16px 18px',
              background: '#fafafa',
              borderTop: '2px dashed #e5e7eb',
            }}>
              {appliedVoucher && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 15, color: '#16a34a', fontWeight: 700, marginBottom: 10,
                }}>
                  <span>Desconto ({appliedVoucher.voucher.codigo})</span>
                  <span>−{fmtBRL(appliedVoucher.valorDesconto)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: '#6b7280' }}>Total a pagar</span>
                <span style={{ fontSize: 28, fontWeight: 900, color: '#0a1628', letterSpacing: '-.04em', lineHeight: 1 }}>
                  {fmtBRL(Math.max(0, totalGeral))}
                </span>
              </div>
            </div>
          </div>

          {/* Cupom de desconto — colapsável para não confundir */}
          {!appliedVoucher ? (
            <div style={{ marginTop: 12 }}>
              {!showVoucher ? (
                <button
                  type="button"
                  onClick={() => setShowVoucher(true)}
                  style={{
                    width: '100%', height: 52, borderRadius: 14,
                    border: '1.5px dashed #d1d5db', background: 'transparent',
                    fontSize: 15, fontWeight: 600, color: '#9ca3af',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 18 }}>🏷️</span> Tenho um cupom de desconto
                </button>
              ) : (
                <div style={{
                  background: 'white', borderRadius: 16, padding: 16,
                  border: '1.5px solid #e5e7eb',
                  boxShadow: '0 2px 8px rgba(0,0,0,.05)',
                }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 10 }}>
                    Cupom de desconto
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      placeholder="Digite seu cupom"
                      value={voucherCode}
                      onChange={e => setVoucherCode(e.target.value.toUpperCase())}
                      style={{
                        flex: 1, height: 56, borderRadius: 12,
                        border: '1.5px solid #e5e7eb', background: '#fafafa',
                        padding: '0 16px', fontFamily: 'inherit',
                        fontSize: 16, color: '#111827', letterSpacing: '.05em',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleApplyVoucher}
                      disabled={isApplyingVoucher || !voucherCode.trim()}
                      style={{
                        height: 56, padding: '0 20px',
                        background: isApplyingVoucher || !voucherCode.trim() ? '#e5e7eb' : '#0a1628',
                        color: isApplyingVoucher || !voucherCode.trim() ? '#9ca3af' : 'white',
                        border: 'none', borderRadius: 12,
                        fontSize: 15, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                      }}
                    >
                      {isApplyingVoucher ? '...' : 'Aplicar'}
                    </button>
                  </div>
                  {voucherError && (
                    <div style={{
                      fontSize: 14, color: '#dc2626', fontWeight: 600, marginTop: 8,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span>⚠️</span> {voucherError}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{
              marginTop: 12, background: '#f0fdf4', border: '1.5px solid #a7f3d0',
              borderRadius: 16, padding: '14px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>🎉</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#047857' }}>
                    Cupom {appliedVoucher.voucher.codigo} aplicado!
                  </div>
                  <div style={{ fontSize: 14, color: '#065f46', fontWeight: 600 }}>
                    Desconto de {fmtBRL(appliedVoucher.valorDesconto)}
                  </div>
                </div>
              </div>
              <button
                type="button" onClick={handleRemoveVoucher}
                style={{
                  background: 'none', border: 'none', color: '#047857',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline',
                }}
              >
                Remover
              </button>
            </div>
          )}
        </div>

        {/* ── Seção 2: Termos (quando necessário) ─────── */}
        {requiresTermo && (
          <div style={{ padding: '24px 16px 0' }}>
            <SectionHeader number={2} label="Termo de responsabilidade" />
            <div style={{
              background: '#fffbeb', border: '1.5px solid #fde68a',
              borderRadius: 20, padding: 20,
            }}>
              <p style={{ fontSize: 16, color: '#92400e', fontWeight: 500, lineHeight: 1.6, margin: '0 0 16px' }}>
                Este pedido exige a leitura e aceite do <strong>Termo de Responsabilidade</strong> da escola.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {itensComTermo.map(i => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => setViewingTermoId(i.produto.id)}
                    style={{
                      width: '100%', minHeight: 60, background: 'white',
                      border: '1.5px solid #fcd34d', borderRadius: 14,
                      padding: '14px 16px', fontSize: 15, fontWeight: 700, color: '#b45309',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <span>📄 Ler Termo: {i.produto.nome}</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                ))}
              </div>

              {/* Checkbox grande e acessível */}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 14, cursor: 'pointer' }}>
                <div
                  onClick={() => setTermosAceitos(!termosAceitos)}
                  style={{
                    width: 32, height: 32, borderRadius: 10, flexShrink: 0, marginTop: 1,
                    border: termosAceitos ? '2px solid #d97706' : '2px solid #fcd34d',
                    background: termosAceitos ? '#f59e0b' : 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all .2s', cursor: 'pointer',
                  }}
                >
                  {termosAceitos && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={termosAceitos}
                  onChange={e => setTermosAceitos(e.target.checked)}
                  style={{ display: 'none' }}
                />
                <span style={{ fontSize: 16, fontWeight: 600, color: '#78350f', lineHeight: 1.5 }}>
                  Li e aceito todos os Termos de Responsabilidade. Confirmo que tenho autoridade para aceitá-los.
                </span>
              </label>
            </div>
          </div>
        )}

        {/* ── Seção 3: Forma de pagamento ──────────────── */}
        <div style={{ padding: `${requiresTermo ? 24 : 24}px 16px 0` }}>
          <SectionHeader number={requiresTermo ? 3 : 2} label="Como quer pagar?" />

          {metodosDisponiveis.length === 0 ? (
            <div style={{
              background: '#fef2f2', border: '1.5px solid #fecaca',
              borderRadius: 16, padding: '16px 18px',
              fontSize: 16, color: '#dc2626', fontWeight: 600, lineHeight: 1.5,
            }}>
              ⚠️ Os itens do carrinho não têm formas de pagamento compatíveis entre si.
            </div>
          ) : (
            <>
              {metodosDisponiveis.length < 3 && (
                <div style={{
                  background: '#eff6ff', border: '1.5px solid #bfdbfe',
                  borderRadius: 14, padding: '12px 16px', marginBottom: 14,
                  fontSize: 15, color: '#1d4ed8', fontWeight: 600, lineHeight: 1.5,
                }}>
                  ℹ️ Para estes itens, estão disponíveis: {metodosDisponiveis.map(m => METODO_DISPLAY[m].label).join(' e ')}
                </div>
              )}

              {/* Opções de pagamento — cards grandes empilhados */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(['pix', 'cartao', 'boleto'] as MetodoPagamento[]).map(m => {
                  const disponivel = metodosDisponiveis.includes(m)
                  const ativo = metodo === m
                  const display = METODO_DISPLAY[m]
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={!disponivel}
                      onClick={() => setMetodo(m)}
                      style={{
                        width: '100%', minHeight: 80,
                        background: ativo ? '#fef9ec' : 'white',
                        border: ativo ? '2.5px solid #f59e0b' : '1.5px solid #e5e7eb',
                        borderRadius: 18, padding: '16px 20px',
                        display: 'flex', alignItems: 'center', gap: 16,
                        cursor: disponivel ? 'pointer' : 'not-allowed',
                        opacity: disponivel ? 1 : .4,
                        boxShadow: ativo ? '0 4px 20px rgba(245,158,11,.25)' : '0 1px 4px rgba(0,0,0,.05)',
                        transition: 'all .2s',
                        textAlign: 'left',
                      }}
                    >
                      {/* Indicador de seleção */}
                      <div style={{
                        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                        border: ativo ? '2px solid #f59e0b' : '2px solid #d1d5db',
                        background: ativo ? '#f59e0b' : 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all .2s',
                      }}>
                        {ativo && (
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'white' }} />
                        )}
                      </div>

                      <div style={{ fontSize: 32, lineHeight: 1, flexShrink: 0 }}>
                        {display.icon}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 17, fontWeight: 800, color: '#111827' }}>
                          {display.label}
                        </div>
                        <div style={{ fontSize: 14, color: '#6b7280', fontWeight: 500, marginTop: 2 }}>
                          {display.desc}
                        </div>
                      </div>

                      {m === 'pix' && disponivel && (
                        <div style={{
                          background: '#dcfce7', color: '#16a34a', fontSize: 13, fontWeight: 700,
                          padding: '4px 10px', borderRadius: 99, flexShrink: 0,
                        }}>
                          Recomendado
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Painel PIX */}
              {metodo === 'pix' && <PixInfo total={totalGeral} />}

              {/* Painel Cartão */}
              {metodo === 'cartao' && (
                <CartaoForm
                  cartao={cartao}
                  onChange={setCartao}
                  maxParcelas={maxParcelas}
                  total={totalGeral}
                  cardNum={cardNum}
                  cardNome={cardNome}
                  cardVal={cardVal}
                />
              )}

              {/* Painel Boleto */}
              {metodo === 'boleto' && <BoletoInfo total={totalGeral} />}
            </>
          )}
        </div>

        {/* ── Erro ─────────────────────────────────────── */}
        {error && (
          <div style={{
            margin: '20px 16px 0',
            background: '#fef2f2', border: '2px solid #fca5a5',
            borderRadius: 16, padding: '16px 20px',
            display: 'flex', alignItems: 'flex-start', gap: 12,
          }}>
            <span style={{ fontSize: 24, flexShrink: 0 }}>⚠️</span>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#dc2626', lineHeight: 1.5 }}>
              {error}
            </span>
          </div>
        )}

        {/* ── Botão CTA ─────────────────────────────────── */}
        <div style={{
          padding: '20px 16px',
          background: 'linear-gradient(to top, #faf8f3 80%, transparent)',
        }}>
          <button
            type="submit"
            disabled={isPending || !metodo}
            style={{
              width: '100%', height: 72, borderRadius: 20,
              background: isPending || !metodo ? '#e5e7eb' : '#f59e0b',
              border: 'none', fontSize: 18, fontWeight: 800,
              color: isPending || !metodo ? '#9ca3af' : '#78350f',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: isPending || !metodo ? 'none' : '0 6px 20px rgba(245,158,11,.4)',
              cursor: isPending ? 'wait' : !metodo ? 'not-allowed' : 'pointer',
              transition: 'all .2s',
            }}
          >
            {isPending ? (
              <>
                <span style={{
                  width: 24, height: 24,
                  border: '3px solid rgba(120,53,15,.25)',
                  borderTopColor: '#78350f',
                  borderRadius: '50%',
                  animation: 'spin .7s linear infinite',
                  display: 'inline-block', flexShrink: 0,
                }} />
                Processando...
              </>
            ) : !metodo ? (
              'Escolha a forma de pagamento'
            ) : (
              <>
                {metodo === 'pix' ? 'Gerar código PIX' : metodo === 'boleto' ? 'Gerar boleto bancário' : `Pagar ${fmtBRL(Math.max(0, totalGeral))}`}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </>
            )}
          </button>

          <p style={{ textAlign: 'center', fontSize: 13, color: '#9ca3af', fontWeight: 500, marginTop: 12 }}>
            🔒 Seus dados estão protegidos e criptografados
          </p>
        </div>
      </form>

      {/* ── Modal Termo de Responsabilidade ───────────── */}
      {viewingTermoId && (
        <div
          onClick={() => setViewingTermoId(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
            zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            animation: 'fadeIn .2s ease-out',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: '24px 24px 0 0',
              width: '100%', maxWidth: 600, maxHeight: '85vh',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 -8px 40px rgba(0,0,0,.2)',
              animation: 'slideUp .3s cubic-bezier(.34,1.56,.64,1)',
            }}
          >
            {/* Handle bar */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: 40, height: 4, borderRadius: 99, background: '#e5e7eb' }} />
            </div>

            <div style={{
              padding: '8px 20px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: '1px solid #f3f4f6',
            }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>
                Termo de Responsabilidade
              </span>
              <button
                type="button"
                onClick={() => setViewingTermoId(null)}
                style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: '#f3f4f6', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: 18, color: '#6b7280',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{
              padding: '20px', overflowY: 'auto', flex: 1,
              fontSize: 16, color: '#374151', lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
            }}>
              {itensComTermo.find(i => i.produto.id === viewingTermoId)?.produto.texto_termo || 'Texto do termo não disponível.'}
            </div>

            <div style={{
              padding: '16px 20px 24px',
              borderTop: '1px solid #f3f4f6',
            }}>
              <button
                type="button"
                onClick={() => setViewingTermoId(null)}
                style={{
                  width: '100%', height: 60, borderRadius: 16,
                  background: '#0a1628', color: 'white', border: 'none',
                  fontSize: 17, fontWeight: 800, cursor: 'pointer',
                }}
              >
                Entendi, fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const METODO_DISPLAY: Record<MetodoPagamento, { icon: string; label: string; desc: string }> = {
  pix: { icon: '⚡', label: 'PIX', desc: 'Pagamento na hora — aprovação imediata' },
  cartao: { icon: '💳', label: 'Cartão de crédito', desc: 'Pode parcelar em até 12 vezes' },
  boleto: { icon: '📄', label: 'Boleto bancário', desc: 'Vence em 3 dias úteis' },
}

function SectionHeader({ number, label }: { number: number; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <div style={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
        background: '#0a1628', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, fontWeight: 800,
      }}>
        {number}
      </div>
      <span style={{ fontSize: 20, fontWeight: 800, color: '#111827', letterSpacing: '-.03em' }}>
        {label}
      </span>
    </div>
  )
}

function PixInfo({ total }: { total: number }) {
  const steps = [
    'Toque em "Gerar código PIX" abaixo',
    'Abra o app do seu banco',
    'Vá em PIX e escaneie o QR Code ou cole o código',
    'Pronto! Confirmamos em até 30 segundos',
  ]
  return (
    <div style={{
      marginTop: 16, background: '#f0fdf4', border: '1.5px solid #a7f3d0',
      borderRadius: 20, padding: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: 'linear-gradient(135deg,#00875a,#00b37e)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, flexShrink: 0,
        }}>
          ⚡
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#047857' }}>Pagamento instantâneo</div>
          <div style={{ fontSize: 16, color: '#065f46', fontWeight: 600, marginTop: 2 }}>
            {fmtBRL(total)} via PIX
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{
              width: 32, height: 32, background: 'white', border: '2px solid #a7f3d0',
              borderRadius: '50%', fontSize: 15, fontWeight: 800, color: '#047857',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {i + 1}
            </div>
            <div style={{ fontSize: 16, color: '#065f46', lineHeight: 1.5, paddingTop: 4 }}>
              {step}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BoletoInfo({ total }: { total: number }) {
  return (
    <div style={{
      marginTop: 16, background: '#fffbeb', border: '1.5px solid #fde68a',
      borderRadius: 20, padding: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: 'linear-gradient(135deg,#d97706,#f59e0b)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, flexShrink: 0,
        }}>
          📄
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#78350f' }}>Boleto bancário</div>
          <div style={{ fontSize: 16, color: '#92400e', fontWeight: 600, marginTop: 2 }}>
            {fmtBRL(total)} · Vence em 3 dias úteis
          </div>
        </div>
      </div>
      <div style={{
        background: 'rgba(255,255,255,.6)', borderRadius: 14, padding: '14px 16px',
        fontSize: 16, color: '#78350f', lineHeight: 1.6, fontWeight: 500,
      }}>
        ⚠️ O pedido ficará pendente até o pagamento ser confirmado pelo banco, o que pode levar <strong>1 a 2 dias úteis</strong> após o pagamento.
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
    <div style={{ marginTop: 16 }}>
      {/* Card preview */}
      <div style={{
        background: 'linear-gradient(135deg,#0a1628,#1a3a6e)',
        borderRadius: 20, padding: 24, marginBottom: 20,
        color: 'white', position: 'relative', overflow: 'hidden',
        height: 160, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        boxShadow: '0 8px 32px rgba(10,22,40,.35)',
      }}>
        <div style={{
          position: 'absolute', right: -40, top: -40, width: 200, height: 200,
          background: 'rgba(255,255,255,.05)', borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute', right: 20, bottom: -60, width: 160, height: 160,
          background: 'rgba(255,255,255,.04)', borderRadius: '50%',
        }} />
        <div style={{
          width: 44, height: 32, background: 'rgba(255,255,255,.18)',
          borderRadius: 6, position: 'relative', zIndex: 1,
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            fontSize: 18, fontWeight: 600, letterSpacing: '.2em',
            opacity: .9, fontVariantNumeric: 'tabular-nums', marginBottom: 10,
          }}>
            {cardNum}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 10, opacity: .5, textTransform: 'uppercase', letterSpacing: '.12em', fontWeight: 700 }}>
                Titular
              </div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{cardNome.toUpperCase().slice(0, 22)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, opacity: .5, textTransform: 'uppercase', letterSpacing: '.12em', fontWeight: 700 }}>
                Válido até
              </div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{cardVal}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Campos */}
      <div style={{
        background: 'white', borderRadius: 20, padding: 20,
        border: '1.5px solid #e5e7eb',
        boxShadow: '0 2px 12px rgba(0,0,0,.05)',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <BigField label="Número do cartão">
          <input
            value={cartao.numero}
            onChange={e => field('numero')(maskCard(e.target.value))}
            placeholder="0000 0000 0000 0000"
            maxLength={19}
            inputMode="numeric"
            style={bigInputStyle}
          />
        </BigField>

        <BigField label="Nome igual ao cartão">
          <input
            value={cartao.nome}
            onChange={e => field('nome')(e.target.value.toUpperCase())}
            placeholder="SEU NOME AQUI"
            style={bigInputStyle}
          />
        </BigField>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <BigField label="Validade">
            <input
              value={cartao.validade}
              onChange={e => field('validade')(maskValidade(e.target.value))}
              placeholder="MM/AA"
              maxLength={5}
              inputMode="numeric"
              style={bigInputStyle}
            />
          </BigField>
          <BigField label="Código (CVV)">
            <input
              value={cartao.cvv}
              onChange={e => field('cvv')(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="123"
              maxLength={4}
              type="password"
              inputMode="numeric"
              style={bigInputStyle}
            />
          </BigField>
        </div>

        {maxParcelas > 1 && (
          <BigField label="Parcelamento">
            <select
              value={cartao.parcelas}
              onChange={e => field('parcelas')(Number(e.target.value))}
              style={{ ...bigInputStyle, cursor: 'pointer' }}
            >
              {Array.from({ length: maxParcelas }, (_, i) => i + 1).map(n => {
                const parcVal = total / n
                return (
                  <option key={n} value={n}>
                    {n === 1
                      ? `À vista — ${parcVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                      : `${n}x de ${parcVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
                  </option>
                )
              })}
            </select>
          </BigField>
        )}
      </div>
    </div>
  )
}

function BigField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 15, fontWeight: 700,
        color: '#374151', marginBottom: 8,
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const bigInputStyle: React.CSSProperties = {
  width: '100%', height: 60, borderRadius: 14,
  border: '1.5px solid #e5e7eb', background: '#fafafa',
  padding: '0 16px', fontFamily: 'inherit', fontSize: 17,
  color: '#111827', outline: 'none',
  transition: 'border-color .15s',
}

// ── Util ───────────────────────────────────────────────────────────────────────

function calcIntersection(arrays: MetodoPagamento[][]): MetodoPagamento[] {
  if (arrays.length === 0) return []
  return arrays.reduce((acc, cur) => acc.filter(m => cur.includes(m)))
}
