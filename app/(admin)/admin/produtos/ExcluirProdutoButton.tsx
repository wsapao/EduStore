'use client'

import { useTransition } from 'react'
import { excluirProdutoAction } from '@/app/actions/admin'

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
        width: '100%',
        padding: '10px',
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 800,
        cursor: pending ? 'wait' : 'pointer',
        background: 'transparent',
        color: '#64748b',
        border: '1.5px dashed rgba(255,255,255,.1)',
      }}
    >
      {pending ? 'Excluindo…' : '🗑 Excluir produto'}
    </button>
  )
}
