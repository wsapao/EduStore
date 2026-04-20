'use client'

import React, { useState, useTransition } from 'react'
import { loginAction, recuperarSenhaAction } from '@/app/actions/auth'
import Link from 'next/link'
import {
  AuthCard, AuthCardTop, AuthCardFooter,
  Field, IconInput, ErrorMsg, BtnPrimary, Divider,
  UserIcon, LockIcon, EyeIcon, EyeOffIcon,
} from '@/components/auth/AuthCard'

export default function LoginPage() {
  const [tab, setTab] = useState<'login' | 'recuperar'>('login')
  const [showSenha, setShowSenha] = useState(false)
  const [error, setError] = useState('')
  const [recoveryDone, setRecoveryDone] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await loginAction(fd)
      if (result?.error) setError(result.error)
    })
  }

  function handleRecuperar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await recuperarSenhaAction(fd)
      if (result?.error) setError(result.error)
      else setRecoveryDone(true)
    })
  }

  function maskCPF(e: React.ChangeEvent<HTMLInputElement>) {
    let v = e.target.value.replace(/\D/g, '').substring(0, 11)
    v = v.replace(/(\d{3})(\d)/, '$1.$2')
    v = v.replace(/(\d{3})(\d)/, '$1.$2')
    v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    e.target.value = v
  }

  return (
    <AuthCard>
      <AuthCardTop
        title={process.env.NEXT_PUBLIC_ESCOLA_NOME ?? 'Loja Escolar'}
        subtitle="Loja Escolar Oficial"
      />

      {/* ── TABS ── */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border)' }}>
        {(['login', 'recuperar'] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setError(''); setRecoveryDone(false) }}
            style={{
              flex:1, padding:'14px 20px',
              fontFamily:'inherit', fontSize:14, fontWeight:600,
              background:'none', border:'none', cursor:'pointer',
              color: tab === t ? 'var(--brand)' : 'var(--text-3)',
              borderBottom: tab === t ? '2px solid var(--brand)' : '2px solid transparent',
              marginBottom:-1, transition:'all .2s',
            }}>
            {t === 'login' ? 'Entrar' : 'Recuperar senha'}
          </button>
        ))}
      </div>

      {/* ── PAINEL LOGIN ── */}
      {tab === 'login' && (
        <form onSubmit={handleLogin} style={{ padding:'28px 32px 32px' }}>
          <Field label="CPF do responsável">
            <IconInput
              icon={<UserIcon />}
              name="cpf"
              type="text"
              placeholder="000.000.000-00"
              maxLength={14}
              onChange={maskCPF}
              autoComplete="username"
              required
            />
          </Field>

          <Field label="Senha">
            <IconInput
              icon={<LockIcon />}
              rightBtn={
                <button type="button" onClick={() => setShowSenha(v => !v)} style={iconBtnStyle}>
                  {showSenha ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              }
              name="senha"
              type={showSenha ? 'text' : 'password'}
              placeholder="Sua senha"
              autoComplete="current-password"
              required
            />
          </Field>

          {error && <ErrorMsg>{error}</ErrorMsg>}

          <BtnPrimary disabled={isPending}>
            {isPending ? 'Entrando…' : 'Entrar na loja'}
          </BtnPrimary>

          <Divider />

          <p style={{ textAlign:'center', fontSize:13, color:'var(--text-3)', fontWeight:500 }}>
            Não tem conta?{' '}
            <Link href="/cadastro" style={{ color:'var(--accent)', fontWeight:700, textDecoration:'none' }}>
              Criar conta
            </Link>
          </p>
        </form>
      )}

      {/* ── PAINEL RECUPERAR ── */}
      {tab === 'recuperar' && (
        <div style={{ padding:'28px 32px 32px' }}>
          {recoveryDone ? (
            <div style={{ textAlign:'center', padding:'20px 0' }}>
              <div style={{ fontSize:48, marginBottom:16 }}>📬</div>
              <div style={{ fontSize:16, fontWeight:700, color:'var(--text-1)', marginBottom:8 }}>
                E-mail enviado!
              </div>
              <div style={{ fontSize:13, color:'var(--text-3)', lineHeight:1.6 }}>
                Se o CPF estiver cadastrado, você receberá um link para redefinir sua senha.
              </div>
            </div>
          ) : (
            <form onSubmit={handleRecuperar}>
              <p style={{ fontSize:14, color:'var(--text-3)', marginBottom:20, lineHeight:1.6 }}>
                Informe seu CPF e enviaremos um link de recuperação para o e-mail cadastrado.
              </p>
              <Field label="CPF do responsável">
                <IconInput
                  icon={<UserIcon />}
                  name="cpf"
                  type="text"
                  placeholder="000.000.000-00"
                  maxLength={14}
                  onChange={maskCPF}
                  required
                />
              </Field>
              {error && <ErrorMsg>{error}</ErrorMsg>}
              <BtnPrimary disabled={isPending}>
                {isPending ? 'Enviando…' : 'Enviar código por e-mail'}
              </BtnPrimary>
            </form>
          )}
        </div>
      )}

      <AuthCardFooter />
    </AuthCard>
  )
}

const iconBtnStyle: React.CSSProperties = {
  background:'none', border:'none', cursor:'pointer',
  color:'var(--text-3)', padding:6, display:'flex', alignItems:'center',
}
