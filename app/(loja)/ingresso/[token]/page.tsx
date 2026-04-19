import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import QRCode from 'qrcode'
import type { Produto, Aluno, Responsavel, StatusIngresso } from '@/types/database'
import { IngressoActions } from './IngressoActions'

// ── tipos ─────────────────────────────────────────────────────────────────────
interface IngressoDetalhado {
  id: string
  token: string
  status: StatusIngresso
  usado_em: string | null
  validado_por: string | null
  created_at: string
  produto: Produto
  aluno: Aluno
  responsavel: Responsavel
}

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })
}

function fmtHora(time: string | null) {
  if (!time) return null
  return time.slice(0, 5) // HH:mm
}

function fmtDataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const STATUS_CONFIG: Record<StatusIngresso, {
  label: string; emoji: string; color: string; bg: string; border: string
}> = {
  emitido:   { label: 'VÁLIDO',        emoji: '✅', color: '#065f46', bg: '#d1fae5', border: '#6ee7b7' },
  usado:     { label: 'JÁ UTILIZADO',  emoji: '⛔', color: '#7f1d1d', bg: '#fee2e2', border: '#fca5a5' },
  cancelado: { label: 'CANCELADO',     emoji: '🚫', color: '#374151', bg: '#f3f4f6', border: '#d1d5db' },
  expirado:  { label: 'EXPIRADO',      emoji: '⏰', color: '#78350f', bg: '#fef3c7', border: '#fcd34d' },
}

const CAT_ICONS: Record<string, string> = {
  eventos: '🎉', passeios: '🚌', segunda_chamada: '📝',
  materiais: '📚', uniforme: '👕', outros: '📦',
}

