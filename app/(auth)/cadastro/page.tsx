'use client'

import React, { useState, useTransition } from 'react'
import { cadastroAction } from '@/app/actions/auth'
import Link from 'next/link'
import {
  AuthCard, AuthCardFooter,
  Field, IconInput, ErrorMsg, BtnPrimary,
  UserIcon, MailIcon, LockIcon, EyeIcon, EyeOffIcon,
} from '@/components/auth/AuthCard'

export default function CadastroPage() {
  const [showSenha, setShowSenha] = useState(false)
  const [termos, setTermos] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    if (!termos) { setError('Aceite os termos de uso para continuar.'); return }
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await cadastroAction(fd)
      if (result?.error) setError(result.error)
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
      {/* ── TOPO ── */}
      <div style={{
        background: 'var(--brand)', padding: '32px 40px 24px',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:160, height:160, background:'rgba(255,255,255,.05)', borderRadius:'50%' }} />
        <div style={{
          width:60, height:60, background:'white', borderRadius:'var(--r-md)',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 4px 16px rgba(0,0,0,.2)', margin:'0 auto 14px',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        <div style={{ color:'white', fontSize:18, fontWeight:800, letterSpacing:'-.02em', marginBottom:3 }}>
          Criar conta
        </div>
        <div style={{ color:'rgba(255,255,255,.55)', fontSize:13 }}>
          {process.env.NEXT_PUBLIC_ESCOLA_NOME ?? 'Loja Escolar'} · Cadastro
        </div>
      </div>

      {/* ── FORM ── */}
      <form onSubmit={handleSubmit} style={{ padding:'28px 32px 32px' }}>

        {/* Nome + Sobrenome */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
          <Field label="Nome">
            <IconInput name="nome_first" type="text" placeholder="Ex: Maria" required />
          </Field>
          <Field label="Sobrenome">
            <IconInput name="nome_last" type="text" placeholder="Ex: Silva" />
          </Field>
        </div>

        {/* CPF */}
        <Field label="CPF do responsável" hint="Usado para vincular seus filhos à conta">
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

        {/* E-mail */}
        <Field label="E-mail">
          <IconInput
            icon={<MailIcon />}
            name="email"
            type="email"
            placeholder="seu@email.com"
            required
          />
        </Field>

        {/* Senha */}
        <div style={{ marginBottom:20 }}>
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
              placeholder="Mín. 8 caracteres"
              required
              minLength={8}
            />
          </Field>
        </div>

        {/* Termos */}
        <label style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:20, cursor:'pointer' }}>
          <input type="checkbox" checked={termos} onChange={e => setTermos(e.target.checked)}
                 style={{ width:18, height:18, borderRadius:5, accentColor:'var(--brand)', flexShrink:0, marginTop:1 }} />
          <span style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.5 }}>
            Concordo com os{' '}
            <a href="#" style={{ color:'var(--accent)', fontWeight:700, textDecoration:'none' }}>Termos de Uso</a>
            {' '}e a{' '}
            <a href="#" style={{ color:'var(--accent)', fontWeight:700, textDecoration:'none' }}>Política de Privacidade</a>
          </span>
        </label>

        {error && <ErrorMsg>{error}</ErrorMsg>}

        <BtnPrimary disabled={isPending}>
          {isPending ? 'Criando conta…' : 'Criar minha conta'}
        </BtnPrimary>

        <p style={{ textAlign:'center', fontSize:13, color:'var(--text-3)', fontWeight:500, marginTop:16 }}>
          Já tem conta?{' '}
          <Link href="/login" style={{ color:'var(--accent)', fontWeight:700, textDecoration:'none' }}>
            Entrar
          </Link>
        </p>
      </form>

      <AuthCardFooter />
    </AuthCard>
  )
}

const iconBtnStyle: React.CSSProperties = {
  background:'none', border:'none', cursor:'pointer',
  color:'var(--text-3)', padding:6, display:'flex', alignItems:'center',
}
