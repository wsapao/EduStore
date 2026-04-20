'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { criarAlunoAction, editarAlunoAction, toggleAlunoAtivoAction } from '@/app/actions/alunos'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Aluno } from '@/types/database'

// Séries disponíveis
const SERIES = [
  'Berçário I', 'Berçário II',
  'Maternal I', 'Maternal II',
  'Jardim I', 'Jardim II',
  '1º ano EF', '2º ano EF', '3º ano EF', '4º ano EF', '5º ano EF',
  '6º ano EF', '7º ano EF', '8º ano EF', '9º ano EF',
  '1º ano EM', '2º ano EM', '3º ano EM',
]

const TURMAS = ['A', 'B', 'C', 'D', 'E', 'F']

// ── Helpers ──────────────────────────────────────────────────────────────────
function iniciais(nome: string) {
  return nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

const GRADIENTS = [
  'linear-gradient(135deg,#6366f1,#8b5cf6)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#10b981,#059669)',
  'linear-gradient(135deg,#3b82f6,#6366f1)',
  'linear-gradient(135deg,#ec4899,#8b5cf6)',
]

interface Props {
  alunos: Aluno[]
  isOnboarding: boolean
}

type FormMode = 'none' | 'novo' | 'editar'

export function AlunosClient({ alunos: initialAlunos, isOnboarding }: Props) {
  const router = useRouter()
  const [alunos] = useState(initialAlunos)
  const [mode, setMode] = useState<FormMode>(initialAlunos.length === 0 ? 'novo' : 'none')
  const [editingAluno, setEditingAluno] = useState<Aluno | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isPending, startTransition] = useTransition()

  // Campos do formulário
  const [nome, setNome] = useState('')
  const [serie, setSerie] = useState('')
  const [turma, setTurma] = useState('')

  function abrirNovo() {
    setMode('novo')
    setEditingAluno(null)
    setNome('')
    setSerie('')
    setTurma('')
    setError('')
    setSuccess('')
  }

  function abrirEditar(aluno: Aluno) {
    setMode('editar')
    setEditingAluno(aluno)
    setNome(aluno.nome)
    setSerie(aluno.serie)
    setTurma(aluno.turma ?? '')
    setError('')
    setSuccess('')
  }

  function fecharForm() {
    setMode('none')
    setEditingAluno(null)
    setError('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const fd = new FormData()
    fd.set('nome', nome)
    fd.set('serie', serie)
    fd.set('turma', turma)
    if (mode === 'editar' && editingAluno) {
      fd.set('aluno_id', editingAluno.id)
    }

    startTransition(async () => {
      const res = mode === 'novo'
        ? await criarAlunoAction(fd)
        : await editarAlunoAction(fd)

      if (res.error) {
        setError(res.error)
        return
      }

      setSuccess(mode === 'novo' ? 'Aluno adicionado com sucesso!' : 'Dados atualizados!')
      fecharForm()
      router.refresh()

      if (isOnboarding) {
        setTimeout(() => router.push('/loja'), 800)
      }
    })
  }

  function handleToggle(aluno: Aluno) {
    startTransition(async () => {
      await toggleAlunoAtivoAction(aluno.id, aluno.ativo)
      router.refresh()
    })
  }

  const ativos   = alunos.filter(a => a.ativo)
  const inativos = alunos.filter(a => !a.ativo)

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 0 100px' }}>

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
        height: 60, padding: '0 20px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        {!isOnboarding && (
          <Link href="/loja" style={{
            width: 36, height: 36, borderRadius: 'var(--r-sm)',
            background: 'var(--surface-2)', border: '1.5px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-2)', textDecoration: 'none', flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-.02em' }}>
            {isOnboarding ? '👋 Bem-vindo! Adicione seu filho' : 'Meus filhos'}
          </div>
          {isOnboarding && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
              Adicione pelo menos um aluno para acessar a loja
            </div>
          )}
        </div>
        {!isOnboarding && mode === 'none' && (
          <button
            onClick={abrirNovo}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 'var(--r-md)',
              background: 'var(--brand)', color: '#fff',
              border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700,
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Adicionar
          </button>
        )}
      </div>

      <div style={{ padding: '20px 20px 0' }}>

        {/* Banner onboarding */}
        {isOnboarding && (
          <div style={{
            background: 'linear-gradient(135deg,#eff6ff,#f5f3ff)',
            border: '1px solid #c7d2fe',
            borderRadius: 16, padding: '16px 20px',
            marginBottom: 20, display: 'flex', gap: 14, alignItems: 'flex-start',
          }}>
            <div style={{ fontSize: 32 }}>🏫</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1e1b4b', marginBottom: 4 }}>
                Cadastre os alunos da sua família
              </div>
              <div style={{ fontSize: 13, color: '#4338ca', lineHeight: 1.6 }}>
                Você pode adicionar vários filhos. Os produtos disponíveis na loja são filtrados automaticamente pela série de cada aluno.
              </div>
            </div>
          </div>
        )}

        {/* Mensagem de sucesso */}
        {success && (
          <div style={{
            background: '#f0fdf4', border: '1px solid #86efac',
            borderRadius: 10, padding: '12px 16px',
            fontSize: 13, fontWeight: 600, color: '#15803d',
            marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            ✅ {success}
          </div>
        )}

        {/* Formulário de criação/edição */}
        {mode !== 'none' && (
          <div style={{
            background: '#fff',
            border: '1.5px solid var(--brand)',
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
            boxShadow: '0 0 0 4px rgba(26,47,90,.06)',
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)', marginBottom: 16 }}>
              {mode === 'novo' ? '➕ Novo aluno' : '✏️ Editar aluno'}
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Nome */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6, letterSpacing: '.03em' }}>
                  NOME COMPLETO *
                </label>
                <input
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Nome do aluno"
                  required
                  style={{
                    width: '100%', height: 44, padding: '0 14px',
                    borderRadius: 10, border: '1.5px solid var(--border)',
                    fontSize: 14, color: 'var(--text-1)',
                    background: 'var(--surface-2)', boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Série e Turma */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6, letterSpacing: '.03em' }}>
                    SÉRIE / ANO *
                  </label>
                  <select
                    value={serie}
                    onChange={e => setSerie(e.target.value)}
                    required
                    style={{
                      width: '100%', height: 44, padding: '0 14px',
                      borderRadius: 10, border: '1.5px solid var(--border)',
                      fontSize: 14, color: serie ? 'var(--text-1)' : 'var(--text-3)',
                      background: 'var(--surface-2)', appearance: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">Selecionar…</option>
                    {SERIES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6, letterSpacing: '.03em' }}>
                    TURMA
                  </label>
                  <select
                    value={turma}
                    onChange={e => setTurma(e.target.value)}
                    style={{
                      width: '100%', height: 44, padding: '0 14px',
                      borderRadius: 10, border: '1.5px solid var(--border)',
                      fontSize: 14, color: turma ? 'var(--text-1)' : 'var(--text-3)',
                      background: 'var(--surface-2)', appearance: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">Opcional</option>
                    {TURMAS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {error && (
                <div style={{
                  background: '#fef2f2', border: '1px solid #fca5a5',
                  borderRadius: 8, padding: '10px 14px',
                  fontSize: 13, color: '#b91c1c',
                }}>
                  ⚠️ {error}
                </div>
              )}

              {/* Botões */}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="submit"
                  disabled={isPending}
                  style={{
                    flex: 1, height: 46,
                    background: isPending ? '#94a3b8' : 'var(--brand)',
                    color: '#fff', border: 'none', borderRadius: 10,
                    fontSize: 14, fontWeight: 700, cursor: isPending ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isPending ? 'Salvando…' : mode === 'novo' ? 'Adicionar aluno' : 'Salvar alterações'}
                </button>
                {!isOnboarding && (
                  <button
                    type="button"
                    onClick={fecharForm}
                    style={{
                      height: 46, padding: '0 20px',
                      background: 'var(--surface-2)', color: 'var(--text-2)',
                      border: '1.5px solid var(--border)', borderRadius: 10,
                      fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Empty state para alunos (se não estiver adicionando) */}
        {ativos.length === 0 && mode === 'none' && !isOnboarding && (
          <div style={{ marginBottom: 20 }}>
            <EmptyState
              icon="🎒"
              title="Nenhum aluno cadastrado"
              description="Adicione um aluno para acessar a loja e visualizar os itens disponíveis para a série dele."
              actionLabel="➕ Adicionar aluno"
              actionOnClick={abrirNovo}
            />
          </div>
        )}

        {/* Lista de alunos ativos */}
        {ativos.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            {mode === 'none' && (
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '.06em', marginBottom: 10 }}>
                ALUNOS ATIVOS — {ativos.length}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ativos.map((aluno, idx) => (
                <AlunoCard
                  key={aluno.id}
                  aluno={aluno}
                  gradient={GRADIENTS[idx % GRADIENTS.length]}
                  onEditar={() => abrirEditar(aluno)}
                  onToggle={() => handleToggle(aluno)}
                  isPending={isPending}
                />
              ))}
            </div>
          </div>
        )}

        {/* Botão adicionar mais (abaixo da lista) */}
        {mode === 'none' && ativos.length > 0 && (
          <button
            onClick={abrirNovo}
            style={{
              width: '100%', height: 48,
              background: 'var(--surface-2)',
              border: '1.5px dashed var(--border)',
              borderRadius: 12, cursor: 'pointer',
              fontSize: 13, fontWeight: 600, color: 'var(--text-3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginBottom: 20,
            }}
          >
            <span style={{ fontSize: 18 }}>+</span> Adicionar outro filho
          </button>
        )}

        {/* CTA ir para a loja após onboarding */}
        {isOnboarding && ativos.length > 0 && mode === 'none' && (
          <Link href="/loja" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            height: 50, borderRadius: 12,
            background: 'var(--brand)', color: '#fff',
            fontWeight: 700, fontSize: 14, textDecoration: 'none',
          }}>
            🏪 Acessar a loja
          </Link>
        )}

        {/* Alunos inativos */}
        {inativos.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '.06em', marginBottom: 10 }}>
              INATIVOS — {inativos.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: .6 }}>
              {inativos.map((aluno, idx) => (
                <AlunoCard
                  key={aluno.id}
                  aluno={aluno}
                  gradient={GRADIENTS[idx % GRADIENTS.length]}
                  onEditar={() => abrirEditar(aluno)}
                  onToggle={() => handleToggle(aluno)}
                  isPending={isPending}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-componente: card do aluno ─────────────────────────────────────────────
function AlunoCard({
  aluno, gradient, onEditar, onToggle, isPending
}: {
  aluno: Aluno
  gradient: string
  onEditar: () => void
  onToggle: () => void
  isPending: boolean
}) {
  return (
    <div style={{
      background: '#fff',
      border: `1.5px solid ${aluno.ativo ? 'var(--border)' : '#e2e8f0'}`,
      borderRadius: 14,
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 16px',
    }}>
      {/* Avatar */}
      <div style={{
        width: 46, height: 46, borderRadius: '50%',
        background: aluno.ativo ? gradient : '#e2e8f0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, fontWeight: 800, color: '#fff', flexShrink: 0,
      }}>
        {iniciais(aluno.nome)}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: aluno.ativo ? 'var(--text-1)' : 'var(--text-3)' }}>
          {aluno.nome}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
          {aluno.serie}{aluno.turma ? ` · Turma ${aluno.turma}` : ''}
        </div>
      </div>

      {/* Ações */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {aluno.ativo && (
          <button
            onClick={onEditar}
            style={{
              height: 34, width: 34, borderRadius: 8,
              background: 'var(--surface-2)', border: '1.5px solid var(--border)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
            }}
            title="Editar"
          >
            ✏️
          </button>
        )}
        <button
          onClick={onToggle}
          disabled={isPending}
          style={{
            height: 34, padding: '0 12px', borderRadius: 8,
            background: aluno.ativo ? '#fef2f2' : '#f0fdf4',
            border: aluno.ativo ? '1.5px solid #fecaca' : '1.5px solid #86efac',
            color: aluno.ativo ? '#b91c1c' : '#15803d',
            cursor: 'pointer', fontSize: 12, fontWeight: 700,
          }}
          title={aluno.ativo ? 'Desativar' : 'Reativar'}
        >
          {aluno.ativo ? 'Desativar' : 'Reativar'}
        </button>
      </div>
    </div>
  )
}
