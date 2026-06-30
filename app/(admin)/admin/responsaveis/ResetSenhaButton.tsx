'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { resetSenhaResponsavelAction } from '@/app/actions/admin'
import { getAdminButtonStyle } from '@/lib/admin-ui-tones'

interface Props {
  responsavelId: string
  responsavelNome: string
}

export function ResetSenhaButton({ responsavelId, responsavelNome }: Props) {
  const [pending, startTransition] = useTransition()
  const [link, setLink] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)
  const [email, setEmail] = useState('')

  function handleClick() {
    const fd = new FormData()
    fd.set('responsavel_id', responsavelId)
    startTransition(async () => {
      const res = await resetSenhaResponsavelAction(fd)
      if (res.success) {
        setLink(res.link)
        setEmailSent(res.emailSent)
        setEmail(res.email)
        if (res.emailSent) {
          toast.success(`Link de redefinição enviado para ${res.email}.`)
        } else {
          toast.warning(
            'Link gerado, mas o e-mail não foi enviado. Copie e envie pelo WhatsApp.',
          )
        }
      } else {
        toast.error(res.error)
      }
    })
  }

  async function copiar() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Link copiado.')
    } catch {
      toast.error('Não foi possível copiar — selecione e copie manualmente.')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        style={getAdminButtonStyle('info', 'soft', {
          height: 40,
          padding: '0 16px',
          borderRadius: 12,
          fontSize: 12,
        })}
      >
        {pending ? 'Gerando…' : 'Enviar reset de senha'}
      </button>

      {link && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-link-title"
          onClick={() => setLink(null)}
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
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 520,
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
                id="reset-link-title"
                style={{
                  margin: 0,
                  fontSize: 17,
                  fontWeight: 900,
                  color: 'var(--text-1)',
                  letterSpacing: '-.02em',
                }}
              >
                Link de redefinição de senha
              </h3>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>
                {emailSent ? (
                  <>
                    Enviado por e-mail para <strong>{email}</strong>. Se não chegar,
                    copie o link abaixo e envie por WhatsApp para {responsavelNome}.
                  </>
                ) : (
                  <>
                    O e-mail não pôde ser enviado. Copie o link abaixo e envie por
                    WhatsApp para {responsavelNome}. O link permite definir uma nova
                    senha.
                  </>
                )}
              </p>
            </div>

            <textarea
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              style={{
                width: '100%',
                minHeight: 76,
                resize: 'none',
                fontSize: 12,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                color: 'var(--text-2, var(--text-1))',
                background: 'var(--bg-2, #f8fafc)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 12,
              }}
            />

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setLink(null)}
                style={getAdminButtonStyle('neutral', 'soft', {
                  height: 40,
                  padding: '0 16px',
                  borderRadius: 12,
                  fontSize: 13,
                })}
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={copiar}
                style={getAdminButtonStyle('info', 'solid', {
                  height: 40,
                  padding: '0 18px',
                  borderRadius: 12,
                  fontSize: 13,
                })}
              >
                Copiar link
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