// ── page ──────────────────────────────────────────────────────────────────────
export default async function IngressoPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // Valida que é um UUID válido
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(token)) notFound()

  const supabase = await createClient()

  // Busca via função SECURITY DEFINER (não precisa de auth)
  const { data } = await supabase
    .rpc('get_ingresso_by_token', { p_token: token })

  if (!data) notFound()

  const ingresso = data as IngressoDetalhado
  const statusCfg = STATUS_CONFIG[ingresso.status]
  const produto = ingresso.produto
  const aluno = ingresso.aluno
  const isValido = ingresso.status === 'emitido'

  // Gera QR Code da URL de validação (para o check-in do admin escanear)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const validarUrl = `${siteUrl}/ingresso/${token}`
  const qrDataUrl = await QRCode.toDataURL(validarUrl, {
    width: 220,
    margin: 1,
    color: { dark: '#0f172a', light: '#ffffff' },
    errorCorrectionLevel: 'H',
  })

  const iniciais = aluno.nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const shareTitle = `Ingresso - ${produto.nome}`
  const shareText = `Ingresso de ${aluno.nome} para ${produto.nome}`
  const codigoIngresso = token.toUpperCase().replace(/-/g, '').slice(-12).replace(/(.{4})/g, '$1 ').trim()

  return (
    <div className="ingresso-print-root" style={{
      minHeight: '100dvh',
      background: 'linear-gradient(160deg, #f0f4ff 0%, #faf5ff 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '24px 16px 80px',
    }}>

      {/* Voltar */}
      <div style={{ width: '100%', maxWidth: 420, marginBottom: 16 }}>
        <Link href="/pedidos" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 13, fontWeight: 600, color: '#6366f1', textDecoration: 'none',
        }}>
          ← Meus pedidos
        </Link>
      </div>

      {/* Card do ingresso */}
      <div style={{
        width: '100%', maxWidth: 420,
        background: '#fff',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 8px 40px rgba(99,102,241,.12), 0 2px 8px rgba(0,0,0,.06)',
      }}>

        {/* Topo colorido */}
        <div style={{
          background: isValido
            ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
            : 'linear-gradient(135deg, #6b7280, #9ca3af)',
          padding: '28px 24px 32px',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Círculos decorativos */}
          <div style={{
            position: 'absolute', width: 160, height: 160, borderRadius: '50%',
            background: 'rgba(255,255,255,.08)', top: -40, right: -40,
          }} />
          <div style={{
            position: 'absolute', width: 100, height: 100, borderRadius: '50%',
            background: 'rgba(255,255,255,.06)', bottom: -20, left: -20,
          }} />

          {/* Label INGRESSO DIGITAL */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,.15)', backdropFilter: 'blur(8px)',
            padding: '4px 12px', borderRadius: 999,
            fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,.9)',
            letterSpacing: '.1em', marginBottom: 16,
          }}>
            🎟️ INGRESSO DIGITAL
          </div>

          {/* Nome do produto */}
          <h1 style={{
            fontSize: 22, fontWeight: 900, color: '#fff',
            margin: '0 0 6px', lineHeight: 1.2, letterSpacing: '-.02em',
          }}>
            {produto.icon ?? CAT_ICONS[produto.categoria] ?? '🎟️'} {produto.nome}
          </h1>

          {/* Status badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,.2)',
            padding: '5px 14px', borderRadius: 999,
            fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: '.05em',
          }}>
            {statusCfg.emoji} {statusCfg.label}
          </div>
        </div>

        {/* Borda serrilhada (divisor tipo ingresso) */}
        <div style={{
          height: 24, background: '#fff',
          borderTop: '2px dashed #e2e8f0',
          marginTop: -12, position: 'relative', zIndex: 1,
        }} />

        {/* QR Code */}
        <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>

          {/* Aluno */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: '#f8fafc', borderRadius: 12,
            padding: '12px 16px', width: '100%',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0,
            }}>
              {iniciais}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{aluno.nome}</div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                {aluno.serie}{aluno.turma ? ` · Turma ${aluno.turma}` : ''}
              </div>
            </div>
          </div>

          {/* QR Code */}
          <div style={{
            padding: 12, borderRadius: 16,
            border: `2px solid ${statusCfg.border}`,
            background: statusCfg.bg,
            position: 'relative',
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="QR Code do ingresso"
              width={220} height={220}
              style={{
                display: 'block', borderRadius: 8,
                filter: isValido ? 'none' : 'grayscale(1) opacity(.4)',
              }}
            />
            {/* Overlay se inválido */}
            {!isValido && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 14,
                background: 'rgba(0,0,0,.5)',
                backdropFilter: 'blur(2px)',
              }}>
                <div style={{
                  fontSize: 18, fontWeight: 900, color: '#fff',
                  textAlign: 'center', lineHeight: 1.4,
                  padding: '8px 16px', background: 'rgba(0,0,0,.6)',
                  borderRadius: 8,
                }}>
                  {statusCfg.emoji}<br />{statusCfg.label}
                </div>
              </div>
            )}
          </div>

          {/* Token ID (últimos 8 chars) */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, letterSpacing: '.08em' }}>
              CÓDIGO DO INGRESSO
            </div>
            <div style={{
              fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#374151',
              letterSpacing: '.12em', marginTop: 2,
            }}>
              {codigoIngresso}
            </div>
          </div>
        </div>

        {/* Detalhes do evento */}
        <div style={{
          margin: '0 16px 16px',
          background: '#f8fafc', borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}>
          {produto.data_evento && (
            <Row icon="📅" label="Data">
              {fmtData(produto.data_evento)}
            </Row>
          )}
          {produto.hora_evento && (
            <Row icon="🕐" label="Horário" border>
              {fmtHora(produto.hora_evento)}h
            </Row>
          )}
          {produto.local_evento && (
            <Row icon="📍" label="Local" border>
              {produto.local_evento}
            </Row>
          )}
          {!produto.data_evento && !produto.hora_evento && !produto.local_evento && (
            <div style={{ padding: '14px 16px', fontSize: 13, color: '#94a3b8' }}>
              Detalhes do evento serão divulgados em breve.
            </div>
          )}
        </div>

        {/* Aviso de uso */}
        {ingresso.status === 'usado' && ingresso.usado_em && (
          <div style={{
            margin: '0 16px 16px',
            background: '#fee2e2', borderRadius: 12, padding: '12px 16px',
            border: '1px solid #fca5a5',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', marginBottom: 2 }}>
              ⛔ Utilizado em {fmtDataHora(ingresso.usado_em)}
            </div>
            {ingresso.validado_por && (
              <div style={{ fontSize: 11, color: '#b91c1c' }}>
                Validado por: {ingresso.validado_por}
              </div>
            )}
          </div>
        )}

        {/* Emissão */}
        <div style={{
          padding: '12px 24px 24px',
          textAlign: 'center',
          fontSize: 11, color: '#94a3b8', lineHeight: 1.6,
        }}>
          Ingresso emitido em {fmtDataHora(ingresso.created_at)}<br />
          {ingresso.responsavel.nome} · {ingresso.responsavel.email}
        </div>
      </div>

      {/* Instrução */}
      {isValido && (
        <div style={{
          marginTop: 20, maxWidth: 420, width: '100%',
          background: '#eff6ff', border: '1px solid #bfdbfe',
          borderRadius: 12, padding: '12px 16px',
          fontSize: 13, color: '#1e40af', lineHeight: 1.6,
        }}>
          📱 <strong>Na entrada do evento:</strong> apresente esta tela ao funcionário para escaneamento do QR Code.
        </div>
      )}

      <style>{`
        @media print {
          body { background: white !important; }
          .ingresso-print-root {
            background: white !important;
            padding: 0 !important;
            min-height: unset !important;
            align-items: flex-start !important;
          }
          .no-print { display: none !important; }
          a[href]:after { content: none !important; }
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
        }
      `}</style>

      <IngressoActions
        shareUrl={validarUrl}
        title={shareTitle}
        text={shareText}
        qrDataUrl={qrDataUrl}
        produtoNome={produto.nome}
        alunoNome={aluno.nome}
        serieTurma={`${aluno.serie}${aluno.turma ? ` · Turma ${aluno.turma}` : ''}`}
        dataEvento={produto.data_evento ? fmtData(produto.data_evento) : null}
        horaEvento={produto.hora_evento ? `${fmtHora(produto.hora_evento)}h` : null}
        localEvento={produto.local_evento}
        codigoIngresso={codigoIngresso}
        statusLabel={statusCfg.label}
      />
    </div>
  )
}

// ── Componente auxiliar Row ───────────────────────────────────────────────────
function Row({ icon, label, border, children }: {
  icon: string; label: string; border?: boolean; children: React.ReactNode
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px',
      borderTop: border ? '1px solid #e2e8f0' : 'none',
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', width: 56, flexShrink: 0 }}>
        {label.toUpperCase()}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', flex: 1 }}>
        {children}
      </span>
    </div>
  )
}
