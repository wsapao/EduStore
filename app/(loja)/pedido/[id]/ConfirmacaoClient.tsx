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
  const isPix = metodo === 'pix'
  const isBoleto = metodo === 'boleto'
  const isCartao = metodo === 'cartao'

  // Estado reativo do PIX (atualizado após renovação)
  const [pixQrCode,       setPixQrCode]       = useState(pag?.pix_qr_code ?? null)
  const [pixQrImagem,     setPixQrImagem]     = useState(pag?.pix_qr_code_imagem ?? null)
  const [pixExpiracao,    setPixExpiracao]    = useState(pag?.pix_expiracao ?? null)

  const { mm, ss, expired } = usePixCountdown(pixExpiracao)
  const isPixExpirado = isPix && !isPago && (pag?.status === 'expirado' || expired)
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

  function handlePrint() {
    window.print()
  }

  return (
    <div className="pedido-print-root" style={{ background:'var(--bg)', minHeight:'100vh' }}>

      {/* ── Hero ── */}
      <div style={{
        background: isPago
          ? 'linear-gradient(160deg,#047857 0%,#10b981 100%)'
          : isPixExpirado
          ? 'linear-gradient(160deg,#b45309 0%,#ea580c 100%)'
          : 'linear-gradient(160deg,var(--brand) 0%,#1e4080 60%,#2d5aa0 100%)',
        padding:'48px 24px 60px', textAlign:'center', position:'relative', overflow:'hidden',
      }}>
        {/* bg circles */}
        <div style={{ position:'absolute', top:-60, left:-60, width:280, height:280, background:'rgba(255,255,255,.04)', borderRadius:'50%' }} />
        <div style={{ position:'absolute', bottom:-80, right:-40, width:320, height:320, background:'rgba(255,255,255,.03)', borderRadius:'50%' }} />

        {/* Icon */}
        <div style={{ position:'relative', width:100, height:100, margin:'0 auto 24px' }}>
          <div style={{
            width:100, height:100, borderRadius:'50%', background:'rgba(255,255,255,.12)',
            display:'flex', alignItems:'center', justifyContent:'center', position:'relative', zIndex:1,
            animation:'ring-pop .5s cubic-bezier(.34,1.56,.64,1) both',
          }}>
            <div style={{
              width:56, height:56, background: isPago ? 'var(--success)' : 'rgba(255,255,255,.2)',
              borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow: isPago ? '0 0 0 8px rgba(16,185,129,.2)' : 'none',
              animation:'icon-in .4s cubic-bezier(.34,1.56,.64,1) .2s both',
            }}>
              {isPago ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : isPixExpirado ? (
                <span style={{ fontSize:28 }}>⏰</span>
              ) : (
                <span style={{ fontSize:28 }}>
                  {isPix ? '⚡' : isBoleto ? '📄' : '💳'}
                </span>
              )}
            </div>
          </div>
        </div>

        <h1 style={{
          color:'white', fontSize:26, fontWeight:800, letterSpacing:'-.03em',
          marginBottom:8, animation:'fade-up .5s var(--ease) .4s both',
        }}>
          {isPago
            ? 'Pagamento confirmado!'
            : isPixExpirado
            ? 'PIX expirado'
            : isPix
            ? 'PIX gerado com sucesso!'
            : isBoleto
            ? 'Boleto gerado!'
            : 'Pedido recebido!'}
        </h1>
        <p style={{
          color:'rgba(255,255,255,.65)', fontSize:14, fontWeight:500, lineHeight:1.6,
          animation:'fade-up .5s var(--ease) .5s both',
        }}>
          {isPago
            ? 'Seu pedido foi confirmado e estará disponível em breve.'
            : isPixExpirado
            ? 'Gere um novo código PIX para concluir o pagamento do pedido.'
            : isPix
            ? 'Use o QR Code ou o código copia-e-cola para pagar.'
            : isBoleto
            ? 'Pague o boleto em qualquer banco ou lotérica.'
            : 'Aguardando confirmação do pagamento.'}
        </p>

        {/* Chips */}
        <div style={{
          display:'flex', justifyContent:'center', gap:10, flexWrap:'wrap',
          marginTop:24, animation:'fade-up .5s var(--ease) .6s both',
        }}>
          <Chip icon="🔖">Pedido #{pedido.numero}</Chip>
          <Chip icon={isPago ? '✅' : isPixExpirado ? '⏰' : '⏳'}>
            {isPago ? 'Pago' : isPixExpirado ? 'PIX expirado' : 'Aguardando'}
          </Chip>
          <Chip icon="💰">{fmtBRL(pedido.total)}</Chip>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ maxWidth:560, margin:'0 auto', padding:'24px 20px 60px' }}>

        {/* PIX panel */}
        {isPix && !isPago && (
          <div style={{
            background:'var(--surface)', border:'1.5px solid var(--border)',
            borderRadius:'var(--r-xl)', overflow:'hidden', marginBottom:16,
            boxShadow:'var(--shadow-md)', animation:'fade-up .5s var(--ease) .7s both',
          }}>

            {/* ── PIX expirado ── */}
            {expired ? (
              <div style={{ padding: 28, textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>⏰</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#92400e', marginBottom: 6 }}>
                  PIX expirado
                </div>
                <div style={{ fontSize: 13, color: '#78716c', lineHeight: 1.6, marginBottom: 20 }}>
                  O código PIX venceu. Gere um novo abaixo —<br/>
                  seu pedido continua reservado.
                </div>

                {renewError && (
                  <div style={{
                    background: '#fef2f2', border: '1px solid #fca5a5',
                    borderRadius: 10, padding: '10px 14px',
                    fontSize: 13, color: '#b91c1c', marginBottom: 14,
                  }}>
                    ⚠️ {renewError}
                  </div>
                )}

                <button
                  onClick={handleRenovarPix}
                  disabled={isPending}
                  style={{
                    height: 52, padding: '0 32px', borderRadius: 12, border: 'none',
                    background: isPending ? '#94a3b8' : 'linear-gradient(135deg,#00875a,#00b37e)',
                    color: 'white', fontSize: 15, fontWeight: 700,
                    cursor: isPending ? 'not-allowed' : 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 10,
                    boxShadow: isPending ? 'none' : '0 4px 16px rgba(0,135,90,.35)',
                    transition: 'all .2s',
                  }}
                >
                  {isPending ? (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                        <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                      </svg>
                      Gerando novo PIX…
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                      </svg>
                      Gerar novo PIX
                    </>
                  )}
                </button>

                <p style={{ fontSize: 11, color: '#a8a29e', marginTop: 12 }}>
                  O pedido não será cancelado
                </p>
              </div>
            ) : pixQrImagem ? (
              <>
                {/* PIX header */}
                <div style={{
                  background:'linear-gradient(135deg,#00875a,#00b37e)',
                  padding:'28px 24px', textAlign:'center', position:'relative', overflow:'hidden',
                }}>
                  <div style={{ position:'absolute', top:-30, right:-30, width:120, height:120, background:'rgba(255,255,255,.06)', borderRadius:'50%' }} />
                  <div style={{ color:'rgba(255,255,255,.85)', fontSize:13, fontWeight:600, marginBottom:18 }}>
                    Escaneie o QR Code com o app do seu banco
                  </div>
                  {/* QR Code image */}
                  <div style={{
                    width:164, height:164, background:'white', borderRadius:'var(--r-lg)',
                    margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'center',
                    boxShadow:'0 4px 20px rgba(0,0,0,.2)', overflow:'hidden',
                  }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pixQrImagem}
                      alt="QR Code PIX"
                      width={140} height={140}
                      style={{ display:'block' }}
                    />
                  </div>
                  {/* Countdown */}
                  <div style={{
                    marginTop:18, display:'flex', alignItems:'center',
                    justifyContent:'center', gap:8, color:'rgba(255,255,255,.85)',
                    fontSize:13, fontWeight:600,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    Expira em
                    <span style={{
                      background:'rgba(0,0,0,.25)', borderRadius:'var(--r-sm)',
                      padding:'5px 10px', fontSize:18, fontWeight:800, color:'white',
                      minWidth:44, textAlign:'center', fontVariantNumeric:'tabular-nums',
                    }}>{mm}</span>
                    <span style={{ color:'rgba(255,255,255,.6)', fontSize:18 }}>:</span>
                    <span style={{
                      background:'rgba(0,0,0,.25)', borderRadius:'var(--r-sm)',
                      padding:'5px 10px', fontSize:18, fontWeight:800, color:'white',
                      minWidth:44, textAlign:'center', fontVariantNumeric:'tabular-nums',
                    }}>{ss}</span>
                  </div>
                </div>

                {/* Copy code */}
                <div style={{ padding:18 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>
                    Código copia e cola
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <div style={{
                      flex:1, background:'var(--surface-2)', border:'1.5px solid var(--border)',
                      borderRadius:'var(--r-md)', padding:'10px 12px',
                      fontSize:10, color:'var(--text-3)', fontFamily:'monospace',
                      wordBreak:'break-all', lineHeight:1.6,
                    }}>
                      {pixQrCode?.slice(0, 60)}…
                    </div>
                    <button onClick={() => copyToClipboard(pixQrCode ?? '')} style={{
                      background: copied ? 'var(--success)' : 'var(--brand)',
                      color:'white', border:'none', borderRadius:'var(--r-md)',
                      padding:'10px 16px', fontFamily:'inherit', fontSize:13, fontWeight:700,
                      cursor:'pointer', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:6,
                      transition:'all .2s', flexShrink:0,
                    }}>
                      {copied ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                        </svg>
                      )}
                      {copied ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>

                {/* Steps */}
                <div style={{ padding:'0 18px 18px', display:'flex', flexDirection:'column', gap:12 }}>
                  {[
                    ['Abra o app do seu banco', 'Acesse a área de pagamento via PIX'],
                    ['Escaneie ou cole o código', 'Use a câmera ou "PIX Copia e Cola"'],
                    ['Confirme o pagamento', 'Valor e destinatário aparecem na tela'],
                  ].map(([title, desc], i) => (
                    <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                      <div style={{
                        width:26, height:26, background:'var(--brand-light)',
                        border:'1.5px solid #c7d2fe', borderRadius:'50%',
                        fontSize:12, fontWeight:700, color:'var(--brand)',
                        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                      }}>{i + 1}</div>
                      <div style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.6, paddingTop:3 }}>
                        <strong style={{ color:'var(--text-1)' }}>{title}</strong><br />{desc}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              /* PIX sem QR code ainda */
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
                Aguardando dados do PIX…
              </div>
            )}
          </div>
        )}

        {/* Boleto panel */}
        {isBoleto && pag?.boleto_linha_digitavel && (
          <div style={{
            background:'var(--surface)', border:'1.5px solid var(--border)',
            borderRadius:'var(--r-xl)', overflow:'hidden', marginBottom:16,
            boxShadow:'var(--shadow-md)', animation:'fade-up .5s var(--ease) .7s both',
          }}>
            <div style={{
              background:'linear-gradient(135deg,#d97706,#f59e0b)',
              padding:'20px 24px',
            }}>
              <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,.7)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4 }}>
                Código de barras
              </div>
              <div style={{ fontSize:14, fontWeight:700, color:'white' }}>
                Vencimento: {new Date(pag.boleto_vencimento ?? '').toLocaleDateString('pt-BR')}
              </div>
            </div>
            <div style={{ padding:18 }}>
              <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                <div style={{
                  flex:1, background:'var(--surface-2)', border:'1.5px solid var(--border)',
                  borderRadius:'var(--r-md)', padding:'10px 12px',
                  fontSize:11, color:'var(--text-2)', fontFamily:'monospace',
                  wordBreak:'break-all', lineHeight:1.6, fontWeight:600,
                }}>
                  {pag.boleto_linha_digitavel}
                </div>
                <button onClick={() => copyToClipboard(pag.boleto_linha_digitavel ?? '')} style={{
                  background: copied ? 'var(--success)' : 'var(--brand)',
                  color:'white', border:'none', borderRadius:'var(--r-md)',
                  padding:'10px 16px', fontFamily:'inherit', fontSize:13, fontWeight:700,
                  cursor:'pointer', display:'flex', alignItems:'center', gap:6,
                  transition:'all .2s', flexShrink:0,
                }}>
                  {copied ? '✓' : 'Copiar'}
                </button>
              </div>
              <div style={{
                fontSize:12, color:'var(--text-3)', lineHeight:1.7,
                background:'var(--warn-light)', borderRadius:'var(--r-sm)',
                padding:'10px 14px', border:'1px solid #fde68a',
              }}>
                ⚠️ Pague em qualquer banco, lotérica ou pelo internet banking. A confirmação pode levar até <strong>2 dias úteis</strong>.
              </div>
            </div>
          </div>
        )}

        {/* Cartão confirmado */}
        {isCartao && isPago && (
          <div style={{
            background:'var(--success-light)', border:'1.5px solid #a7f3d0',
            borderRadius:'var(--r-xl)', padding:24, marginBottom:16,
            textAlign:'center', animation:'fade-up .5s var(--ease) .7s both',
          }}>
            <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
            <div style={{ fontSize:18, fontWeight:800, color:'#047857', marginBottom:6 }}>
              Pagamento aprovado!
            </div>
            <div style={{ fontSize:14, color:'#065f46', lineHeight:1.6 }}>
              Seu pagamento no cartão foi aprovado.<br />
              Você receberá a confirmação por e-mail.
            </div>
          </div>
        )}

        {/* Order summary */}
        <div style={{
          background:'var(--surface)', border:'1.5px solid var(--border)',
          borderRadius:'var(--r-xl)', overflow:'hidden', marginBottom:16,
          boxShadow:'var(--shadow-sm)', animation:'fade-up .5s var(--ease) .8s both',
        }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)' }}>
            <div style={{ fontSize:13, fontWeight:800, color:'var(--text-1)', letterSpacing:'-.01em' }}>
              Resumo do pedido
            </div>
            <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
              #{pedido.numero}
            </div>
          </div>
          {pedido.itens.map((item, i) => (
            <div key={item.id} style={{
              display:'flex', alignItems:'center', gap:12, padding:'12px 20px',
              borderTop: i > 0 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{
                width:40, height:40, borderRadius:'var(--r-sm)',
                background:'var(--surface-2)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:18, flexShrink:0,
              }}>
                {item.produto?.icon ?? CAT_ICONS[item.produto?.categoria ?? ''] ?? '📦'}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--text-1)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {item.produto?.nome ?? 'Produto'}
                </div>
                <div style={{ fontSize:11, color:'var(--text-3)', marginTop:1 }}>
                  {item.aluno?.nome?.split(' ')[0]} · {item.aluno?.serie}
                </div>
                {item.variante && (
                  <div style={{ fontSize:11, color:'var(--brand)', fontWeight:700, marginTop:3 }}>
                    Tamanho {item.variante}
                  </div>
                )}
              </div>
              <div style={{ fontSize:14, fontWeight:800, color:'var(--text-1)' }}>
                {fmtBRL(item.preco_unitario)}
              </div>
            </div>
          ))}
          <div style={{
            padding:'14px 20px', background:'var(--surface-2)',
            borderTop:'1px solid var(--border)',
            display:'flex', justifyContent:'space-between', alignItems:'center',
          }}>
            <span style={{ fontSize:14, fontWeight:600, color:'var(--text-2)' }}>Total</span>
            <span style={{ fontSize:20, fontWeight:800, color:'var(--text-1)', letterSpacing:'-.02em' }}>
              {fmtBRL(pedido.total)}
            </span>
          </div>
        </div>

        {/* CTA buttons */}
        <div className="no-print" style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <button
            onClick={handlePrint}
            style={{
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              height:48, background:'var(--surface)', color:'var(--text-2)',
              borderRadius:'var(--r-md)', fontFamily:'inherit',
              fontSize:14, fontWeight:700, cursor:'pointer',
              border:'1.5px solid var(--border)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            Imprimir / salvar PDF
          </button>

          {/* Botões de ingresso — exibidos quando há ingressos emitidos */}
          {pedido.itens.some(i => i.ingresso) && (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {pedido.itens.filter(i => i.ingresso).map(i => (
                <Link
                  key={i.ingresso!.id}
                  href={`/ingresso/${i.ingresso!.token}`}
                  style={{
                    display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                    height:52,
                    background: i.ingresso!.status === 'emitido'
                      ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
                      : 'var(--surface-2)',
                    color: i.ingresso!.status === 'emitido' ? '#fff' : 'var(--text-3)',
                    borderRadius:'var(--r-md)', fontFamily:'inherit',
                    fontSize:15, fontWeight:700, textDecoration:'none',
                    border: i.ingresso!.status === 'emitido' ? 'none' : '1.5px solid var(--border)',
                    animation:'fade-up .5s var(--ease) .85s both',
                  }}
                >
                  🎟️ Ver ingresso — {i.aluno.nome.split(' ')[0]}
                </Link>
              ))}
            </div>
          )}

          <Link href="/loja" style={{
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            height:52, background:'var(--brand)', color:'white',
            borderRadius:'var(--r-md)', fontFamily:'inherit',
            fontSize:15, fontWeight:700, textDecoration:'none',
            boxShadow:'0 4px 14px rgba(26,47,90,.3)',
            transition:'all .2s', animation:'fade-up .5s var(--ease) .9s both',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            Voltar à loja
          </Link>
          <Link href="/pedidos" style={{
            display:'flex', alignItems:'center', justifyContent:'center',
            height:48, background:'var(--surface)', color:'var(--text-2)',
            borderRadius:'var(--r-md)', fontFamily:'inherit',
            fontSize:14, fontWeight:600, textDecoration:'none',
            border:'1.5px solid var(--border)',
            animation:'fade-up .5s var(--ease) 1s both',
          }}>
            Ver meus pedidos
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes ring-pop { from{transform:scale(.5);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes icon-in  { from{transform:scale(0) rotate(-20deg);opacity:0} to{transform:scale(1) rotate(0);opacity:1} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  )
}

function Chip({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:6,
      background:'rgba(255,255,255,.12)', border:'1px solid rgba(255,255,255,.2)',
      borderRadius:'var(--r-pill)', padding:'6px 14px',
      fontSize:12, fontWeight:600, color:'rgba(255,255,255,.9)',
    }}>
      {icon} {children}
    </span>
  )
}
