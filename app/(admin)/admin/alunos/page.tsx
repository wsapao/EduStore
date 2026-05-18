import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Responsavel } from '@/types/database'
import {
  desvincularAlunoResponsavelAction,
  vincularAlunoResponsavelAction,
} from '@/app/actions/admin'
import { getSeriesDisponiveis } from '@/lib/crm/series'
import {
  getAdminButtonStyle,
  getAdminPillStyle,
  getAdminTone,
} from '@/lib/admin-ui-tones'

interface AlunoAdminRow {
  id: string
  nome: string
  serie: string
  turma: string | null
  ativo: boolean
  created_at: string
  vinculos?: Array<{
    responsavel: Responsavel | Responsavel[] | null
  }> | null
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

const PAGE_SIZE = 25

export default async function AdminAlunosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; serie?: string; page?: string }>
}) {
  const { q, serie, page } = await searchParams
  const term = q?.trim().toLocaleLowerCase('pt-BR') ?? ''
  const selectedSerie = serie?.trim() ?? ''
  const currentPage = Math.max(1, parseInt(page ?? '1', 10) || 1)
  const from = (currentPage - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') redirect('/loja')

  let query = supabase
    .from('alunos')
    .select(
      `
      id, nome, serie, turma, ativo, created_at,
      vinculos:responsavel_aluno(
        responsavel:responsaveis(id, nome, email, cpf, telefone, escola_id, created_at)
      )
    `,
      { count: 'exact' },
    )
    .order('nome', { ascending: true })

  if (selectedSerie) query = query.eq('serie', selectedSerie)
  if (term) query = query.ilike('nome', `%${term}%`)

  const [{ data: rows, count: totalCount }, seriesDisponiveis, { data: responsaveisRows }] =
    await Promise.all([
      query.range(from, to),
      getSeriesDisponiveis(),
      supabase
        .from('responsaveis')
        .select('id, nome, email, cpf, telefone, escola_id, created_at')
        .order('nome', { ascending: true }),
    ])

  const alunos = ((rows ?? []) as unknown as AlunoAdminRow[]).map((row) => ({
    ...row,
    responsaveis: (row.vinculos ?? [])
      .map((vinculo) => firstOf(vinculo.responsavel))
      .filter((responsavel): responsavel is Responsavel => !!responsavel),
  }))

  const totalPages = Math.max(1, Math.ceil((totalCount ?? 0) / PAGE_SIZE))
  const ativos = alunos.filter((row) => row.ativo).length
  const semResponsavel = alunos.filter((row) => row.responsaveis.length === 0).length
  const responsaveisDisponiveis = (responsaveisRows ?? []) as Responsavel[]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 80 }}>
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
            Base Escolar
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
            Alunos
          </h1>
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-3)',
              margin: '6px 0 0',
              fontWeight: 500,
            }}
          >
            Lista escolar com série, turma e responsáveis vinculados
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(110px, 1fr))',
            gap: 10,
            width: '100%',
            maxWidth: 400,
          }}
        >
          <MiniStat label="Alunos" value={alunos.length} tone="info" />
          <MiniStat label="Ativos" value={ativos} tone="success" />
          <MiniStat label="Sem vínculo" value={semResponsavel} tone={semResponsavel > 0 ? 'warning' : 'neutral'} />
        </div>
      </div>

      <form
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,247,237,0.94) 100%)',
          border: '1px solid rgba(249,115,22,.14)',
          borderRadius: 16,
          padding: '14px 16px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="Buscar por aluno ou responsável"
            style={textInputStyle}
          />
          <select name="serie" defaultValue={selectedSerie} style={selectStyle}>
            <option value="" style={{ color: '#111827' }}>
              Todas as séries
            </option>
            {seriesDisponiveis.map((option) => (
              <option key={option} value={option} style={{ color: '#111827' }}>
                {option}
              </option>
            ))}
          </select>
          <button
            type="submit"
            style={getAdminButtonStyle('accent', 'solid', {
              height: 46,
              padding: '0 16px',
              borderRadius: 12,
              fontSize: 13,
            })}
          >
            Filtrar
          </button>
          {(q || selectedSerie) && (
            <Link
              href="/admin/alunos"
              style={getAdminButtonStyle('neutral', 'soft', {
                height: 46,
                padding: '0 16px',
                borderRadius: 12,
                fontSize: 13,
              })}
            >
              Limpar
            </Link>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <Badge>{alunos.length} alunos</Badge>
          {selectedSerie && <Badge tone="info">{selectedSerie}</Badge>}
          <Badge tone={semResponsavel > 0 ? 'warning' : 'neutral'}>{semResponsavel} sem vínculo</Badge>
        </div>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {alunos.length === 0 && (
          <EmptyState
            title="Nenhum aluno encontrado"
            description={
              q || selectedSerie
                ? 'Tente ajustar a busca ou remover o filtro de série.'
                : 'Ainda não há alunos cadastrados.'
            }
          />
        )}

        {alunos.map((aluno) => (
          <div
            key={aluno.id}
            style={{
              background: 'linear-gradient(180deg, #ffffff 0%, #fffdfa 100%)',
              border: '1px solid rgba(249,115,22,.12)',
              borderRadius: 16,
              padding: 20,
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
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
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)' }}>{aluno.nome}</span>
                  <Badge tone={aluno.ativo ? 'success' : 'neutral'}>
                    {aluno.ativo ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                  {aluno.serie}
                  {aluno.turma ? ` · Turma ${aluno.turma}` : ''}
                  {' · cadastro em '}
                  {new Date(aluno.created_at).toLocaleDateString('pt-BR')}
                </div>
              </div>
              <Badge tone="neutral">{aluno.responsaveis.length} responsável(is)</Badge>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 12,
              }}
            >
              <InfoCard label="Série" value={aluno.serie} tone="info" />
              <InfoCard label="Turma" value={aluno.turma ?? 'Não informada'} tone="neutral" />
              <InfoCard
                label="Cadastro"
                value={new Date(aluno.created_at).toLocaleDateString('pt-BR')}
                tone="neutral"
              />
            </div>

            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: 'var(--text-3)',
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}
              >
                Responsáveis vinculados
              </div>
              {aluno.responsaveis.length === 0 ? (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: '#fff7ed',
                    border: '1px solid #fdba74',
                    fontSize: 13,
                    color: '#9a3412',
                    fontWeight: 600,
                  }}
                >
                  Este aluno ainda não possui responsável vinculado.
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 10,
                  }}
                >
                  {aluno.responsaveis.map((responsavel) => (
                    <form key={responsavel.id} action={desvincularAlunoResponsavelAction} style={{ margin: 0 }}>
                      <input type="hidden" name="responsavel_id" value={responsavel.id} />
                      <input type="hidden" name="aluno_id" value={aluno.id} />
                      <button
                        type="submit"
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          borderRadius: 12,
                          border: '1px solid var(--border)',
                          background: 'var(--surface-2)',
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-1)' }}>
                            {responsavel.nome}
                          </div>
                          <span style={{ color: '#dc2626', fontWeight: 800 }}>×</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                          {responsavel.email}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
                          {responsavel.telefone ? `Tel. ${responsavel.telefone}` : 'Sem telefone'}
                        </div>
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
              <input type="hidden" name="aluno_id" value={aluno.id} />
              {(() => {
                const linkedIds = new Set(aluno.responsaveis.map((linked) => linked.id))
                return (
                  <select name="responsavel_id" defaultValue="" style={compactSelectStyle}>
                    <option value="" style={{ color: '#111827' }}>
                      Vincular um responsável...
                    </option>
                    {responsaveisDisponiveis
                      .filter((responsavel) => !linkedIds.has(responsavel.id))
                      .map((responsavel) => (
                        <option key={responsavel.id} value={responsavel.id} style={{ color: '#111827' }}>
                          {responsavel.nome} · {responsavel.email}
                        </option>
                      ))}
                  </select>
                )
              })()}
              <button
                type="submit"
                style={getAdminButtonStyle('accent', 'solid', {
                  height: 40,
                  padding: '0 16px',
                  borderRadius: 10,
                  fontSize: 12,
                })}
              >
                Vincular responsável
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
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>
            Página {currentPage} de {totalPages} · {totalCount} alunos
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: '← Anterior', active: currentPage > 1, page: currentPage - 1 },
              { label: 'Próxima →', active: currentPage < totalPages, page: currentPage + 1 },
            ].map(({ label, active, page: pg }) => {
              const params = new URLSearchParams()
              if (q) params.set('q', q)
              if (selectedSerie) params.set('serie', selectedSerie)
              params.set('page', String(pg))
              return (
                <Link
                  key={label}
                  href={active ? `/admin/alunos?${params.toString()}` : '#'}
                  style={pagerStyle(active)}
                >
                  {label}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
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
        padding: '14px 16px',
        borderRadius: 14,
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
          letterSpacing: '.06em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, color: cfg.text, marginTop: 4 }}>{value}</div>
    </div>
  )
}

function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'warning' | 'info' | 'success'
}) {
  return <span style={getAdminPillStyle(tone, { padding: '4px 10px', fontSize: 11 })}>{children}</span>
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1.5px dashed var(--border)',
        borderRadius: 16,
        padding: '56px 20px',
        textAlign: 'center',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ fontSize: 44, marginBottom: 12, opacity: 0.6 }}>🎒</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)' }}>{title}</div>
      <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6, marginTop: 8 }}>
        {description}
      </p>
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
  tone?: 'info' | 'neutral'
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

function pagerStyle(active: boolean) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 16px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    textDecoration: 'none',
    background: '#f8fafc',
    color: active ? 'var(--text-2)' : '#94a3b8',
    border: `1px solid ${active ? '#cbd5e1' : '#e2e8f0'}`,
    pointerEvents: active ? 'auto' : 'none',
  } as const
}

const textInputStyle = {
  flex: '1 1 320px',
  height: 46,
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  padding: '0 14px',
  fontSize: 14,
  color: 'var(--text-1)',
  fontFamily: 'inherit',
  outline: 'none',
} as const

const selectStyle = {
  flex: '0 1 220px',
  height: 46,
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  padding: '0 14px',
  fontSize: 13,
  color: 'var(--text-1)',
  fontFamily: 'inherit',
  outline: 'none',
} as const

const compactSelectStyle = {
  minWidth: 260,
  height: 40,
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  padding: '0 12px',
  fontSize: 13,
  color: 'var(--text-1)',
  fontFamily: 'inherit',
  outline: 'none',
} as const
