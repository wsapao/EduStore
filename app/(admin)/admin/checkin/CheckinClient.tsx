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

  // ── Atualiza contagem quando muda produto ──────────────────────────────────
  useEffect(() => {
    const p = produtos.find(x => x.id === produtoId)
    setContagem({ emitido: p?.total_emitido ?? 0, usado: p?.total_usado ?? 0 })
    setResult(null)
  }, [produtoId, produtos])

  // ── Supabase Realtime — contador ao vivo ───────────────────────────────────
  useEffect(() => {
    if (!produtoId) return
    const supabase = createClient()

    const channel = supabase
      .channel(`checkin-${produtoId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ingressos',
          filter: `produto_id=eq.${produtoId}`,
        },
        () => {
          // Re-fetch contagem ao detectar qualquer mudança
          Promise.all([
            supabase
              .from('ingressos')
              .select('*', { count: 'exact', head: true })
              .eq('produto_id', produtoId)
              .eq('status', 'emitido'),
            supabase
              .from('ingressos')
              .select('*', { count: 'exact', head: true })
              .eq('produto_id', produtoId)
              .eq('status', 'usado'),
          ]).then(([{ count: emitido }, { count: usado }]) => {
            setContagem({ emitido: emitido ?? 0, usado: usado ?? 0 })
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [produtoId])

  // ── Processar token (câmera ou manual) ────────────────────────────────────
  const processarToken = useCallback(async (token: string) => {
    if (processing || cooldownRef.current) return
    if (token === lastScannedRef.current) return

    lastScannedRef.current = token
    cooldownRef.current = true
    setProcessing(true)
    setResult(null)

    // Validador: email admin hardcoded por ora (poderia vir de user session)
    const res = await validarIngressoAction(token, 'Admin (check-in)')
    setProcessing(false)
    setResult(res as ScanResult)

    // Limpa resultado após 6s
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current)
    resultTimerRef.current = setTimeout(() => {
      setResult(null)
      lastScannedRef.current = ''
      cooldownRef.current = false
    }, 6000)
  }, [processing])

  // ── Iniciar câmera ────────────────────────────────────────────────────────
  const iniciarCamera = useCallback(async () => {
    setCameraError(null)
    setScanning(true)

    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const reader = new BrowserMultiFormatReader()

      if (!videoRef.current) return

      const controls = await reader.decodeFromVideoDevice(
        undefined, // usa câmera traseira/padrão
        videoRef.current,
        (result, error) => {
          if (result) {
            const text = result.getText()
            // Extrai UUID do token da URL ou usa direto
            const match = text.match(UUID_REGEX)
            if (match) processarToken(match[0])
          }
          // Ignora erros de "nenhum QR encontrado no frame" (NotFoundException)
          void error
        }
      )
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

  // ── Parar câmera ─────────────────────────────────────────────────────────
  const pararCamera = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    setScanning(false)
    setCameraError(null)
  }, [])

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      controlsRef.current?.stop()
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current)
    }
  }, [])

  // ── Envio do formulário manual ────────────────────────────────────────────
  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    const token = manualToken.trim()
    if (!token) return
    lastScannedRef.current = '' // permite re-scan do mesmo token manualmente
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
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', margin: '0 0 4px', letterSpacing: '-.03em' }}>
          📷 Check-in
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
          Escaneie o QR Code do ingresso digital para validar a entrada.
        </p>
      </div>

      {/* Seletor de evento */}
      {produtos.length === 0 ? (
        <div style={{
          background: '#fef3c7', border: '1px solid #fcd34d',
          borderRadius: 12, padding: '16px 20px',
          fontSize: 14, color: '#92400e',
        }}>
          ⚠️ Nenhum produto com ingresso ativo encontrado.
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6, letterSpacing: '.04em' }}>
              EVENTO
            </label>
            <select
              value={produtoId}
              onChange={e => { setProdutoId(e.target.value); pararCamera() }}
              style={{
                width: '100%', padding: '10px 14px',
                borderRadius: 10, border: '1.5px solid #e2e8f0',
                fontSize: 14, fontWeight: 600, color: '#0f172a',
                background: '#fff', appearance: 'none',
                cursor: 'pointer',
              }}
            >
              {produtos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.icon ?? '🎟️'} {p.nome}
                  {p.data_evento ? ` — ${new Date(p.data_evento).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Contador */}
          <div style={{
            background: '#fff', border: '1.5px solid #e2e8f0',
            borderRadius: 16, padding: '20px 24px',
            marginBottom: 20,
          }}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              {/* Presentes */}
              <div style={{
                flex: 1, background: '#f0fdf4', border: '1px solid #86efac',
                borderRadius: 12, padding: '14px 16px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#16a34a' }}>
                  {totalPresentes}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#15803d', marginTop: 2 }}>
                  PRESENTES
                </div>
              </div>

              {/* Aguardando */}
              <div style={{
                flex: 1, background: '#eff6ff', border: '1px solid #93c5fd',
                borderRadius: 12, padding: '14px 16px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#2563eb' }}>
                  {contagem.emitido}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', marginTop: 2 }}>
                  AGUARDANDO
                </div>
              </div>

              {/* Total */}
              <div style={{
                flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0',
                borderRadius: 12, padding: '14px 16px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#0f172a' }}>
                  {totalEsperados}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginTop: 2 }}>
                  TOTAL
                </div>
              </div>
            </div>

            {/* Barra de progresso */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Presença</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>{pct}%</span>
              </div>
              <div style={{ height: 8, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 999,
                  background: 'linear-gradient(90deg, #22c55e, #16a34a)',
                  width: `${pct}%`,
                  transition: 'width .4s ease',
                }} />
              </div>
            </div>
          </div>

          {/* Resultado do scan */}
          {(result || processing) && (
            <div style={{
              borderRadius: 14, padding: '16px 20px',
              marginBottom: 20,
              background: processing
                ? '#f1f5f9'
                : result?.ok
                  ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)'
                  : 'linear-gradient(135deg, #fef2f2, #fee2e2)',
              border: `2px solid ${processing ? '#e2e8f0' : result?.ok ? '#86efac' : '#fca5a5'}`,
              display: 'flex', alignItems: 'flex-start', gap: 14,
              animation: 'fadeIn .2s ease',
            }}>
              <div style={{ fontSize: 32, lineHeight: 1, flexShrink: 0 }}>
                {processing ? '⏳' : result?.ok ? '✅' : '⛔'}
              </div>
              <div>
                <div style={{
                  fontSize: 16, fontWeight: 800,
                  color: processing ? '#64748b' : result?.ok ? '#15803d' : '#b91c1c',
                  marginBottom: 4,
                }}>
                  {processing ? 'Validando…' : result?.ok ? 'ENTRADA LIBERADA' : 'ENTRADA NEGADA'}
                </div>
                {!processing && result && (
                  <div style={{ fontSize: 13, color: processing ? '#94a3b8' : result?.ok ? '#166534' : '#991b1b' }}>
                    {result.motivo}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Área da câmera */}
          <div style={{
            background: '#fff', border: '1.5px solid #e2e8f0',
            borderRadius: 16, overflow: 'hidden',
            marginBottom: 20,
          }}>
            {/* Preview de vídeo */}
            <div style={{
              position: 'relative',
              background: '#0f172a',
              aspectRatio: '1 / 1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <video
                ref={videoRef}
                style={{
                  width: '100%', height: '100%',
                  objectFit: 'cover',
                  display: scanning ? 'block' : 'none',
                }}
                playsInline
                muted
              />

              {!scanning && (
                <div style={{ textAlign: 'center', color: '#475569', padding: 32 }}>
                  <div style={{ fontSize: 64, marginBottom: 12 }}>📷</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#94a3b8' }}>
                    Câmera desligada
                  </div>
                </div>
              )}

              {/* Mira do scan */}
              {scanning && !processing && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  pointerEvents: 'none',
                }}>
                  <div style={{
                    width: 200, height: 200,
                    border: '3px solid rgba(99,102,241,.8)',
                    borderRadius: 16,
                    boxShadow: '0 0 0 9999px rgba(0,0,0,.35)',
                    position: 'relative',
                  }}>
                    {/* Cantos animados */}
                    {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(corner => (
                      <div key={corner} style={{
                        position: 'absolute',
                        width: 24, height: 24,
                        borderColor: '#6366f1',
                        borderStyle: 'solid',
                        borderWidth: 0,
                        ...(corner.includes('top') ? { top: -3 } : { bottom: -3 }),
                        ...(corner.includes('left') ? { left: -3 } : { right: -3 }),
                        ...(corner.includes('top') && corner.includes('left') ? { borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 6 } : {}),
                        ...(corner.includes('top') && corner.includes('right') ? { borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 6 } : {}),
                        ...(corner.includes('bottom') && corner.includes('left') ? { borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 6 } : {}),
                        ...(corner.includes('bottom') && corner.includes('right') ? { borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 6 } : {}),
                      }} />
                    ))}

                    {/* Linha de scan */}
                    <div style={{
                      position: 'absolute',
                      left: 8, right: 8, height: 2,
                      background: 'linear-gradient(90deg, transparent, #6366f1, transparent)',
                      top: '50%',
                      animation: 'scanLine 1.5s ease-in-out infinite',
                    }} />
                  </div>
                </div>
              )}

              {/* Overlay processando */}
              {scanning && processing && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(0,0,0,.6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{
                    background: '#fff', borderRadius: 14,
                    padding: '16px 24px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Validando…</div>
                  </div>
                </div>
              )}
            </div>

            {/* Botões câmera */}
            <div style={{ padding: '16px 16px 20px', display: 'flex', gap: 10 }}>
              {!scanning ? (
                <button
                  onClick={iniciarCamera}
                  style={{
                    flex: 1, height: 48,
                    background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                    color: '#fff', border: 'none', borderRadius: 12,
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  📷 Ligar câmera
                </button>
              ) : (
                <button
                  onClick={pararCamera}
                  style={{
                    flex: 1, height: 48,
                    background: '#f1f5f9',
                    color: '#475569', border: '1.5px solid #e2e8f0', borderRadius: 12,
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  ⏹ Desligar câmera
                </button>
              )}
            </div>

            {/* Erro de câmera */}
            {cameraError && (
              <div style={{
                margin: '0 16px 16px', padding: '12px 16px',
                background: '#fef2f2', border: '1px solid #fca5a5',
                borderRadius: 10, fontSize: 13, color: '#b91c1c',
              }}>
                ⚠️ {cameraError}
              </div>
            )}
          </div>

          {/* Entrada manual */}
          <div style={{
            background: '#fff', border: '1.5px solid #e2e8f0',
            borderRadius: 16, padding: '20px',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>
              🔢 Inserir código manualmente
            </div>
            <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: 10 }}>
              <input
                value={manualToken}
                onChange={e => setManualToken(e.target.value)}
                placeholder="Cole o token UUID do ingresso…"
                style={{
                  flex: 1, height: 44, padding: '0 14px',
                  borderRadius: 10, border: '1.5px solid #e2e8f0',
                  fontSize: 13, fontFamily: 'monospace',
                  color: '#0f172a', background: '#f8fafc',
                }}
              />
              <button
                type="submit"
                disabled={!manualToken.trim() || processing}
                style={{
                  height: 44, padding: '0 18px',
                  background: manualToken.trim() && !processing ? '#0f172a' : '#e2e8f0',
                  color: manualToken.trim() && !processing ? '#fff' : '#94a3b8',
                  border: 'none', borderRadius: 10,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Validar
              </button>
            </form>
            <p style={{ fontSize: 11, color: '#94a3b8', margin: '8px 0 0' }}>
              O token é o UUID exibido no ingresso digital (ex: 9aeef2df-3ef2-…)
            </p>
          </div>
        </>
      )}

      {/* Produto detalhes */}
      {produtoSelecionado && (
        <div style={{
          marginTop: 20, padding: '14px 16px',
          background: '#f8fafc', border: '1px solid #e2e8f0',
          borderRadius: 12, fontSize: 12, color: '#64748b',
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
