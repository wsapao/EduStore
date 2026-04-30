'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { atualizarPerfilAction } from '@/app/actions/perfil'
import { logoutAction } from '@/app/actions/auth'
import type { Responsavel } from '@/types/database'

// ── Helpers ───────────────────────────────────────────────────────────────────
function maskCPF(cpf: string) {
  const c = cpf.replace(/\D/g, '')
  return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

function maskTel(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
}

function iniciais(nome: string) {
  return nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

interface Props {
  responsavel: Responsavel
  totalAlunos: number
  totalPedidos: number
}

export function PerfilClient({ responsavel, totalAlunos, totalPedidos }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState(responsavel.nome)
  const [telefone, setTelefone] = useState(responsavel.telefone ?? '')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const fd = new FormData()
    fd.set('nome', nome)
    fd.set('telefone', telefone)
    startTransition(async () => {
      const res = await atualizarPerfilAction(fd)
      if (res.error) { setError(res.error); return }
      setSuccess('Dados atualizados!')
      setEditando(false)
      router.refresh()
      setTimeout(() => setSuccess(''), 3000)
    })
  }

  return (
    <div style={{ background: '#f0f2f8', minHeight: '100vh', paddingBottom: 80, margin:'0 auto' }}>

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        height: 52, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 10,
        background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(0,0,0,.07)'
      }}>
        <Link href="/loja" style={{
          width: 32, height: 32, borderRadius: 10, border: '1.5px solid rgba(0,0,0,.08)',
          background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#374151', textDecoration: 'none', flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 800, color: '#0a1628', letterSpacing: '-.02em' }}>
          Meu Perfil
        </span>
      </div>

      <div>
        {/* Avatar + nome */}
        <div style={{ textAlign: 'center', padding: '24px 14px 16px' }}>
          <div style={{
            width: 76, height: 76, borderRadius: '50%',
            background: 'linear-gradient(135deg,#f59e0b,#ea580c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 900, color: 'white',
            boxShadow: '0 6px 16px rgba(245,158,11,.3)', margin: '0 auto 12px'
          }}>
            {iniciais(responsavel.nome)}
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#0a1628', letterSpacing: '-.02em', marginBottom: 2 }}>
            {responsavel.nome}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            {responsavel.email}
          </div>
        </div>

        {/* Cards de resumo */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 14px 16px' }}>
          <Link href="/perfil/alunos" style={{
            background: 'white', border: '1.5px solid rgba(0,0,0,.07)',
            borderRadius: 16, padding: '16px', textAlign: 'center',
            textDecoration: 'none', boxShadow: '0 2px 8px rgba(0,0,0,.04)'
          }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#f59e0b' }}>{totalAlunos}</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 2 }}>
              {totalAlunos === 1 ? 'FILHO' : 'FILHOS'}
            </div>
          </Link>
          <Link href="/pedidos" style={{
            background: 'white', border: '1.5px solid rgba(0,0,0,.07)',
            borderRadius: 16, padding: '16px', textAlign: 'center',
            textDecoration: 'none', boxShadow: '0 2px 8px rgba(0,0,0,.04)'
          }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#f59e0b' }}>{totalPedidos}</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 2 }}>
              {totalPedidos === 1 ? 'PEDIDO' : 'PEDIDOS'}
            </div>
          </Link>
        </div>

        {/* Sucesso */}
        {success && (
          <div style={{
            background: '#f0fdf4', border: '1.5px solid #bbf7d0',
            borderRadius: 14, padding: '12px 14px', margin: '0 14px 16px',
            fontSize: 12, fontWeight: 700, color: '#15803d',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            ✅ {success}
          </div>
        )}

        {/* Dados pessoais */}
        <div style={{
          background: 'white', border: '1.5px solid rgba(0,0,0,.07)',
          borderRadius: 18, overflow: 'hidden', margin: '0 14px 16px',
        }}>
          <div style={{
            padding: '14px 16px', borderBottom: '1px solid rgba(0,0,0,.07)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#0a1628', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Dados Pessoais
            </span>
            {!editando && (
              <button
                onClick={() => { setEditando(true); setError('') }}
                style={{
                  fontSize: 11, fontWeight: 700, color: '#f59e0b',
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 0,
                }}
              >
                ✏️ Editar
              </button>
            )}
          </div>

          {!editando ? (
            /* Modo leitura */
            <div>
              <InfoRow label="Nome" value={responsavel.nome} />
              <InfoRow label="CPF" value={maskCPF(responsavel.cpf)} locked />
              <InfoRow label="E-mail" value={responsavel.email} locked />
              <InfoRow
                label="WhatsApp"
                value={responsavel.telefone ? maskTel(responsavel.telefone) : '—'}
              />
            </div>
          ) : (
            /* Modo edição */
            <form onSubmit={handleSubmit} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>NOME COMPLETO</label>
                <input
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>

              {/* CPF e email — readonly */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>CPF <LockIcon /></label>
                  <input value={maskCPF(responsavel.cpf)} disabled style={{ ...inputStyle, opacity: .5, cursor: 'not-allowed' }} />
                </div>
                <div>
                  <label style={labelStyle}>E-MAIL <LockIcon /></label>
                  <input value={responsavel.email} disabled style={{ ...inputStyle, opacity: .5, cursor: 'not-allowed' }} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>WHATSAPP</label>
                <input
                  value={telefone}
                  onChange={e => setTelefone(maskTel(e.target.value))}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                  style={inputStyle}
                />
              </div>

              {error && (
                <div style={{
                  background: '#fef2f2', border: '1.5px solid #fecaca',
                  borderRadius: 12, padding: '10px 14px',
                  fontSize: 11, fontWeight: 700, color: '#dc2626',
                }}>
                  ⚠️ {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="submit"
                  disabled={isPending}
                  style={{
                    flex: 1, height: 46,
                    background: isPending ? '#fbbf24' : '#f59e0b',
                    color: '#78350f', border: 'none', borderRadius: 12,
                    fontSize: 13, fontWeight: 800, cursor: isPending ? 'wait' : 'pointer',
                  }}
                >
                  {isPending ? 'Salvando…' : 'Salvar Dados'}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditando(false); setNome(responsavel.nome); setTelefone(responsavel.telefone ?? ''); setError('') }}
                  style={{
                    height: 46, padding: '0 18px',
                    background: 'white', color: '#374151',
                    border: '1.5px solid rgba(0,0,0,.08)', borderRadius: 12,
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Ações */}
        <div style={{
          background: 'white', border: '1.5px solid rgba(0,0,0,.07)',
          borderRadius: 18, overflow: 'hidden', margin: '0 14px 16px',
        }}>
          <MenuLink href="/perfil/senha" icon="🔑" label="Alterar senha" />
          <MenuLink href="/perfil/alunos" icon="👨‍👩‍👧‍👦" label="Meus filhos" border />
          <MenuLink href="/pedidos" icon="🧾" label="Meus pedidos" border />
          <MenuLink href="/perfil/privacidade" icon="🛡️" label="Privacidade e dados (LGPD)" border />
        </div>

        {/* Sair */}
        <form action={logoutAction} style={{ margin: '0 14px' }}>
          <button type="submit" style={{
            width: '100%', height: 48,
            background: '#fef2f2', border: '1.5px solid #fecaca',
            borderRadius: 14, cursor: 'pointer',
            fontSize: 13, fontWeight: 800, color: '#ef4444',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sair da conta
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function InfoRow({ label, value, locked }: { label: string; value: string; locked?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '12px 16px',
      borderBottom: '1px solid rgba(0,0,0,.05)',
    }}>
      <span style={{ width: 80, fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ flex: 1, fontSize: 13, color: locked ? '#6b7280' : '#0a1628', fontWeight: 600 }}>
        {value}
      </span>
      {locked && <LockIcon />}
    </div>
  )
}

function MenuLink({ href, icon, label, border }: { href: string; icon: string; label: string; border?: boolean }) {
  return (
    <a href={href} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '16px', textDecoration: 'none',
      borderTop: border ? '1px solid rgba(0,0,0,.05)' : 'none',
      color: '#0a1628',
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{label}</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </a>
  )
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0110 0v4"/>
    </svg>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4,
  fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase',
  marginBottom: 6, letterSpacing: '.05em',
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 42, padding: '0 12px',
  borderRadius: 12, border: '1.5px solid rgba(0,0,0,.07)',
  fontSize: 13, color: '#0a1628', fontFamily: 'inherit',
  background: '#f8f9fd', boxSizing: 'border-box',
}
