'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { definirSenhaResponsavelAction } from '@/app/actions/admin'
import { getAdminButtonStyle } from '@/lib/admin-ui-tones'

interface Props {
  responsavelId: string
  responsavelNome: string
}

function gerarSenhaForte(tamanho = 12) {
  // Sem caracteres ambíguos (0/O, 1/l/I) pra facilitar ditar/copiar.
  const alfabeto = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#$%&*'
  const buf = new Uint32Array(tamanho)
  crypto.getRandomValues(buf)
  let out = ''
  for (let i = 0; i < tamanho; i++) out += alfabeto[buf[i] % alfabeto.length]
  return out
}

export function DefinirSenhaButton({ responsavelId, responsavelNome }: Props) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [mostrar, setMostrar] = useState(false)

  function fechar() {
    if (pending) return
    setOpen(false)
    setSenha('')
    setConfirma('')
    setMostrar(false)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (senha.length < 6) {
      toast.error('A senha deve ter ao menos 6 caracteres.')
      return
    }
    if (senha !== confirma) {
      toast.error('As senhas não conferem.')
      return
    }
    const fd = new FormData()
    fd.set('responsavel_id', responsavelId)
    fd.set('senha', senha)
    startTransition(async () => {
      const res = await definirSenhaResponsavelAction(fd)
      if (res.success) {
        toast.success(`Senha definida para ${res.email}.`)
        fechar()
      } else {
        toast.error(res.error)
      }
    })
  }

  function handleGerar() {
    const nova = gerarSenhaForte()
    setSenha(nova)
    setConfirma(nova)
    setMostrar(true)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 44,
    padding: '0 12px',
    fontSize: 14,
    color: 'var(--text-1)',
    background: 'var(--bg-2, #f8fafc)',
    border: '1px solid var(--border)',
    borderRadius: 12,
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={getAdminButtonStyle('neutral', 'soft', {
          height: 40,
          padding: '0 16px',
          borderRadius: 12,
          fontSize: 12,
        })}
      >
        Definir senha
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="definir-senha-title"
          onClick={fechar}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 60,
          }}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 460,
              background: 'var(--bg-1, #fff)',
              border: '1px solid var(--border)',
              borderRadius: 18,
              padding: 24,
              boxShadow: '0 24px 60px rgba(15,23,42,.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div>
              <h3
                id="definir-senha-title"
                style={{
                  margin: 0,
                  fontSize: 17,
                  fontWeight: 900,
                  color: 'var(--text-1)',
                  letterSpacing: '-.02em',
                }}
              >
                Definir senha
              </h3>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>
                Defina uma nova senha de acesso para <strong>{responsavelNome}</strong>.
                O login dele(a) será garantido na hora.
              </p>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2, var(--text-1))' }}>
                Nova senha
              </span>
              <input
                type={mostrar ? 'text' : 'password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
                style={inputStyle}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2, var(--text-1))' }}>
                Confirmar senha
              </span>
              <input
                type={mostrar ? 'text' : 'password'}
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
                style={inputStyle}
              />
            </label>

            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--text-3)' }}>
                <input
                  type="checkbox"
                  checked={mostrar}
                  onChange={(e) => setMostrar(e.target.checked)}
                />
                Mostrar senha
              </label>
              <button
                type="button"
                onClick={handleGerar}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--accent, #f97316)',
                  cursor: 'pointer',
                }}
              >
                Gerar senha forte
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                type="button"
                onClick={fechar}
                disabled={pending}
                style={getAdminButtonStyle('neutral', 'soft', {
                  height: 42,
                  padding: '0 16px',
                  borderRadius: 12,
                  fontSize: 13,
                })}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending}
                style={getAdminButtonStyle('info', 'solid', {
                  height: 42,
                  padding: '0 18px',
                  borderRadius: 12,
                  fontSize: 13,
                })}
              >
                {pending ? 'Salvando…' : 'Salvar senha'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
