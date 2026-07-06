'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { excluirProdutoAction } from '@/app/actions/admin'
import { getAdminButtonStyle } from '@/lib/admin-ui-tones'

export function ExcluirProdutoButton({ produtoId, nome }: { produtoId: string; nome: string }) {
  const [pending, startTransition] = useTransition()

  function onClick() {
    if (!confirm(`Excluir "${nome}" permanentemente?`)) return
    startTransition(async () => {
      const res = await excluirProdutoAction(produtoId)
      if (res.success) {
        toast.success(`"${nome}" excluído.`)
      } else {
        toast.error(res.error ?? 'Não foi possível excluir o produto.')
      }
    })
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      style={{
        ...getAdminButtonStyle('neutral', 'soft', { width: '100%', height: 42, borderRadius: 10 }),
        cursor: pending ? 'wait' : 'pointer',
        borderStyle: 'dashed',
      }}
    >
      {pending ? 'Excluindo…' : '🗑 Excluir produto'}
    </button>
  )
}
