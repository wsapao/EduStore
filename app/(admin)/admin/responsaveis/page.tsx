import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Aluno } from '@/types/database'
import {
  desvincularAlunoResponsavelAction,
  vincularAlunoResponsavelAction,
} from '@/app/actions/admin'
import {
  getAdminButtonStyle,
  getAdminPillStyle,
  getAdminTone,
} from '@/lib/admin-ui-tones'
import { EditarResponsavelDialog } from './EditarResponsavelDialog'
import { ResetSenhaButton } from './ResetSenhaButton'
import { DefinirSenhaButton } from './DefinirSenhaButton'

interface ResponsavelRow {
  id: string
  nome: string
  email: string
  cpf: string
  telefone: string | null
  created_at: string
  vinculos?: Array<{
    aluno: Aluno | Aluno[] | null
  }> | null
}

function maskCPF(cpf: string) {
  const c = cpf.replace(/\D/g, '')
  if (c.length !== 11) return cpf
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`
}

function maskPhone(phone: string | null) {
  if (!phone) return '—'
  const d = phone.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return phone
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

const PAGE_SIZE = 20

export default async function AdminResponsaveisPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const { q, page } = await searchParams
  const term = q?.trim().toLocaleLowerCase('pt-BR') ?? ''
  const currentPage = Math.max(1, parseInt(page ?? '1', 10) || 1)
  const from = (currentPage - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') redirect('/loja')

  let query = supabase
    .from('responsaveis')
    .select(
      `
      id, nome, email, cpf, telefone, created_at,
      vinculos:responsavel_aluno(
        aluno:alunos(id, nome, serie, turma, ativo, escola_id, created_at)
      )
    `,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })

  if (term) {
    query = query.or(`nome.ilike.%${term}%,email.ilike.%${term}%,cpf.ilike.%${term}%`)
  }

  const [{ data: rows, count: totalCount }, { data: alunosRows }] = await Promise.all([
    query.range(from, to),
    supabase
      .from('alunos')
      .select('id, nome, serie, turma, ativo, escola_id, created_at')
      .order('nome', { ascending: true }),
  ])

  const responsaveis = ((rows ?? []) as unknown as ResponsavelRow[]).map((row) => ({
    ...row,
    alunos: (row.vinculos ?? [])
      .map((vinculo) => firstOf(vinculo.aluno))
      .filter((aluno): aluno is Aluno => !!aluno),
  }))

  const totalPages = Math.max(1, Math.ceil((totalCount ?? 0) / PAGE_SIZE))
  const totalAlunosVinculados = responsaveis.reduce((sum, row) => sum + row.alunos.length, 0)
  const semTelefone = responsaveis.filter((row) => !row.telefone).length
  const semAlunos = responsaveis.filter((row) => row.alunos.length === 0).length
  const alunosDisponiveis = (alunosRows ?? []) as Aluno[]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 80 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <span
            style={{
              ...getAdminPillStyle('accent', {
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 800,
              }),
              textTransform: 'uppercase',
              letterSpacing: '.08em',
              marginBottom: 12,
            }}
          >
            Relacionamento
          </span>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 900,
              color: 'var(--text-1)',
              margin: 0,
              letterSpacing: '-.03em',
            }}
          >
            Responsáveis
          </h1>
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-3)',
              margin: '6px 0 0',
              fontWeight: 500,
            }}
          >
            Base de contatos das famílias e alunos vinculados
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))',
            gap: 12,
            width: '100%',
            maxWidth: 460,
          }}
        >
          <MiniStat label="Famílias" value={totalCount ?? 0} tone="info" />
          <MiniStat label="Alunos ligados" value={totalAlunosVinculados} tone="success" />
          <MiniStat label="Sem telefone" value={semTelefone} tone={semTelefone > 0 ? 'warning' : 'neutral'} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Link
          href={q ? `/admin/responsaveis/export?q=${encodeURIComponent(q)}` : '/admin/responsaveis/export'}
          style={getAdminButtonStyle('neutral', 'soft', {
            height: 42,
            padding: '0 20px',
            borderRadius: 14,
            fontSize: 13,
          })}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Exportar CSV
          </span>
        </Link>
      </div>

      <form
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,247,237,0.94) 100%)',
          border: '1px solid rgba(249,115,22,.14)',
          borderRadius: 16,
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
            <svg
              style={{ position: 'absolute', left: 14, top: 12, color: 'var(--text-3)' }}
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              name="q"
              defaultValue={q ?? ''}
              placeholder="Buscar por nome, email, CPF, telefone ou aluno..."
              style={searchInputStyle}
            />
          </div>
          <button
            type="submit"
            style={getAdminButtonStyle('accent', 'solid', {
              height: 44,
              borderRadius: 12,
              fontSize: 13,
            })}
          >
            Buscar
          </button>
          {q && (
            <Link
              href="/admin/responsaveis"
              style={getAdminButtonStyle('neutral', 'soft', {
                height: 44,
                borderRadius: 12,
                fontSize: 13,
              })}
            >
              Limpar
            </Link>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <FilterBadge>{responsaveis.length} responsáveis</FilterBadge>
          <FilterBadge tone="info">{totalAlunosVinculados} vínculos ativos</FilterBadge>
          <FilterBadge tone={semAlunos > 0 ? 'danger' : 'neutral'}>{semAlunos} sem alunos</FilterBadge>
        </div>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {responsaveis.length === 0 && (
          <EmptyState
            title="Nenhum responsável encontrado"
            description={q ? `Nenhum resultado para "${q}".` : 'Ainda não há responsáveis cadastrados.'}
          />
        )}

        {responsaveis.map((responsavel) => (
          <div
            key={responsavel.id}
            style={{
              background: 'linear-gradient(180deg, #ffffff 0%, #fffdfa 100%)',
              border: '1px solid rgba(249,115,22,.12)',
              borderRadius: 20,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: 'linear-gradient(135deg, #f97316, #ec4899)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 16,
                    fontWeight: 900,
                    boxShadow: '0 10px 22px rgba(249,115,22,.18)',
                  }}
                >
                  {initials(responsavel.nome)}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 900,
                      color: 'var(--text-1)',
                      letterSpacing: '-.02em',
                    }}
                  >
                    {responsavel.nome}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--text-3)',
                      marginTop: 2,
                      fontWeight: 500,
                    }}
                  >
                    {responsavel.email}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <FilterBadge tone="neutral">{responsavel.alunos.length} aluno(s)</FilterBadge>
                {!responsavel.telefone && <FilterBadge tone="warning">Sem telefone</FilterBadge>}
                <ResetSenhaButton
                  responsavelId={responsavel.id}
                  responsavelNome={responsavel.nome}
                />
                <DefinirSenhaButton
                  responsavelId={responsavel.id}
                  responsavelNome={responsavel.nome}
                />
                <EditarResponsavelDialog
                  responsavel={{
                    id: responsavel.id,
                    nome: responsavel.nome,
                    email: responsavel.email,
                    cpf: responsavel.cpf,
                    telefone: responsavel.telefone,
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
              }}
            >
              <InfoCard label="CPF" value={maskCPF(responsavel.cpf)} tone="accent" />
              <InfoCard label="Telefone" value={maskPhone(responsavel.telefone)} tone={responsavel.telefone ? 'neutral' : 'warning'} />
              <InfoCard label="Cadastro" value={new Date(responsavel.created_at).toLocaleDateString('pt-BR')} tone="neutral" />
            </div>

            <div style={{ marginTop: 4, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: 'var(--text-3)',
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  marginBottom: 12,
                }}
              >
                Alunos vinculados
              </div>
              {responsavel.alunos.length === 0 ? (
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: 12,
                    background: '#fff7ed',
                    border: '1px solid #fdba74',
                    fontSize: 13,
                    color: '#9a3412',
                    fontWeight: 600,
                  }}
                >
                  Este responsável ainda não tem aluno vinculado.
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {responsavel.alunos.map((aluno) => (
                    <form key={aluno.id} action={desvincularAlunoResponsavelAction} style={{ margin: 0 }}>
                      <input type="hidden" name="responsavel_id" value={responsavel.id} />
                      <input type="hidden" name="aluno_id" value={aluno.id} />
                      <button
                        type="submit"
                        style={{
                          ...(aluno.ativo
                            ? getAdminPillStyle('info', {
                                padding: '8px 12px',
                                fontSize: 12,
                                fontWeight: 800,
                                gap: 8,
                              })
                            : getAdminPillStyle('neutral', {
                                padding: '8px 12px',
                                fontSize: 12,
                                fontWeight: 800,
                                gap: 8,
                              })),
                          cursor: 'pointer',
                          textTransform: 'none',
                        }}
                      >
                        <span>{aluno.nome}</span>
                        <span style={{ opacity: 0.75 }}>
                          {aluno.serie}
                          {aluno.turma ? ` · ${aluno.turma}` : ''}
                        </span>
                        <span style={{ color: '#dc2626', fontWeight: 900, marginLeft: 4 }}>×</span>
                      </button>
                    </form>
                  ))}
                </div>
              )}
            </div>

            <form
              action={vincularAlunoResponsavelAction}
              style={{
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap',
                alignItems: 'center',
                padding: 16,
                borderTop: '1px solid var(--border)',
                borderRadius: 16,
                background: 'var(--surface-2)',
              }}
            >
              <input type="hidden" name="responsavel_id" value={responsavel.id} />
              {(() => {
                const linkedIds = new Set(responsavel.alunos.map((linked) => linked.id))
                return (
                  <select name="aluno_id" defaultValue="" style={selectStyle}>
                    <option value="" style={{ color: '#111827' }}>
                      Vincular um aluno...
                    </option>
                    {alunosDisponiveis
                      .filter((aluno) => !linkedIds.has(aluno.id))
                      .map((aluno) => (
                        <option key={aluno.id} value={aluno.id} style={{ color: '#111827' }}>
                          {aluno.nome} · {aluno.serie}
                          {aluno.turma ? ` · ${aluno.turma}` : ''}
                        </option>
                      ))}
                  </select>
                )
              })()}
              <button
                type="submit"
                style={getAdminButtonStyle('accent', 'solid', {
                  height: 44,
                  padding: '0 18px',
                  borderRadius: 12,
                  fontSize: 13,
                })}
              >
                Vincular aluno
              </button>
            </form>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            padding: '10px 0',
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 700 }}>
            Página {currentPage} de {totalPages} · {totalCount} responsáveis
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link
              href={currentPage > 1 ? `/admin/responsaveis?${q ? `q=${encodeURIComponent(q)}&` : ''}page=${currentPage - 1}` : '#'}
              style={pagerBtn(currentPage > 1)}
            >
              ← Anterior
            </Link>
            <Link
              href={currentPage < totalPages ? `/admin/responsaveis?${q ? `q=${encodeURIComponent(q)}&` : ''}page=${currentPage + 1}` : '#'}
              style={pagerBtn(currentPage < totalPages)}
            >
              Próxima →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function pagerBtn(active: boolean) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    padding: '0 16px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 800,
    textDecoration: 'none',
    transition: 'all .2s',
    background: '#f8fafc',
    color: active ? 'var(--text-2)' : '#94a3b8',
    border: active ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
    pointerEvents: active ? 'auto' : 'none',
  } as const
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'info' | 'success' | 'warning' | 'neutral'
}) {
  const cfg = getAdminTone(tone)

  return (
    <div
      style={{
        padding: '16px',
        borderRadius: 16,
        border: `1px solid ${cfg.border}`,
        background: `linear-gradient(180deg, ${cfg.bg} 0%, rgba(255,255,255,0.92) 100%)`,
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: 'var(--text-3)',
          letterSpacing: '.05em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          color: cfg.text,
          marginTop: 4,
          letterSpacing: '-.02em',
        }}
      >
        {value}
      </div>
    </div>
  )
}

function InfoCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'accent' | 'neutral' | 'warning'
}) {
  const cfg = getAdminTone(tone)

  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: 12,
        border: `1px solid ${cfg.border}`,
        background: tone === 'neutral' ? 'var(--surface-2)' : cfg.bg,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: tone === 'neutral' ? 'var(--text-3)' : cfg.text,
          letterSpacing: '.05em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: tone === 'neutral' ? 'var(--text-1)' : cfg.text,
          marginTop: 6,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function FilterBadge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'warning' | 'danger' | 'info'
}) {
  return (
    <span
      style={{
        ...getAdminPillStyle(tone, {
          padding: '6px 12px',
          fontSize: 11,
          fontWeight: 800,
        }),
        textTransform: 'uppercase',
        letterSpacing: '.05em',
      }}
    >
      {children}
    </span>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1.5px dashed var(--border)',
        borderRadius: 20,
        padding: '70px 20px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ fontSize: 44, marginBottom: 16, opacity: 0.6 }}>👥</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-.02em' }}>
        {title}
      </div>
      <p
        style={{
          fontSize: 14,
          color: 'var(--text-3)',
          lineHeight: 1.6,
          marginTop: 8,
          maxWidth: 300,
        }}
      >
        {description}
      </p>
    </div>
  )
}

const searchInputStyle = {
  width: '100%',
  height: 44,
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  padding: '0 14px 0 40px',
  fontSize: 14,
  color: 'var(--text-1)',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
} as const

const selectStyle = {
  minWidth: 260,
  height: 44,
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  padding: '0 14px',
  fontSize: 13,
  color: 'var(--text-1)',
  fontFamily: 'inherit',
  outline: 'none',
} as const
