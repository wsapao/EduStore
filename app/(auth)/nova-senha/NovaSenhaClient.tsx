'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function NovaSenhaClient() {
  const router = useRouter()
  const supabase = createClient()
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [ready, setReady] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let mounted = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setHasSession(!!data.session)
      setReady(true)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setHasSession(!!session)
        setReady(true)
      }
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [supabase.auth])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (senha.length < 8) {
      setError('A nova senha deve ter pelo menos 8 caracteres.')
      return
    }

    if (senha !== confirmacao) {
      setError('As senhas não coincidem.')
      return
    }

    startTransition(async () => {
      const { error: updateError } = await supabase.auth.updateUser({ password: senha })
      if (updateError) {
        setError('Não foi possível atualizar a senha. Abra o link de recuperação novamente.')
        return
      }

      setSuccess('Senha atualizada com sucesso! Redirecionando...')
      setTimeout(() => router.push('/perfil'), 900)
    })
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg,#f8fafc,#eef2ff)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: '#fff',
        border: '1.5px solid #e2e8f0',
        borderRadius: 20,
        boxShadow: '0 12px 40px rgba(15,23,42,.08)',
        padding: 28,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔐</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-.02em' }}>
            Nova senha
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '8px 0 0', lineHeight: 1.6 }}>
            Crie uma nova senha para voltar a acessar a Loja Escolar.
          </p>
        </div>

        {!ready ? (
          <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: '#64748b' }}>
            Validando link de recuperação...
          </div>
        ) : !hasSession ? (
          <div style={{
            background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 14, padding: 18,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#9a3412' }}>
              Link inválido ou expirado
            </div>
            <p style={{ fontSize: 13, color: '#9a3412', lineHeight: 1.6, margin: '8px 0 16px' }}>
              Solicite um novo email de recuperação para redefinir sua senha.
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
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>NOVA SENHA</label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Mínimo de 8 caracteres"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>CONFIRMAR SENHA</label>
              <input
                type="password"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                placeholder="Digite novamente"
                style={inputStyle}
              />
            </div>

            {error && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12,
                padding: '12px 14px', fontSize: 13, color: '#b91c1c', fontWeight: 600,
              }}>
                {error}
              </div>
            )}

            {success && (
              <div style={{
                background: '#ecfdf5', border: '1px solid #bbf7d0', borderRadius: 12,
                padding: '12px 14px', fontSize: 13, color: '#047857', fontWeight: 600,
              }}>
                {success}
              </div>
            )}

            <button type="submit" disabled={isPending} style={{
              height: 48, borderRadius: 14, border: 'none',
              background: isPending ? '#94a3b8' : '#0f172a', color: '#fff',
              fontSize: 14, fontWeight: 800, cursor: isPending ? 'not-allowed' : 'pointer',
            }}>
              {isPending ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: '#64748b',
  marginBottom: 6,
  letterSpacing: '.05em',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 46,
  borderRadius: 12,
  border: '1.5px solid #e2e8f0',
  background: '#f8fafc',
  padding: '0 14px',
  fontSize: 14,
  color: '#0f172a',
  boxSizing: 'border-box',
}
