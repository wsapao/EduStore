'use client'

import { useTransition } from 'react'
import { excluirProdutoAction } from '@/app/actions/admin'
import { getAdminButtonStyle } from '@/lib/admin-ui-tones'

export function ExcluirProdutoButton({ produtoId, nome }: { produtoId: string; nome: string }) {
  const [pending, startTransition] = useTransition()

  function onClick() {
    if (!confirm(`Excluir "${nome}" permanentemente?`)) return
    startTransition(async () => {
      await excluirProdutoAction(produtoId)
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
