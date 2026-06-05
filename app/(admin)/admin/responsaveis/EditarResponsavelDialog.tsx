'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { editarResponsavelAction } from '@/app/actions/responsaveis'
import { getEditarResponsavelDialogTheme } from './editarResponsavelDialogTheme'

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
  const theme = getEditarResponsavelDialogTheme({ pending })

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
        style={theme.triggerButton}
      >
        Editar
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="editar-responsavel-title"
          aria-describedby="editar-responsavel-description"
          style={theme.overlay}
          onClick={() => !pending && setOpen(false)}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            style={theme.panel}
          >
            <div style={theme.header}>
              <span style={theme.eyebrow}>Cadastro</span>
              <div>
                <h3 id="editar-responsavel-title" style={theme.title}>
                  Editar responsável
                </h3>
                <p id="editar-responsavel-description" style={theme.description}>
                  Atualize nome, login e telefone mantendo o padrão visual do admin.
                </p>
              </div>
            </div>

            <input type="hidden" name="responsavel_id" value={responsavel.id} />

            <label style={theme.field}>
              <span style={theme.fieldLabel}>Nome</span>
              <input
                name="nome"
                defaultValue={responsavel.nome}
                required
                style={theme.input}
              />
            </label>

            <label style={theme.field}>
              <span style={theme.fieldLabel}>E-mail (login)</span>
              <input
                name="email"
                type="email"
                defaultValue={responsavel.email}
                required
                style={theme.input}
              />
            </label>

            <label style={theme.field}>
              <span style={theme.fieldLabel}>Telefone</span>
              <input
                name="telefone"
                defaultValue={responsavel.telefone ?? ''}
                style={theme.input}
              />
            </label>

            <label style={theme.field}>
              <span style={theme.fieldLabel}>CPF (não editável)</span>
              <input value={responsavel.cpf} disabled style={theme.readonlyInput} />
            </label>

            <div style={theme.footer}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                style={theme.secondaryButton}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending}
                style={theme.primaryButton}
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
