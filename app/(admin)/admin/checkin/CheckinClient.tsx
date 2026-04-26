'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { validarIngressoAction } from '@/app/actions/admin'
import type { Produto } from '@/types/database'

interface ProdutoCheckin extends Produto {
  total_emitido: number
  total_usado: number
}

interface ScanResult {
  ok: boolean
  motivo: string
  nome_aluno?: string
  nome_produto?: string
  usado_em?: string
  validado_por?: string
}

interface Contagem {
  emitido: number
  usado: number
}

const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

export function CheckinClient({ produtos }: { produtos: ProdutoCheckin[] }) {
  const [produtoId, setProdutoId] = useState<string>(produtos[0]?.id ?? '')
  const [scanning, setScanning] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [manualToken, setManualToken] = useState('')
  const [contagem, setContagem] = useState<Contagem>(() => {
    const p = produtos.find(x => x.id === produtos[0]?.id)
    return { emitido: p?.total_emitido ?? 0, usado: p?.total_usado ?? 0 }
  })
  const [cameraError, setCameraError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const lastScannedRef = useRef<string>('')
  const cooldownRef = useRef(false)
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const produtoSelecionado = produtos.find(p => p.id === produtoId)

  useEffect(() => {
    const p = produtos.find(x => x.id === produtoId)
    setContagem({ emitido: p?.total_emitido ?? 0, usado: p?.total_usado ?? 0 })
    setResult(null)
  }, [produtoId, produtos])

  useEffect(() => {
    if (!produtoId) return
    const supabase = createClient()

    const channel = supabase
      .channel(`checkin-${produtoId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ingressos', filter: `produto_id=eq.${produtoId}` }, () => {
        Promise.all([
          supabase.from('ingressos').select('*', { count: 'exact', head: true }).eq('produto_id', produtoId).eq('status', 'emitido'),
          supabase.from('ingressos').select('*', { count: 'exact', head: true }).eq('produto_id', produtoId).eq('status', 'usado'),
        ]).then(([{ count: emitido }, { count: usado }]) => {
          setContagem({ emitido: emitido ?? 0, usado: usado ?? 0 })
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [produtoId])

  const processarToken = useCallback(async (token: string) => {
    if (processing || cooldownRef.current) return
    if (token === lastScannedRef.current) return

    lastScannedRef.current = token
    cooldownRef.current = true
    setProcessing(true)
    setResult(null)

    const res = await validarIngressoAction(token, 'Admin (check-in)')
    setProcessing(false)
    setResult(res as ScanResult)

    if (resultTimerRef.current) clearTimeout(resultTimerRef.current)
    resultTimerRef.current = setTimeout(() => {
      setResult(null)
      lastScannedRef.current = ''
      cooldownRef.current = false
    }, 6000)
  }, [processing])

  const iniciarCamera = useCallback(async () => {
    setCameraError(null)
    setScanning(true)

    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const reader = new BrowserMultiFormatReader()
      if (!videoRef.current) return

      const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result, error) => {
        if (result) {
          const text = result.getText()
          const match = text.match(UUID_REGEX)
          if (match) processarToken(match[0])
        }
        void error
      })
      controlsRef.current = controls
    } catch (err) {
      setScanning(false)
      setCameraError(
        err instanceof Error && err.message.includes('Permission')
          ? 'Permissão de câmera negada. Libere o acesso nas configurações do browser.'
          : 'Não foi possível acessar a câmera. Verifique as permissões.'
      )
    }
  }, [processarToken])

  const pararCamera = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    setScanning(false)
    setCameraError(null)
  }, [])

  useEffect(() => {
    return () => {
      controlsRef.current?.stop()
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current)
    }
  }, [])

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    const token = manualToken.trim()
    if (!token) return
    lastScannedRef.current = ''
    await processarToken(token)
    setManualToken('')
  }

  const totalPresentes = contagem.usado
  const totalEsperados = contagem.emitido + contagem.usado
  const pct = totalEsperados > 0 ? Math.round((totalPresentes / totalEsperados) * 100) : 0

  return (
    <div style={{ maxWidth: 540, margin: '0 auto', paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#f8fafc', margin: '0 0 6px', letterSpacing: '-.03em' }}>
          📷 Check-in
        </h1>
        <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, fontWeight: 500 }}>
          Escaneie o QR Code do ingresso digital para validar a entrada.
        </p>
      </div>

      {produtos.length === 0 ? (
        <div style={{
          background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.25)',
          borderRadius: 12, padding: '16px 20px', fontSize: 14, color: '#fcd34d',
        }}>
          ⚠️ Nenhum produto com ingresso ativo encontrado.
        </div>
      ) : (
        <>
          {/* Seletor de evento */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,.35)', marginBottom: 8, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              Evento
            </label>
            <select
              value={produtoId}
              onChange={e => { setProdutoId(e.target.value); pararCamera() }}
              style={{
                width: '100%', padding: '10px 14px',
                borderRadius: 10, border: '1px solid rgba(255,255,255,.1)',
                fontSize: 14, fontWeight: 600, color: '#f8fafc',
                background: 'rgba(0,0,0,.2)', appearance: 'none', cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {produtos.map(p => (
                <option key={p.id} value={p.id} style={{ color: '#000' }}>
                  {p.icon ?? '🎟️'} {p.nome}
                  {p.data_evento ? ` — ${new Date(p.data_evento).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Contador */}
          <div style={{
            background: 'rgba(255,255,255,.02)', border: '1.5px solid rgba(255,255,255,.06)',
            borderRadius: 16, padding: '20px 24px', marginBottom: 20,
            backdropFilter: 'blur(16px)',
          }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <StatBox value={totalPresentes} label="Presentes" color="#4ade80" bg="rgba(16,185,129,.1)" border="rgba(16,185,129,.2)" />
              <StatBox value={contagem.emitido} label="Aguardando" color="#60a5fa" bg="rgba(59,130,246,.1)" border="rgba(59,130,246,.2)" />
              <StatBox value={totalEsperados} label="Total" color="#f8fafc" bg="rgba(255,255,255,.04)" border="rgba(255,255,255,.1)" />
            </div>

            {/* Barra de progresso */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>Presença</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#4ade80' }}>{pct}%</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,.08)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 999,
                  background: 'linear-gradient(90deg, #22c55e, #16a34a)',
                  width: `${pct}%`, transition: 'width .4s ease',
                }} />
              </div>
            </div>
          </div>

          {/* Resultado do scan */}
          {(result || processing) && (
            <div style={{
              borderRadius: 14, padding: '16px 20px', marginBottom: 20,
              background: processing
                ? 'rgba(255,255,255,.04)'
                : result?.ok
                  ? 'rgba(16,185,129,.1)'
                  : 'rgba(239,68,68,.1)',
              border: `2px solid ${processing ? 'rgba(255,255,255,.1)' : result?.ok ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)'}`,
              display: 'flex', alignItems: 'flex-start', gap: 14,
              animation: 'fadeIn .2s ease',
            }}>
              <div style={{ fontSize: 32, lineHeight: 1, flexShrink: 0 }}>
                {processing ? '⏳' : result?.ok ? '✅' : '⛔'}
              </div>
              <div>
                <div style={{
                  fontSize: 16, fontWeight: 800, marginBottom: 4,
                  color: processing ? '#94a3b8' : result?.ok ? '#4ade80' : '#f87171',
                }}>
                  {processing ? 'Validando…' : result?.ok ? 'ENTRADA LIBERADA' : 'ENTRADA NEGADA'}
                </div>
                {!processing && result && (
                  <div style={{ fontSize: 13, color: result?.ok ? '#86efac' : '#fca5a5' }}>
                    {result.motivo}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Câmera */}
          <div style={{
            background: 'rgba(255,255,255,.02)', border: '1.5px solid rgba(255,255,255,.06)',
            borderRadius: 16, overflow: 'hidden', marginBottom: 20,
            backdropFilter: 'blur(16px)',
          }}>
            <div style={{
              position: 'relative', background: '#060d1a',
              aspectRatio: '1 / 1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <video
                ref={videoRef}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: scanning ? 'block' : 'none' }}
                playsInline muted
              />

              {!scanning && (
                <div style={{ textAlign: 'center', padding: 32 }}>
                  <div style={{ fontSize: 64, marginBottom: 12 }}>📷</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,.3)' }}>
                    Câmera desligada
                  </div>
                </div>
              )}

              {scanning && !processing && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <div style={{ width: 200, height: 200, border: '3px solid rgba(99,102,241,.8)', borderRadius: 16, boxShadow: '0 0 0 9999px rgba(0,0,0,.4)', position: 'relative' }}>
                    {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(corner => (
                      <div key={corner} style={{
                        position: 'absolute', width: 24, height: 24, borderColor: '#6366f1', borderStyle: 'solid', borderWidth: 0,
                        ...(corner.includes('top') ? { top: -3 } : { bottom: -3 }),
                        ...(corner.includes('left') ? { left: -3 } : { right: -3 }),
                        ...(corner.includes('top') && corner.includes('left') ? { borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 6 } : {}),
                        ...(corner.includes('top') && corner.includes('right') ? { borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 6 } : {}),
                        ...(corner.includes('bottom') && corner.includes('left') ? { borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 6 } : {}),
                        ...(corner.includes('bottom') && corner.includes('right') ? { borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 6 } : {}),
                      }} />
                    ))}
                    <div style={{ position: 'absolute', left: 8, right: 8, height: 2, background: 'linear-gradient(90deg, transparent, #6366f1, transparent)', top: '50%', animation: 'scanLine 1.5s ease-in-out infinite' }} />
                  </div>
                </div>
              )}

              {scanning && processing && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ background: 'rgba(255,255,255,.08)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 14, padding: '16px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>Validando…</div>
                  </div>
                </div>
              )}
            </div>

            {/* Botões câmera */}
            <div style={{ padding: '16px 16px 20px', display: 'flex', gap: 10 }}>
              {!scanning ? (
                <button onClick={iniciarCamera} style={{
                  flex: 1, height: 48,
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  color: '#fff', border: 'none', borderRadius: 12,
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  📷 Ligar câmera
                </button>
              ) : (
                <button onClick={pararCamera} style={{
                  flex: 1, height: 48,
                  background: 'rgba(255,255,255,.06)', color: '#94a3b8',
                  border: '1px solid rgba(255,255,255,.1)', borderRadius: 12,
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}>
                  ⏹ Desligar câmera
                </button>
              )}
            </div>

            {cameraError && (
              <div style={{
                margin: '0 16px 16px', padding: '12px 16px',
                background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)',
                borderRadius: 10, fontSize: 13, color: '#fca5a5',
              }}>
                ⚠️ {cameraError}
              </div>
            )}
          </div>

          {/* Entrada manual */}
          <div style={{
            background: 'rgba(255,255,255,.02)', border: '1.5px solid rgba(255,255,255,.06)',
            borderRadius: 16, padding: '20px', backdropFilter: 'blur(16px)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', marginBottom: 12 }}>
              🔢 Inserir código manualmente
            </div>
            <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: 10 }}>
              <input
                value={manualToken}
                onChange={e => setManualToken(e.target.value)}
                placeholder="Cole o token UUID do ingresso…"
                style={{
                  flex: 1, height: 44, padding: '0 14px',
                  borderRadius: 10, border: '1px solid rgba(255,255,255,.1)',
                  fontSize: 13, fontFamily: 'monospace',
                  color: '#f8fafc', background: 'rgba(0,0,0,.2)',
                }}
              />
              <button
                type="submit"
                disabled={!manualToken.trim() || processing}
                style={{
                  height: 44, padding: '0 18px',
                  background: manualToken.trim() && !processing ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.03)',
                  color: manualToken.trim() && !processing ? '#f8fafc' : 'rgba(255,255,255,.2)',
                  border: '1px solid rgba(255,255,255,.1)', borderRadius: 10,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                Validar
              </button>
            </form>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', margin: '8px 0 0' }}>
              O token é o UUID exibido no ingresso digital (ex: 9aeef2df-3ef2-…)
            </p>
          </div>
        </>
      )}

      {/* Detalhe do evento */}
      {produtoSelecionado && (
        <div style={{
          marginTop: 20, padding: '14px 16px',
          background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)',
          borderRadius: 12, fontSize: 12, color: '#94a3b8',
          display: 'flex', gap: 16, flexWrap: 'wrap',
        }}>
          {produtoSelecionado.data_evento && (
            <span>📅 {new Date(produtoSelecionado.data_evento).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</span>
          )}
          {produtoSelecionado.hora_evento && (
            <span>🕐 {produtoSelecionado.hora_evento.slice(0, 5)}h</span>
          )}
          {produtoSelecionado.local_evento && (
            <span>📍 {produtoSelecionado.local_evento}</span>
          )}
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scanLine {
          0%, 100% { transform: translateY(-60px); opacity: 0; }
          10%, 90%  { opacity: 1; }
          50%       { transform: translateY(60px); }
        }
      `}</style>
    </div>
  )
}

function StatBox({ value, label, color, bg, border }: { value: number; label: string; color: string; bg: string; border: string }) {
  return (
    <div style={{ flex: 1, background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: 28, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color, opacity: .8, marginTop: 2 }}>{label.toUpperCase()}</div>
    </div>
  )
}
