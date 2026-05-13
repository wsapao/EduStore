'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  alterarPapelUsuarioAction,
  toggleSuspensaoUsuarioAction,
  removerUsuarioAction,
} from '@/app/actions/configuracoes/usuarios'
import type { UsuarioListItem } from './page'

type PapelOpt = { id: string; nome: string; chave_preset: string | null; preset: boolean }

function fmtData(iso: string | null): string {
  if (!iso) return 'Nunca acessou'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const dias = Math.floor(diff / 86400000)
  if (dias === 0) return 'Hoje'
  if (dias === 1) return 'Ontem'
  if (dias < 30) return `há ${dias} dias`
  if (dias < 365) return `há ${Math.floor(dias / 30)} meses`
  return d.toLocaleDateString('pt-BR')
}

export function UsuarioRow({
  usuario,
  papeis,
  isSelf,
}: {
  usuario: UsuarioListItem
  papeis: PapelOpt[]
  isSelf: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function alterarPapel(novoId: string) {
    if (novoId === usuario.papel_id) return
    setErro(null)
    startTransition(async () => {
      const r = await alterarPapelUsuarioAction(usuario.user_id, novoId)
      if ('error' in r && r.error) {
        setErro(r.error)
        return
      }
      router.refresh()
    })
  }

  function toggleSuspensao() {
    setErro(null)
    if (!confirm(usuario.suspenso ? `Reativar ${usuario.email}?` : `Suspender ${usuario.email}? Ele perde acesso imediatamente.`)) return
    startTransition(async () => {
      const r = await toggleSuspensaoUsuarioAction(usuario.user_id, !usuario.suspenso)
      if ('error' in r && r.error) {
        setErro(r.error)
        return
      }
      router.refresh()
    })
  }

  function remover() {
    setErro(null)
    if (!confirm(`Remover ${usuario.email} da escola? Essa ação não pode ser desfeita.`)) return
    startTransition(async () => {
      const r = await removerUsuarioAction(usuario.user_id)
      if ('error' in r && r.error) {
        setErro(r.error)
        return
      }
      router.refresh()
    })
  }

  const opacity = usuario.suspenso ? 0.55 : 1

  return (
    <div style={{
      borderTop: '1px solid rgba(255,255,255,0.06)',
      padding: '14px 16px',
      display: 'grid',
      gridTemplateColumns: '1.4fr 1.2fr 0.8fr auto',
      gap: 14,
      alignItems: 'center',
      opacity,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {usuario.nome ?? usuario.email ?? '(sem nome)'}
          {isSelf && <span style={{ marginLeft: 6, fontSize: 10, color: '#fbbf24' }}>(você)</span>}
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {usuario.email}
        </div>
      </div>

      <div>
        <select
          defaultValue={usuario.papel_id}
          onChange={e => alterarPapel(e.target.value)}
          disabled={pending || isSelf}
          style={selectStyle}
        >
          {papeis.map(p => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </select>
      </div>

      <div style={{ fontSize: 11, color: '#94a3b8' }}>
        {usuario.suspenso ? <span style={{ color: '#ef4444', fontWeight: 700 }}>Suspenso</span> : fmtData(usuario.last_sign_in_at)}
      </div>

      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        {!isSelf && (
          <>
            <button onClick={toggleSuspensao} disabled={pending} style={btnGhost} type="button">
              {usuario.suspenso ? 'Reativar' : 'Suspender'}
            </button>
            <button onClick={remover} disabled={pending} style={btnDanger} type="button">
              Remover
            </button>
          </>
        )}
      </div>

      {erro && (
        <div style={{ gridColumn: '1 / -1', fontSize: 12, color: '#ef4444' }}>
          {erro}
        </div>
      )}
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.25)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: '6px 10px',
  color: '#f8fafc',
  fontSize: 12,
  outline: 'none',
  width: '100%',
  cursor: 'pointer',
}

const btnGhost: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: '6px 12px',
  color: '#f8fafc',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
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
