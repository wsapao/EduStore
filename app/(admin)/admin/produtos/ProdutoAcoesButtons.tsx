'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import {
  duplicarProdutoAction,
  toggleEsgotadoAction,
  toggleProdutoAtivoAction,
} from '@/app/actions/admin'
import { getDuplicarUi, getToggleAtivoUi, getToggleEsgotadoUi } from './produtoAcoesUi'
import type { ProdutoAcaoUi } from './produtoAcoesUi'

type ActionResult = { success: boolean; error?: string }

function AcaoButton({ ui, pending, onClick }: {
  ui: ProdutoAcaoUi
  pending: boolean
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} disabled={pending} style={ui.style}>
      {ui.label}
    </button>
  )
}

function useAcao(run: () => Promise<ActionResult>, successMessage: string) {
  const [pending, startTransition] = useTransition()

  function onClick() {
    startTransition(async () => {
      const res = await run()
      if (res.success) {
        toast.success(successMessage)
      } else {
        toast.error(res.error ?? 'Não foi possível concluir a ação. Recarregue a página e tente novamente.')
      }
    })
  }

  return { pending, onClick }
}

export function ToggleAtivoButton({ produtoId, isAtivo }: { produtoId: string; isAtivo: boolean }) {
  const ui = getToggleAtivoUi({ isAtivo, pending: false })
  const { pending, onClick } = useAcao(() => toggleProdutoAtivoAction(produtoId, isAtivo), ui.toastSuccess)
  return <AcaoButton ui={getToggleAtivoUi({ isAtivo, pending })} pending={pending} onClick={onClick} />
}

export function ToggleEsgotadoButton({ produtoId, isEsgotado }: { produtoId: string; isEsgotado: boolean }) {
  const ui = getToggleEsgotadoUi({ isEsgotado, pending: false })
  const { pending, onClick } = useAcao(() => toggleEsgotadoAction(produtoId, isEsgotado), ui.toastSuccess)
  return <AcaoButton ui={getToggleEsgotadoUi({ isEsgotado, pending })} pending={pending} onClick={onClick} />
}

export function DuplicarProdutoButton({ produtoId }: { produtoId: string }) {
  const ui = getDuplicarUi({ pending: false })
  const { pending, onClick } = useAcao(() => duplicarProdutoAction(produtoId), ui.toastSuccess)
  return <AcaoButton ui={getDuplicarUi({ pending })} pending={pending} onClick={onClick} />
}
