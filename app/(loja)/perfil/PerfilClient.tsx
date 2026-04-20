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
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 0 100px' }}>

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
        height: 60, padding: '0 20px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Link href="/loja" style={{
          width: 36, height: 36, borderRadius: 'var(--r-sm)',
          background: 'var(--surface-2)', border: '1.5px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-2)', textDecoration: 'none', flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-.02em', flex: 1 }}>
          Meu perfil
        </span>
      </div>

      <div style={{ padding: '24px 20px 0' }}>

        {/* Avatar + nome */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          marginBottom: 28, gap: 12,
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 800, color: '#fff',
            boxShadow: '0 4px 16px rgba(102,126,234,.4)',
          }}>
            {iniciais(responsavel.nome)}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-.02em' }}>
              {responsavel.nome}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
              {responsavel.email}
            </div>
          </div>
        </div>

        {/* Cards de resumo */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          <Link href="/perfil/alunos" style={{
            background: '#f5f3ff', border: '1px solid #ddd6fe',
            borderRadius: 14, padding: '16px', textAlign: 'center',
            textDecoration: 'none',
          }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#7c3aed' }}>{totalAlunos}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6d28d9', marginTop: 2 }}>
              {totalAlunos === 1 ? 'FILHO' : 'FILHOS'}
            </div>
          </Link>
          <Link href="/pedidos" style={{
            background: '#eff6ff', border: '1px solid #bfdbfe',
            borderRadius: 14, padding: '16px', textAlign: 'center',
            textDecoration: 'none',
          }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#2563eb' }}>{totalPedidos}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', marginTop: 2 }}>
              {totalPedidos === 1 ? 'PEDIDO' : 'PEDIDOS'}
            </div>
          </Link>
        </div>

        {/* Sucesso */}
        {success && (
          <div style={{
            background: '#f0fdf4', border: '1px solid #86efac',
            borderRadius: 10, padding: '12px 16px',
            fontSize: 13, fontWeight: 600, color: '#15803d',
            marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            ✅ {success}
          </div>
        )}

        {/* Dados pessoais */}
        <div style={{
          background: '#fff', border: '1.5px solid var(--border)',
          borderRadius: 16, overflow: 'hidden', marginBottom: 16,
        }}>
          <div style={{
            padding: '14px 20px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>
              Dados pessoais
            </span>
            {!editando && (
              <button
                onClick={() => { setEditando(true); setError('') }}
                style={{
                  fontSize: 12, fontWeight: 700, color: 'var(--brand)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '4px 8px',
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
                label="Telefone"
                value={responsavel.telefone ? maskTel(responsavel.telefone) : '—'}
              />
            </div>
          ) : (
            /* Modo edição */
            <form onSubmit={handleSubmit} style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                <label style={labelStyle}>TELEFONE / WHATSAPP</label>
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
                  background: '#fef2f2', border: '1px solid #fca5a5',
                  borderRadius: 8, padding: '10px 14px',
                  fontSize: 13, color: '#b91c1c',
                }}>
                  ⚠️ {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="submit"
                  disabled={isPending}
                  style={{
                    flex: 1, height: 44,
                    background: isPending ? '#94a3b8' : 'var(--brand)',
                    color: '#fff', border: 'none', borderRadius: 10,
                    fontSize: 14, fontWeight: 700, cursor: isPending ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isPending ? 'Salvando…' : 'Salvar'}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditando(false); setNome(responsavel.nome); setTelefone(responsavel.telefone ?? ''); setError('') }}
                  style={{
                    height: 44, padding: '0 18px',
                    background: 'var(--surface-2)', color: 'var(--text-2)',
                    border: '1.5px solid var(--border)', borderRadius: 10,
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
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
          background: '#fff', border: '1.5px solid var(--border)',
          borderRadius: 16, overflow: 'hidden', marginBottom: 16,
        }}>
          <MenuLink href="/perfil/senha" icon="🔑" label="Alterar senha" />
          <MenuLink href="/perfil/alunos" icon="👨‍👩‍👧‍👦" label="Meus filhos" border />
          <MenuLink href="/pedidos" icon="🧾" label="Meus pedidos" border />
          <MenuLink href="/perfil/privacidade" icon="🛡️" label="Privacidade e dados (LGPD)" border />
        </div>

        {/* Sair */}
        <form action={logoutAction}>
          <button type="submit" style={{
            width: '100%', height: 48,
            background: '#fef2f2', border: '1.5px solid #fecaca',
            borderRadius: 14, cursor: 'pointer',
            fontSize: 14, fontWeight: 700, color: '#b91c1c',
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
      padding: '12px 20px',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', width: 90, flexShrink: 0, letterSpacing: '.02em' }}>
        {label.toUpperCase()}
      </span>
      <span style={{ fontSize: 14, color: locked ? 'var(--text-3)' : 'var(--text-1)', fontWeight: 500, flex: 1 }}>
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
      padding: '14px 20px', textDecoration: 'none',
      borderTop: border ? '1px solid var(--border)' : 'none',
      color: 'var(--text-1)',
    }}>
      <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{label}</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </a>
  )
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0110 0v4"/>
    </svg>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4,
  fontSize: 11, fontWeight: 700, color: 'var(--text-3)',
  marginBottom: 6, letterSpacing: '.04em',
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 44, padding: '0 14px',
  borderRadius: 10, border: '1.5px solid var(--border)',
  fontSize: 14, color: 'var(--text-1)',
  background: 'var(--surface-2)', boxSizing: 'border-box',
}
