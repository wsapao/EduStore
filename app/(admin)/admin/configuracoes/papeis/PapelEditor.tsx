'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PERMISSION_GROUPS } from '@/lib/permissoes/keys'
import { criarPapelAction, atualizarPapelAction } from '@/app/actions/configuracoes/papeis'

export type PapelEditorInitial = {
  papelId?: string
  nome: string
  descricao: string
  preset: boolean
  chavesAtuais: string[]
}

export function PapelEditor({ initial }: { initial: PapelEditorInitial }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [chaves, setChaves] = useState<Set<string>>(new Set(initial.chavesAtuais))

  const isEditing = !!initial.papelId
  const isPreset = initial.preset

  function toggleChave(c: string) {
    setChaves(prev => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  }

  function marcarTodasDoModulo(modulo: string) {
    const novas = PERMISSION_GROUPS.find(g => g.modulo === modulo)?.permissoes.map(p => p.chave) ?? []
    setChaves(prev => {
      const next = new Set(prev)
      const todasMarcadas = novas.every(k => next.has(k))
      if (todasMarcadas) novas.forEach(k => next.delete(k))
      else novas.forEach(k => next.add(k))
      return next
    })
  }

  function marcarSoVer() {
    setChaves(() => {
      const next = new Set<string>()
      for (const g of PERMISSION_GROUPS) {
        for (const p of g.permissoes) {
          if (p.chave.endsWith('.ver')) next.add(p.chave)
        }
      }
      return next
    })
  }

  async function onSubmit(formData: FormData) {
    setMsg(null)
    Array.from(chaves).forEach(c => formData.append('chaves', c))
    startTransition(async () => {
      const r = isEditing
        ? await atualizarPapelAction(initial.papelId!, formData)
        : await criarPapelAction(formData)
      if ('error' in r) {
        setMsg({ tipo: 'erro', texto: r.error })
        return
      }
      router.push(`/admin/configuracoes/papeis`)
      router.refresh()
    })
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link href="/admin/configuracoes/papeis" style={{ fontSize: 12, color: 'var(--text-3)', textDecoration: 'none' }}>
          ← Voltar para papéis
        </Link>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-1)', marginTop: 6 }}>
          {isEditing ? 'Editar papel' : 'Novo papel customizado'}
        </h1>
        {isPreset && (
          <p style={{ fontSize: 12, color: '#fbbf24', marginTop: 6 }}>
            ⚠️ Este é um papel padrão. Alterações afetam todos os usuários que o utilizam.
          </p>
        )}
      </div>

      <form action={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 820 }}>
        <Field label="Nome *">
          <input
            name="nome"
            defaultValue={initial.nome}
            required
            minLength={2}
            maxLength={50}
            style={inputStyle}
          />
        </Field>

        <Field label="Descrição">
          <input
            name="descricao"
            defaultValue={initial.descricao}
            maxLength={200}
            placeholder="Para que serve este papel?"
            style={inputStyle}
          />
        </Field>

        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-1)' }}>
              Permissões ({chaves.size})
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={marcarSoVer} style={btnGhost}>Marcar só "ver"</button>
              <button type="button" onClick={() => setChaves(new Set())} style={btnGhost}>Limpar tudo</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {PERMISSION_GROUPS.map(group => {
              const todas = group.permissoes.map(p => p.chave)
              const todasMarcadas = todas.every(k => chaves.has(k))
              return (
                <div key={group.modulo} style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-1)' }}>{group.rotulo}</span>
                    <button
                      type="button"
                      onClick={() => marcarTodasDoModulo(group.modulo)}
                      style={{ ...btnGhost, fontSize: 10, padding: '2px 8px' }}
                    >
                      {todasMarcadas ? 'Desmarcar' : 'Marcar todas'}
                    </button>
                  </div>
                  {group.permissoes.map(perm => (
                    <label key={perm.chave} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={chaves.has(perm.chave)}
                        onChange={() => toggleChave(perm.chave)}
                        style={{ width: 14, height: 14, accentColor: '#f59e0b', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{perm.rotulo}</span>
                    </label>
                  ))}
                </div>
              )
            })}
          </div>
        </section>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="submit" disabled={pending} style={btnPrimary}>
            {pending ? 'Salvando…' : (isEditing ? 'Salvar alterações' : 'Criar papel')}
          </button>
          <Link href="/admin/configuracoes/papeis" style={{ ...btnGhost, padding: '10px 18px' }}>
            Cancelar
          </Link>
          {msg && (
            <span style={{ fontSize: 13, color: msg.tipo === 'ok' ? '#22c55e' : '#ef4444' }}>
              {msg.texto}
            </span>
          )}
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>{label}</span>
      {children}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '10px 12px',
  color: 'var(--text-1)',
  fontSize: 14,
  outline: 'none',
}

const btnPrimary: React.CSSProperties = {
  background: '#f59e0b',
  border: 'none',
  borderRadius: 10,
  padding: '10px 18px',
  color: '#0a1628',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
}

const btnGhost: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '6px 12px',
  color: 'var(--text-2)',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-block',
}
