'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { exportarMeusDadosAction, excluirMinhaContaAction } from '@/app/actions/lgpd'

interface Props {
  userEmail: string
  isAdmin: boolean
}

export function PrivacidadeClient({ userEmail, isAdmin }: Props) {
  const [isExporting, startExport] = useTransition()
  const [isDeleting, startDelete] = useTransition()
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)

  function handleExport() {
    setMsg('')
    setErr('')
    startExport(async () => {
      const res = await exportarMeusDadosAction()
      if (res.error) {
        setErr(res.error)
        return
      }
      if (!res.payload) {
        setErr('Nenhum dado retornado.')
        return
      }
      const blob = new Blob([JSON.stringify(res.payload, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `meus-dados-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setMsg('Arquivo exportado para a pasta de downloads.')
      setTimeout(() => setMsg(''), 5000)
    })
  }

  function handleDelete(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErr('')
    const fd = new FormData(e.currentTarget)
    startDelete(async () => {
      const res = await excluirMinhaContaAction(fd)
      if (res?.error) {
        setErr(res.error)
        return
      }
    })
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 0 100px' }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(255,255,255,.92)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border)',
          height: 60,
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Link
          href="/perfil"
          aria-label="Voltar ao perfil"
          style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--r-sm)',
            background: 'var(--surface-2)',
            border: '1.5px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-2)',
            textDecoration: 'none',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.02em' }}>
          Privacidade e dados
        </span>
      </div>

      <div style={{ padding: '24px 20px 0' }}>
        <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 20 }}>
          Seus direitos garantidos pela Lei Geral de Proteção de Dados (LGPD). Veja
          também a{' '}
          <Link href="/privacidade" style={{ color: 'var(--accent)', fontWeight: 700 }}>
            Política de Privacidade
          </Link>
          .
        </p>

        {msg && (
          <div
            role="status"
            style={{
              background: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: 10,
              padding: '12px 16px',
              fontSize: 13,
              fontWeight: 600,
              color: '#15803d',
              marginBottom: 16,
            }}
          >
            ✅ {msg}
          </div>
        )}

        {err && (
          <div
            role="alert"
            style={{
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              borderRadius: 10,
              padding: '12px 16px',
              fontSize: 13,
              fontWeight: 600,
              color: '#b91c1c',
              marginBottom: 16,
            }}
          >
            ⚠️ {err}
          </div>
        )}

        {/* Exportar dados */}
        <div
          style={{
            background: '#fff',
            border: '1.5px solid var(--border)',
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)', marginBottom: 6 }}>
            📦 Exportar meus dados
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 14 }}>
            Baixe um arquivo JSON com todas as informações que mantemos sobre você:
            perfil, filhos vinculados, pedidos, ingressos e carteiras de cantina.
          </p>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            style={{
              height: 44,
              padding: '0 18px',
              background: isExporting ? '#94a3b8' : 'var(--brand)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: isExporting ? 'not-allowed' : 'pointer',
            }}
          >
            {isExporting ? 'Gerando arquivo…' : 'Baixar meus dados (JSON)'}
          </button>
        </div>

        {/* Excluir conta */}
        <div
          style={{
            background: '#fff',
            border: '1.5px solid #fecaca',
            borderRadius: 16,
            padding: 20,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 800, color: '#991b1b', marginBottom: 6 }}>
            🗑️ Excluir minha conta
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 10 }}>
            Seus dados pessoais serão <strong>anonimizados</strong> e seu acesso será
            encerrado. Pedidos e movimentações anteriores são mantidos pelo prazo legal
            (fiscal/contábil), mas sem qualquer vínculo com você.
          </p>
          <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 14 }}>
            Conta atual: <strong>{userEmail}</strong>
          </p>

          {isAdmin ? (
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fcd34d',
                borderRadius: 8,
                padding: 12,
                fontSize: 12.5,
                color: '#78350f',
              }}
            >
              Contas administrativas devem ser removidas pelo suporte técnico, não por
              este fluxo.
            </div>
          ) : !confirmandoExclusao ? (
            <button
              type="button"
              onClick={() => setConfirmandoExclusao(true)}
              style={{
                height: 44,
                padding: '0 18px',
                background: '#fff',
                color: '#b91c1c',
                border: '1.5px solid #fca5a5',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Quero excluir minha conta
            </button>
          ) : (
            <form onSubmit={handleDelete}>
              <label
                htmlFor="confirmacao"
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--text-3)',
                  letterSpacing: '.04em',
                  marginBottom: 6,
                }}
              >
                DIGITE <strong>EXCLUIR</strong> PARA CONFIRMAR
              </label>
              <input
                id="confirmacao"
                name="confirmacao"
                type="text"
                value={confirmacao}
                onChange={e => setConfirmacao(e.target.value.toUpperCase())}
                autoComplete="off"
                required
                style={{
                  width: '100%',
                  height: 44,
                  padding: '0 14px',
                  border: '1.5px solid #fca5a5',
                  borderRadius: 10,
                  fontSize: 14,
                  letterSpacing: '.04em',
                  textTransform: 'uppercase',
                  marginBottom: 12,
                  background: '#fff',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="submit"
                  disabled={isDeleting || confirmacao !== 'EXCLUIR'}
                  style={{
                    flex: 1,
                    height: 44,
                    background:
                      isDeleting || confirmacao !== 'EXCLUIR' ? '#fca5a5' : '#b91c1c',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor:
                      isDeleting || confirmacao !== 'EXCLUIR' ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isDeleting ? 'Excluindo…' : 'Confirmar exclusão'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmandoExclusao(false)
                    setConfirmacao('')
                  }}
                  style={{
                    height: 44,
                    padding: '0 18px',
                    background: 'var(--surface-2)',
                    color: 'var(--text-2)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
