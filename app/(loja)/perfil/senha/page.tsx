'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { alterarSenhaAction } from '@/app/actions/perfil'

export default function SenhaPage() {
  const [isPending, startTransition] = useTransition()
  const [error, setError]   = useState('')
  const [success, setSuccess] = useState(false)
  const [show, setShow] = useState({ atual: false, nova: false, confirma: false })

  const [senhaAtual, setSenhaAtual]     = useState('')
  const [novaSenha, setNovaSenha]       = useState('')
  const [confirmaSenha, setConfirmaSenha] = useState('')

  // Força: conta critérios atendidos
  const forca = [
    novaSenha.length >= 8,
    /[A-Z]/.test(novaSenha),
    /[0-9]/.test(novaSenha),
    /[^A-Za-z0-9]/.test(novaSenha),
  ]
  const forcaCount = forca.filter(Boolean).length
  const forcaLabel = ['', 'Fraca', 'Razoável', 'Boa', 'Forte'][forcaCount]
  const forcaCor   = ['', '#ef4444', '#f59e0b', '#22c55e', '#16a34a'][forcaCount]

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const fd = new FormData()
    fd.set('senha_atual', senhaAtual)
    fd.set('nova_senha', novaSenha)
    fd.set('confirma_senha', confirmaSenha)

    startTransition(async () => {
      const res = await alterarSenhaAction(fd)
      if (res.error) { setError(res.error); return }
      setSuccess(true)
    })
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 0 100px' }}>

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
        height: 60, padding: '0 20px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Link href="/perfil" style={{
          width: 36, height: 36, borderRadius: 'var(--r-sm)',
          background: 'var(--surface-2)', border: '1.5px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-2)', textDecoration: 'none', flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-.02em' }}>
          Alterar senha
        </span>
      </div>

      <div style={{ padding: '24px 20px 0' }}>

        {success ? (
          /* ── Estado de sucesso ── */
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '60px 20px', textAlign: 'center', gap: 16,
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32,
            }}>
              ✅
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', marginBottom: 8 }}>
                Senha alterada!
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.6 }}>
                Sua senha foi atualizada com sucesso.<br />Use-a no próximo acesso.
              </div>
            </div>
            <Link href="/perfil" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 24px', borderRadius: 'var(--r-md)',
              background: 'var(--brand)', color: '#fff',
              fontWeight: 700, fontSize: 14, textDecoration: 'none',
            }}>
              ← Voltar ao perfil
            </Link>
          </div>
        ) : (
          /* ── Formulário ── */
          <>
            <div style={{
              background: '#eff6ff', border: '1px solid #bfdbfe',
              borderRadius: 12, padding: '12px 16px', marginBottom: 24,
              fontSize: 13, color: '#1e40af', lineHeight: 1.6,
            }}>
              🔒 Por segurança, confirme sua senha atual antes de criar uma nova.
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Senha atual */}
              <div>
                <label style={labelStyle}>SENHA ATUAL</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={show.atual ? 'text' : 'password'}
                    value={senhaAtual}
                    onChange={e => setSenhaAtual(e.target.value)}
                    placeholder="Digite sua senha atual"
                    required
                    style={{ ...inputStyle, paddingRight: 44 }}
                  />
                  <EyeBtn show={show.atual} onToggle={() => setShow(s => ({ ...s, atual: !s.atual }))} />
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--border)' }} />

              {/* Nova senha */}
              <div>
                <label style={labelStyle}>NOVA SENHA</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={show.nova ? 'text' : 'password'}
                    value={novaSenha}
                    onChange={e => setNovaSenha(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    required
                    style={{ ...inputStyle, paddingRight: 44 }}
                  />
                  <EyeBtn show={show.nova} onToggle={() => setShow(s => ({ ...s, nova: !s.nova }))} />
                </div>

                {/* Força da senha */}
                {novaSenha.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} style={{
                          flex: 1, height: 4, borderRadius: 999,
                          background: i < forcaCount ? forcaCor : 'var(--border)',
                          transition: 'background .3s',
                        }} />
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: 12 }}>
                        {[
                          { ok: forca[0], label: '8+ chars' },
                          { ok: forca[1], label: 'Maiúscula' },
                          { ok: forca[2], label: 'Número' },
                          { ok: forca[3], label: 'Símbolo' },
                        ].map(({ ok, label }) => (
                          <span key={label} style={{
                            fontSize: 10, fontWeight: 600,
                            color: ok ? '#16a34a' : 'var(--text-3)',
                          }}>
                            {ok ? '✓' : '○'} {label}
                          </span>
                        ))}
                      </div>
                      {forcaLabel && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: forcaCor }}>
                          {forcaLabel}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirmar nova senha */}
              <div>
                <label style={labelStyle}>CONFIRMAR NOVA SENHA</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={show.confirma ? 'text' : 'password'}
                    value={confirmaSenha}
                    onChange={e => setConfirmaSenha(e.target.value)}
                    placeholder="Repita a nova senha"
                    required
                    style={{
                      ...inputStyle, paddingRight: 44,
                      borderColor: confirmaSenha && novaSenha !== confirmaSenha ? '#fca5a5' : undefined,
                    }}
                  />
                  <EyeBtn show={show.confirma} onToggle={() => setShow(s => ({ ...s, confirma: !s.confirma }))} />
                </div>
                {confirmaSenha && novaSenha !== confirmaSenha && (
                  <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
                    As senhas não coincidem
                  </div>
                )}
              </div>

              {error && (
                <div style={{
                  background: '#fef2f2', border: '1px solid #fca5a5',
                  borderRadius: 8, padding: '12px 16px',
                  fontSize: 13, color: '#b91c1c',
                }}>
                  ⚠️ {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isPending || novaSenha !== confirmaSenha || novaSenha.length < 8}
                style={{
                  height: 50, borderRadius: 12, border: 'none',
                  background: isPending || novaSenha !== confirmaSenha || novaSenha.length < 8
                    ? '#cbd5e1' : 'var(--brand)',
                  color: '#fff', fontSize: 15, fontWeight: 700,
                  cursor: isPending ? 'not-allowed' : 'pointer',
                  marginTop: 4,
                }}
              >
                {isPending ? 'Alterando…' : 'Alterar senha'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function EyeBtn({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--text-3)', padding: 4, display: 'flex', alignItems: 'center',
      }}
    >
      {show ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
          <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      )}
    </button>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: 'var(--text-3)', marginBottom: 6, letterSpacing: '.04em',
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 46, padding: '0 14px',
  borderRadius: 10, border: '1.5px solid var(--border)',
  fontSize: 14, color: 'var(--text-1)',
  background: 'var(--surface-2)', boxSizing: 'border-box',
}
