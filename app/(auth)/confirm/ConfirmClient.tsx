'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { EmailOtpType } from '@supabase/supabase-js'

const TIPOS_VALIDOS: EmailOtpType[] = ['invite', 'recovery', 'signup', 'magiclink', 'email', 'email_change']

const TITULOS: Partial<Record<EmailOtpType, string>> = {
  invite: 'Ative seu acesso',
  recovery: 'Redefinir senha',
}

export function ConfirmClient({
  tokenHash,
  type,
  code,
  next,
}: {
  tokenHash: string | null
  type: string | null
  code: string | null
  next: string | null
}) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const otpType = TIPOS_VALIDOS.includes(type as EmailOtpType) ? (type as EmailOtpType) : null
  const linkUtilizavel = (tokenHash && otpType) || code
  // Evita open redirect: só aceita caminhos internos
  const destino = next && next.startsWith('/') && !next.startsWith('//') ? next : '/nova-senha'

  function handleConfirm() {
    setError('')
    startTransition(async () => {
      const supabase = createClient()
      const { error: verifyError } = tokenHash && otpType
        ? await supabase.auth.verifyOtp({ type: otpType, token_hash: tokenHash })
        : await supabase.auth.exchangeCodeForSession(code!)

      if (verifyError) {
        setError('Link inválido ou expirado. Solicite um novo e-mail.')
        return
      }
      router.push(destino)
    })
  }

  return (
    <div style={{
      background: '#fff',
      border: '1.5px solid #e2e8f0',
      borderRadius: 20,
      boxShadow: '0 12px 40px rgba(15,23,42,.08)',
      padding: 28,
    }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>🔑</div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-.02em' }}>
          {TITULOS[otpType as EmailOtpType] ?? 'Confirmar acesso'}
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: '8px 0 0', lineHeight: 1.6 }}>
          Clique no botão abaixo para validar seu link e continuar.
        </p>
      </div>

      {!linkUtilizavel || error ? (
        <div style={{
          background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 14, padding: 18,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#9a3412' }}>
            Link inválido ou expirado
          </div>
          <p style={{ fontSize: 13, color: '#9a3412', lineHeight: 1.6, margin: '8px 0 16px' }}>
            {error || 'Este link está incompleto. Solicite um novo e-mail de convite ou recuperação.'}
          </p>
          <Link href="/login" style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            height: 40, padding: '0 16px', borderRadius: 999, textDecoration: 'none',
            background: '#0f172a', color: '#fff', fontSize: 13, fontWeight: 700,
          }}>
            Voltar ao login
          </Link>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isPending}
          style={{
            width: '100%', height: 48, borderRadius: 14, border: 'none',
            background: isPending ? '#94a3b8' : '#0f172a', color: '#fff',
            fontSize: 14, fontWeight: 800, cursor: isPending ? 'not-allowed' : 'pointer',
          }}
        >
          {isPending ? 'Validando…' : 'Continuar'}
        </button>
      )}
    </div>
  )
}
