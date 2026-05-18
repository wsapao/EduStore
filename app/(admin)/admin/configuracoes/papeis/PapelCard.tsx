'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { duplicarPapelAction, excluirPapelAction } from '@/app/actions/configuracoes/papeis'

type Papel = {
  id: string
  nome: string
  descricao: string | null
  preset: boolean
  chave_preset: string | null
  qtd_usuarios: number
  qtd_permissoes: number
}

export function PapelCard({ papel }: { papel: Papel }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const podeExcluir = !papel.preset && papel.qtd_usuarios === 0

  function duplicar() {
    if (!confirm(`Duplicar "${papel.nome}"?`)) return
    startTransition(async () => {
      const r = await duplicarPapelAction(papel.id)
      if ('error' in r) {
        alert(r.error)
        return
      }
      if (r.papelId) router.push(`/admin/configuracoes/papeis/${r.papelId}`)
    })
  }

  function excluir() {
    if (!confirm(`Excluir o papel "${papel.nome}"? Essa ação não pode ser desfeita.`)) return
    startTransition(async () => {
      const r = await excluirPapelAction(papel.id)
      if ('error' in r && r.error) {
        alert(r.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <article style={{
      background: 'var(--surface-2)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)', marginBottom: 2 }}>
            {papel.nome}
          </h3>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {papel.qtd_permissoes} permissão(ões) · {papel.qtd_usuarios} usuário(s)
          </span>
        </div>
        <span style={{
          fontSize: 10,
          fontWeight: 800,
          padding: '3px 8px',
          borderRadius: 999,
          background: papel.preset ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.18)',
          color: papel.preset ? '#f59e0b' : '#a5b4fc',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}>
          {papel.preset ? 'Preset' : 'Custom'}
        </span>
      </header>

      {papel.descricao && (
        <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.4 }}>{papel.descricao}</p>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
        <Link href={`/admin/configuracoes/papeis/${papel.id}`} style={btnSecondary}>Editar</Link>
        <button onClick={duplicar} disabled={pending} style={btnSecondary} type="button">Duplicar</button>
        {podeExcluir && (
          <button onClick={excluir} disabled={pending} style={btnDanger} type="button">Excluir</button>
        )}
      </div>
    </article>
  )
}

const btnSecondary: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '6px 12px',
  color: 'var(--text-1)',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  textDecoration: 'none',
}

const btnDanger: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(239,68,68,0.4)',
  borderRadius: 8,
  padding: '6px 12px',
  color: '#ef4444',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
}
