import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import QRCode from 'qrcode'

function fmtBRL(v: number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default async function CartaoVirtualPage({
  params,
}: {
  params: Promise<{ aluno_id: string }>
}) {
  const { aluno_id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verificar vínculo
  const { data: vinculo } = await supabase
    .from('responsavel_aluno')
    .select('aluno_id')
    .eq('responsavel_id', user.id)
    .eq('aluno_id', aluno_id)
    .single()

  if (!vinculo) notFound()

  const { data: aluno } = await supabase
    .from('alunos')
    .select('id, nome, serie, turma')
    .eq('id', aluno_id)
    .single()

  if (!aluno) notFound()

  const { data: carteira } = await supabase
    .from('cantina_carteiras')
    .select('*')
    .eq('aluno_id', aluno_id)
    .single()

  if (!carteira) redirect('/cantina')

  // Buscar último consumo
  const { data: ultimoConsumoArr } = await supabase
    .from('cantina_movimentacoes')
    .select('created_at, valor')
    .eq('carteira_id', carteira.id)
    .eq('tipo', 'consumo')
    .order('created_at', { ascending: false })
    .limit(1)

  const ultimoConsumo = ultimoConsumoArr?.[0] ?? null

  // Gerar QR Code
  const qrDataUrl = await QRCode.toDataURL(carteira.qr_token, {
    width: 240,
    margin: 2,
    color: { dark: '#1a2f5a', light: '#ffffff' },
  })

  // Código exibido (8 chars do token)
  const codigoDisplay = carteira.qr_token.replace(/-/g, '').toUpperCase().slice(0, 8)

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 20px 48px' }}>

      {/* Header com back */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link href="/cantina" style={{
          width: 36, height: 36, borderRadius: 'var(--r-md)',
          background: 'var(--surface)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          textDecoration: 'none', color: 'var(--text-2)', fontSize: 16,
          boxShadow: 'var(--shadow-xs)',
        }}>
          ←
        </Link>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>
            Cartão Virtual
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '2px 0 0' }}>
            {aluno.nome}
          </p>
        </div>
      </div>

      {/* Card principal com gradiente */}
      <div style={{
        background: 'linear-gradient(135deg, var(--brand) 0%, #243b70 60%, #3451a1 100%)',
        borderRadius: 'var(--r-xl)',
        padding: '28px 24px 24px',
        color: '#fff',
        marginBottom: 16,
        boxShadow: '0 8px 32px rgba(26,47,90,.4)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Círculos decorativos */}
        <div style={{
          position: 'absolute', top: -30, right: -30,
          width: 120, height: 120, borderRadius: '50%',
          background: 'rgba(255,255,255,.05)',
        }} />
        <div style={{
          position: 'absolute', bottom: -20, left: -20,
          width: 80, height: 80, borderRadius: '50%',
          background: 'rgba(255,255,255,.05)',
        }} />

        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 11, fontWeight: 700, opacity: .6, letterSpacing: '.1em', marginBottom: 4 }}>
            CANTINA ESCOLAR
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-.02em', marginBottom: 4 }}>
            {aluno.nome.split(' ').slice(0, 2).join(' ')}
          </div>
          <div style={{ fontSize: 12, opacity: .7, marginBottom: 24 }}>
            {aluno.serie}{aluno.turma ? ` · Turma ${aluno.turma}` : ''}
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-.03em' }}>
              {fmtBRL(Number(carteira.saldo))}
            </div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, opacity: .6, letterSpacing: '.08em', marginTop: 2 }}>
            SALDO DISPONÍVEL
          </div>
        </div>
      </div>

      {/* QR Code */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)', padding: '28px 24px',
        textAlign: 'center', marginBottom: 16,
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 16 }}>
          Mostre este QR ao operador da cantina
        </div>

        <div style={{
          display: 'inline-block',
          padding: 12, background: '#fff',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-xs)',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt="QR Code da carteira cantina"
            width={200}
            height={200}
            style={{ display: 'block' }}
          />
        </div>

        <div style={{
          marginTop: 16, fontFamily: 'monospace', fontSize: 20, fontWeight: 800,
          letterSpacing: '.15em', color: 'var(--text-1)',
          background: 'var(--surface-2)', padding: '8px 16px',
          borderRadius: 'var(--r-md)', display: 'inline-block',
        }}>
          WLT-{codigoDisplay}
        </div>

        {!carteira.ativo && (
          <div style={{
            marginTop: 12, background: '#fee2e2', color: '#991b1b',
            borderRadius: 'var(--r-md)', padding: '10px 16px',
            fontSize: 13, fontWeight: 600,
          }}>
            ⚠️ Carteira bloqueada{carteira.bloqueio_motivo ? `: ${carteira.bloqueio_motivo}` : ''}
          </div>
        )}
      </div>

      {/* Info card */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)', padding: '16px 20px',
        display: 'flex', flexDirection: 'column', gap: 12,
        marginBottom: 16, boxShadow: 'var(--shadow-xs)',
      }}>
        {[
          {
            label: 'Limite diário',
            value: carteira.limite_diario ? fmtBRL(Number(carteira.limite_diario)) : 'Sem limite',
          },
          {
            label: 'Último consumo',
            value: ultimoConsumo
              ? `${fmtBRL(Number(ultimoConsumo.valor))} em ${fmtData(ultimoConsumo.created_at)}`
              : '—',
          },
          {
            label: 'Status',
            value: carteira.ativo ? '✅ Ativa' : '🔴 Bloqueada',
          },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 500 }}>{label}</span>
            <span style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 700 }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Botões */}
      <div style={{ display: 'flex', gap: 10 }}>
        <Link href={`/cantina/${aluno_id}/extrato`} style={{
          flex: 1, textAlign: 'center',
          background: 'var(--surface-2)', color: 'var(--text-2)',
          border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
          padding: '12px', fontSize: 13, fontWeight: 700, textDecoration: 'none',
        }}>
          📋 Ver extrato
        </Link>
        <Link href={`/cantina/${aluno_id}/recarga`} style={{
          flex: 1, textAlign: 'center',
          background: 'var(--brand)', color: '#fff',
          border: 'none', borderRadius: 'var(--r-md)',
          padding: '12px', fontSize: 13, fontWeight: 700, textDecoration: 'none',
        }}>
          💳 Recarregar
        </Link>
      </div>

      <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-3)', marginTop: 20, lineHeight: 1.5 }}>
        Mostre este código ao operador da cantina para realizar compras.
        O QR é único e pessoal — não compartilhe com terceiros.
      </p>
    </div>
  )
}
