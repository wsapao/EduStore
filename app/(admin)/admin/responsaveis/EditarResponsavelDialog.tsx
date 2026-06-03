'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { editarResponsavelAction } from '@/app/actions/responsaveis'

interface Props {
  responsavel: {
    id: string
    nome: string
    email: string
    cpf: string
    telefone: string | null
  }
}

export function EditarResponsavelDialog({ responsavel }: Props) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await editarResponsavelAction(formData)
      if (res.success) {
        toast.success('Responsável atualizado.')
        setOpen(false)
      } else {
        toast.error(res.error ?? 'Falha ao atualizar.')
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          padding: '6px 12px',
          fontSize: 12,
          fontWeight: 700,
          borderRadius: 8,
          border: '1px solid #cbd5e1',
          background: '#fff',
          color: '#334155',
          cursor: 'pointer',
        }}
      >
        Editar
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 16,
          }}
          onClick={() => !pending && setOpen(false)}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: 24,
              width: '100%',
              maxWidth: 420,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
              Editar responsável
            </h3>

            <input type="hidden" name="responsavel_id" value={responsavel.id} />

            <label style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
              Nome
              <input
                name="nome"
                defaultValue={responsavel.nome}
                required
                style={inputStyle}
              />
            </label>

            <label style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
              E-mail (login)
              <input
                name="email"
                type="email"
                defaultValue={responsavel.email}
                required
                style={inputStyle}
              />
            </label>

            <label style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
              Telefone
              <input
                name="telefone"
                defaultValue={responsavel.telefone ?? ''}
                style={inputStyle}
              />
            </label>

            <label style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8' }}>
              CPF (não editável)
              <input value={responsavel.cpf} disabled style={{ ...inputStyle, background: '#f1f5f9' }} />
            </label>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                style={{ ...btnStyle, background: '#fff', color: '#334155', border: '1px solid #cbd5e1' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending}
                style={{ ...btnStyle, background: '#4f46e5', color: '#fff', border: 'none' }}
              >
                {pending ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 6,
  padding: '10px 12px',
  fontSize: 14,
  fontWeight: 500,
  borderRadius: 10,
  border: '1px solid #cbd5e1',
  color: '#0f172a',
}

const btnStyle: React.CSSProperties = {
  padding: '10px 18px',
  fontSize: 13,
  fontWeight: 700,
  borderRadius: 10,
  cursor: 'pointer',
}
