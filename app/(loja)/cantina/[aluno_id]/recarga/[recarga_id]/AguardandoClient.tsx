'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { renovarRecargaAction } from '@/app/actions/cantina'

interface Props {
  recargaId: string
  alunoId: string
  alunoNome: string
  valor: number
  metodo: 'pix' | 'cartao'
  pixQrCode: string
  pixQrCodeImagem: string
  pixExpiracao: string
  statusInicial: 'aguardando' | 'confirmada' | 'expirada' | 'falhou'
}

type Estado = 'aguardando' | 'confirmada' | 'expirada'

function fmtMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function calcSegs(expiracao: string): number {
  if (!expiracao) return 0
  return Math.max(0, Math.floor((new Date(expiracao).getTime() - Date.now()) / 1000))
}

function fmtCountdown(segs: number): string {
  const m = Math.floor(segs / 60).toString().padStart(2, '0')
  const s = (segs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export function AguardandoClient({
  recargaId, alunoId, alunoNome, valor,
  metodo,
  pixQrCode: initialQrCode,
  pixQrCodeImagem: initialQrImagem,
  pixExpiracao: initialExpiracao,
  statusInicial,
}: Props) {
  const router = useRouter()

  const estadoInicial: Estado =
    statusInicial === 'confirmada' ? 'confirmada'
    : statusInicial !== 'aguardando' ? 'expirada'
    : calcSegs(initialExpiracao) <= 0 ? 'expirada'
    : 'aguardando'

  const [estado, setEstado] = useState<Estado>(estadoInicial)
  const [segsRestantes, setSegsRestantes] = useState(() => calcSegs(initialExpiracao))
  const [qrCode, setQrCode] = useState(initialQrCode)
  const [qrImagem, setQrImagem] = useState(initialQrImagem)
  const [expiracao, setExpiracao] = useState(initialExpiracao)
  const [copiado, setCopiado] = useState(false)
  const [renovando, setRenovando] = useState(false)
  const [erroRenovacao, setErroRenovacao] = useState<string | null>(null)
  const [realtimeOk, setRealtimeOk] = useState(true)

  // Supabase Realtime — escuta UPDATE na recarga específica
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`recarga-${recargaId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cantina_recargas',
          filter: `id=eq.${recargaId}`,
        },
        (payload) => {
          const novo = payload.new as { status: string }
          if (novo.status === 'confirmada') {
            setEstado('confirmada')
          }
        }
      )
      .subscribe((status) => {
        setRealtimeOk(status === 'SUBSCRIBED')
      })

    return () => { void supabase.removeChannel(channel) }
  }, [recargaId])

  // Polling fallback — verifica status a cada 5s caso Realtime falhe
  useEffect(() => {
    if (estado !== 'aguardando') return
    const supabase = createClient()
    const iv = setInterval(async () => {
      const { data } = await supabase
        .from('cantina_recargas' as any)
        .select('status')
        .eq('id', recargaId)
        .single()
      if (data?.status === 'confirmada') setEstado('confirmada')
    }, 5000)
    return () => clearInterval(iv)
  }, [estado, recargaId])

  // Countdown — atualiza a cada segundo
  useEffect(() => {
    if (estado !== 'aguardando') return
    const iv = setInterval(() => {
      const segs = calcSegs(expiracao)
      setSegsRestantes(segs)
      if (segs <= 0) {
        setEstado('expirada')
        clearInterval(iv)
      }
    }, 1000)
    return () => clearInterval(iv)
  }, [estado, expiracao])

  // Auto-redirect 3s após confirmação
  useEffect(() => {
    if (estado !== 'confirmada') return
    const t = setTimeout(() => {
      router.push(`/cantina/${alunoId}/extrato`)
    }, 3000)
    return () => clearTimeout(t)
  }, [estado, alunoId, router])

  const handleCopiar = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(qrCode)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // clipboard unavailable in non-secure context or old WebView
    }
  }, [qrCode])

  const handleRenovar = useCallback(async () => {
    setRenovando(true)
    setErroRenovacao(null)
    const res = await renovarRecargaAction(recargaId)
    if ('error' in res) {
      setErroRenovacao(res.error ?? 'Erro ao renovar PIX.')
      setRenovando(false)
      return
    }
    setQrCode(res.pix_qr_code)
    setQrImagem(res.pix_qr_code_imagem)
    setExpiracao(res.pix_expiracao)
    setSegsRestantes(calcSegs(res.pix_expiracao))
    setEstado('aguardando')
    setRenovando(false)
  }, [recargaId])

  // ── Estado: Confirmado ────────────────────────────────────────
  if (estado === 'confirmada') {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ fontSize: 64 }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', marginTop: 16 }}>
          Saldo creditado!
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 8 }}>
          {fmtMoeda(valor)} adicionados ao saldo de {alunoNome.split(' ')[0]}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 12 }}>
          Redirecionando em 3s…
        </div>
      </div>
    )
  }

  // ── Estado: Expirado ──────────────────────────────────────────
  if (estado === 'expirada') {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ fontSize: 64 }}>⏰</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', marginTop: 16 }}>
          PIX expirado
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 8 }}>
          O prazo para pagamento expirou. Gere um novo PIX para continuar.
        </div>
        {erroRenovacao && (
          <div style={{ marginTop: 12, fontSize: 13, color: '#991b1b', fontWeight: 600 }}>
            ❌ {erroRenovacao}
          </div>
        )}
        <button
          onClick={handleRenovar}
          disabled={renovando}
          style={{
            marginTop: 24, padding: '13px 32px',
            background: 'var(--brand)', color: '#fff',
            border: 'none', borderRadius: 'var(--r-md)',
            fontSize: 15, fontWeight: 800,
            cursor: renovando ? 'not-allowed' : 'pointer',
            opacity: renovando ? 0.7 : 1,
          }}
        >
          {renovando ? 'Gerando…' : 'Gerar novo PIX'}
        </button>
      </div>
    )
  }

  // ── Estado: Aguardando (principal) ────────────────────────────
  if (metodo === 'cartao') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)', padding: '12px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.07em' }}>
            Valor da recarga
          </span>
          <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand)' }}>
            {fmtMoeda(valor)}
          </span>
        </div>

        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-xl)', padding: '40px 24px', gap: 16,
        }}>
          <div style={{ fontSize: 48 }}>💳</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-1)', textAlign: 'center' }}>
            Aguardando confirmação
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', textAlign: 'center', maxWidth: 280 }}>
            Seu pagamento com cartão está sendo processado. Isso pode levar alguns instantes.
          </div>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            border: '3px solid var(--border)',
            borderTopColor: 'var(--brand)',
            animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>

        {!realtimeOk && (
          <button
            onClick={() => router.refresh()}
            style={{
              padding: '10px', borderRadius: 'var(--r-md)',
              background: 'var(--surface)', border: '1px solid var(--border)',
              cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-2)',
            }}
          >
            🔄 Verificar pagamento
          </button>
        )}
      </div>
    )
  }

  // ── PIX: UI completa com QR code ──────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <div style={{
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)', padding: '12px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.07em' }}>
          Valor da recarga
        </span>
        <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand)' }}>
          {fmtMoeda(valor)}
        </span>
      </div>

      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        background: '#fff', border: '1px solid var(--border)',
        borderRadius: 'var(--r-xl)', padding: '24px',
      }}>
        {qrImagem ? (
          <img
            src={qrImagem}
            alt="QR Code PIX"
            width={220}
            height={220}
            style={{ borderRadius: 8, display: 'block' }}
          />
        ) : (
          <div style={{
            width: 220, height: 220,
            background: 'var(--surface-2)', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, color: 'var(--text-3)',
          }}>
            Carregando…
          </div>
        )}
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-3)' }}>
          Escaneie o QR Code no app do banco
        </div>
      </div>

      <div>
        <div style={{
          fontSize: 12, fontWeight: 700, color: 'var(--text-3)',
          textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8,
        }}>
          Ou copie o código PIX
        </div>
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center',
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)', padding: '10px 12px',
        }}>
          <span style={{
            flex: 1, fontSize: 11, color: 'var(--text-2)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontFamily: 'monospace',
          }}>
            {qrCode}
          </span>
          <button
            onClick={handleCopiar}
            style={{
              padding: '5px 12px', borderRadius: 'var(--r-sm)',
              background: copiado ? '#16a34a' : 'var(--brand)',
              color: '#fff', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700, flexShrink: 0,
              transition: 'background .2s',
            }}
          >
            {copiado ? 'Copiado! ✓' : 'Copiar'}
          </button>
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        background: segsRestantes < 60 ? '#fff7ed' : 'var(--surface-2)',
        border: `1px solid ${segsRestantes < 60 ? '#fed7aa' : 'var(--border)'}`,
        borderRadius: 'var(--r-md)', padding: '12px',
      }}>
        <span style={{
          fontSize: 13, fontWeight: 600,
          color: segsRestantes < 60 ? '#9a3412' : 'var(--text-2)',
        }}>
          ⏱ Expira em:
        </span>
        <span style={{
          fontSize: 20, fontWeight: 800,
          color: segsRestantes < 60 ? '#dc2626' : 'var(--text-1)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {fmtCountdown(segsRestantes)}
        </span>
      </div>

      {!realtimeOk && (
        <button
          onClick={() => router.refresh()}
          style={{
            padding: '10px', borderRadius: 'var(--r-md)',
            background: 'var(--surface)', border: '1px solid var(--border)',
            cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-2)',
          }}
        >
          🔄 Verificar pagamento
        </button>
      )}

    </div>
  )
}
