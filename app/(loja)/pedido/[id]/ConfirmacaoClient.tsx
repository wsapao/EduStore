'use client'

import React, { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { renovarPixAction } from '@/app/actions/orders'
import type { Pedido, Pagamento, ItemPedido, Produto, Aluno, Ingresso } from '@/types/database'

interface PedidoCompleto extends Pedido {
  pagamento: Pagamento | null
  itens: (ItemPedido & { produto: Produto; aluno: Aluno; ingresso: Ingresso | null })[]
}

interface Props {
  pedido: PedidoCompleto
}

const CAT_ICONS: Record<string, string> = {
  eventos:'🎉', passeios:'🚌', segunda_chamada:'📝',
  materiais:'📚', uniforme:'👕', outros:'📦',
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })
}

// ── PIX countdown ─────────────────────────────────────────────────────────────

function usePixCountdown(expiracao: string | null) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    if (!expiracao) return
    const target = new Date(expiracao).getTime()
    function tick() { setSecs(Math.max(0, Math.floor((target - Date.now()) / 1000))) }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiracao])
  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')
  return { mm, ss, expired: secs === 0 && !!expiracao }
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ConfirmacaoClient({ pedido }: Props) {
  const pag = pedido.pagamento
  const metodo = pag?.metodo ?? pedido.metodo_pagamento
  const isPago = pedido.status === 'pago'
  const isCancelado = pedido.status === 'cancelado'
  const isPix = metodo === 'pix'
  const isBoleto = metodo === 'boleto'

  const [pixQrCode,       setPixQrCode]       = useState(pag?.pix_qr_code ?? null)
  const [pixQrImagem,     setPixQrImagem]     = useState(pag?.pix_qr_code_imagem ?? null)
  const [pixExpiracao,    setPixExpiracao]    = useState(pag?.pix_expiracao ?? null)

  const { mm, ss, expired } = usePixCountdown(pixExpiracao)
  const isPixExpirado = isPix && !isPago && !isCancelado && (pag?.status === 'expirado' || expired)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [renewError, setRenewError] = useState('')

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleRenovarPix() {
    setRenewError('')
    startTransition(async () => {
      const res = await renovarPixAction(pedido.id)
      if (!res.success) {
        setRenewError(res.error)
        return
      }
      setPixQrCode(res.pix_qr_code)
      setPixQrImagem(res.pix_qr_code_imagem)
      setPixExpiracao(res.pix_expiracao)
    })
  }

  return (
    <div style={{ background: '#f0f2f8', minHeight: '100vh', paddingBottom: 80, margin:'0 auto' }}>
      {/* ── Top Bar ── */}
      <div style={{
        height: 52, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 10, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10
      }}>
        <Link href="/pedidos" style={{
          width: 32, height: 32, borderRadius: 10, background: 'rgba(0,0,0,.25)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', textDecoration: 'none'
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </Link>
      </div>

      {/* ── Hero ── */}
      <div style={{
        padding: '44px 14px 28px', textAlign: 'center', position: 'relative', overflow: 'hidden',
        background: isPago ? 'linear-gradient(160deg,#065f46,#10b981)' : isCancelado ? 'linear-gradient(160deg,#7f1d1d,#b91c1c)' : 'linear-gradient(160deg,#0c1e3d,#1a2f5a)'
      }}>
        <div style={{ position:'absolute', top:-50, left:-50, width:200, height:200, background:'rgba(255,255,255,.04)', borderRadius:'50%' }} />
        <div style={{ position:'absolute', bottom:-60, right:-30, width:240, height:240, background:'rgba(255,255,255,.03)', borderRadius:'50%' }} />
        
        <div style={{
          width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', position: 'relative', zIndex: 1
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: 'white',
            background: isPago ? '#10b981' : isCancelado ? '#ef4444' : 'rgba(255,255,255,.18)',
            boxShadow: isPago ? '0 0 0 6px rgba(16,185,129,.2)' : isCancelado ? '0 0 0 6px rgba(239,68,68,.2)' : 'none'
          }}>
            {isPago ? '✓' : isCancelado ? '✕' : '⏳'}
          </div>
        </div>

        <div style={{ fontSize: 18, fontWeight: 900, color: 'white', letterSpacing: '-.03em', marginBottom: 10, position: 'relative', zIndex: 1 }}>
          {isPago ? 'Pagamento Aprovado!' : isCancelado ? 'Pedido Cancelado' : 'Pedido em Análise'}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.18)', borderRadius: 99, padding: '4px 10px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.9)' }}>
            <span style={{ fontSize: 12 }}>{metodo === 'pix' ? '⚡' : metodo === 'cartao' ? '💳' : '📄'}</span> {metodo?.toUpperCase()}
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.18)', borderRadius: 99, padding: '4px 10px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.9)' }}>
            PED-{pedido.numero.replace('PED-', '')}
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 14px' }}>
        
        {/* ── PIX Panel ── */}
        {isPix && !isPago && !isPixExpirado && !isCancelado && (
          <div style={{ background: 'white', border: '1.5px solid rgba(0,0,0,.07)', borderRadius: 18, overflow: 'hidden', marginBottom: 10, boxShadow: '0 2px 10px rgba(0,0,0,.06)' }}>
            <div style={{ background: 'linear-gradient(135deg,#00875a,#00b37e)', padding: '16px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.8)', fontWeight: 600, marginBottom: 12 }}>Escaneie para pagar</div>
              {pixQrImagem ? (
                <>
                  <div style={{ width: 130, height: 130, background: 'white', borderRadius: 12, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(0,0,0,.2)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pixQrImagem} alt="QR Code" style={{ width: 114, height: 114, borderRadius: 8 }} />
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'rgba(255,255,255,.8)', fontSize: 11, fontWeight: 600 }}>
                    Expira em <span style={{ background: 'rgba(0,0,0,.25)', borderRadius: 7, padding: '3px 9px', fontSize: 16, fontWeight: 900, color: 'white' }}>{mm}:{ss}</span>
                  </div>
                </>
              ) : (
                <div style={{ color: 'white', fontSize: 12, fontWeight: 600, padding: 20 }}>Gerando QRCode...</div>
              )}
            </div>
            
            {pixQrCode && (
              <div style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>Pix Copia e Cola</div>
                <div style={{ display: 'flex', gap: 7 }}>
                  <div style={{ flex: 1, background: '#f8f9fd', border: '1px solid rgba(0,0,0,.07)', borderRadius: 9, padding: '7px 9px', fontSize: 8, color: '#9ca3af', fontFamily: 'monospace', wordBreak: 'break-all', lineHeight: 1.5 }}>
                    {pixQrCode}
                  </div>
                  <button onClick={() => copyToClipboard(pixQrCode)} style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: 9, padding: '0 12px', fontSize: 11, fontWeight: 700, flexShrink: 0, cursor: 'pointer' }}>
                    {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PIX Expirado Panel ── */}
        {isPixExpirado && (
          <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 18, overflow: 'hidden', marginBottom: 10, boxShadow: '0 2px 10px rgba(0,0,0,.06)', padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⏰</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#b91c1c', marginBottom: 4 }}>PIX Expirado</div>
            <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, marginBottom: 12 }}>O tempo para pagamento acabou. Gere um novo código para continuar.</div>
            
            {renewError && (
              <div style={{ background: 'white', color: '#b91c1c', fontSize: 10, padding: 8, borderRadius: 8, marginBottom: 12, fontWeight: 700 }}>
                ⚠️ {renewError}
              </div>
            )}
            
            <button onClick={handleRenovarPix} disabled={isPending} style={{ width: '100%', height: 40, background: '#b91c1c', color: 'white', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: isPending ? 'wait' : 'pointer' }}>
              {isPending ? 'Gerando...' : 'Gerar Novo PIX'}
            </button>
          </div>
        )}

        {/* ── Boleto Panel ── */}
        {isBoleto && !isPago && !isCancelado && pag?.boleto_linha_digitavel && (
          <div style={{ background: 'white', border: '1.5px solid rgba(0,0,0,.07)', borderRadius: 18, overflow: 'hidden', marginBottom: 10, boxShadow: '0 2px 10px rgba(0,0,0,.06)' }}>
            <div style={{ background: 'linear-gradient(135deg,#d97706,#f59e0b)', padding: '16px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.8)', fontWeight: 600, marginBottom: 12 }}>Boleto Bancário</div>
              <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,.2)', borderRadius: 10, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📄</div>
              <div style={{ color: 'white', fontSize: 12, fontWeight: 600 }}>Pague até o vencimento</div>
            </div>
            
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>Código de Barras</div>
              <div style={{ display: 'flex', gap: 7, flexDirection: 'column' }}>
                <div style={{ flex: 1, background: '#f8f9fd', border: '1px solid rgba(0,0,0,.07)', borderRadius: 9, padding: '7px 9px', fontSize: 10, color: '#0a1628', fontFamily: 'monospace', wordBreak: 'break-all', lineHeight: 1.5, textAlign: 'center', fontWeight: 700 }}>
                  {pag.boleto_linha_digitavel}
                </div>
                <button onClick={() => copyToClipboard(pag.boleto_linha_digitavel ?? '')} style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: 9, padding: '10px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  {copied ? 'Código Copiado!' : 'Copiar Código'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Order Summary ── */}
        <div style={{ background: 'white', border: '1.5px solid rgba(0,0,0,.07)', borderRadius: 15, overflow: 'hidden', margin: '0 0 10px', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
          <div style={{ padding: '11px 13px', borderBottom: '1px solid rgba(0,0,0,.06)' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#0a1628' }}>Resumo da compra</div>
            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{pedido.itens.length} {pedido.itens.length === 1 ? 'item' : 'itens'}</div>
          </div>
          
          <div style={{ padding: '10px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pedido.itens.map((item) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0f2f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>
                  {item.produto?.icon ?? CAT_ICONS[item.produto?.categoria ?? ''] ?? '📦'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0a1628', lineHeight: 1.2 }}>{item.produto?.nome ?? 'Produto'}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1, fontWeight: 600 }}>{item.aluno?.nome?.split(' ')[0]} {item.variante ? `· Tam ${item.variante}` : ''}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0a1628' }}>{fmtBRL(item.preco_unitario)}</div>
              </div>
            ))}
          </div>

          <div style={{ padding: '10px 13px', background: '#fafbff', borderTop: '1px solid rgba(0,0,0,.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Total</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#0a1628', letterSpacing: '-.03em' }}>{fmtBRL(pedido.total)}</div>
          </div>
        </div>

        {/* ── Ingressos ── */}
        {pedido.itens.some(i => i.ingresso && i.ingresso.status === 'emitido') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
            {pedido.itens.filter(i => i.ingresso?.status === 'emitido').map(i => (
              <Link key={i.ingresso!.id} href={`/ingresso/${i.ingresso!.token}`} style={{
                background: 'linear-gradient(135deg,#4f46e5,#6366f1)', color: 'white', textDecoration: 'none', border: 'none', borderRadius: 13,
                height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 800, boxShadow: '0 4px 12px rgba(79,70,229,.35)'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M20 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M20 9.5A2.5 2.5 0 0 0 17.5 7H6.5A2.5 2.5 0 0 0 4 9.5v5A2.5 2.5 0 0 0 6.5 17h11a2.5 2.5 0 0 0 2.5-2.5v-5Z"/></svg>
                Ver Ingresso de {i.aluno.nome.split(' ')[0]}
              </Link>
            ))}
          </div>
        )}

        {/* ── Voltar ── */}
        <Link href="/loja" style={{
          width: '100%', height: 46, borderRadius: 13, background: '#0a1628', border: 'none', fontSize: 13, fontWeight: 800, color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 4px 12px rgba(10,22,40,.3)', textDecoration: 'none', marginTop: 10
        }}>
          Voltar para a Loja
        </Link>
      </div>
    </div>
  )
}
