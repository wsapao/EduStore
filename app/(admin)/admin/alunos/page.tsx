import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Responsavel } from '@/types/database'
import { desvincularAlunoResponsavelAction, vincularAlunoResponsavelAction } from '@/app/actions/admin'
import { getSeriesDisponiveis } from '@/lib/crm/series'

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
  const to   = from + PAGE_SIZE - 1

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') redirect('/loja')

  let query = supabase
    .from('alunos')
    .select(`
      id, nome, serie, turma, ativo, created_at,
      vinculos:responsavel_aluno(
        responsavel:responsaveis(id, nome, email, cpf, telefone, escola_id, created_at)
      )
    `, { count: 'exact' })
    .order('nome', { ascending: true })

  if (selectedSerie) query = query.eq('serie', selectedSerie)
  if (term) query = query.ilike('nome', `%${term}%`)

  const [{ data: rows, count: totalCount }, seriesDisponiveis] = await Promise.all([
    query.range(from, to),
    getSeriesDisponiveis()
  ])

  const { data: responsaveisRows } = await supabase
    .from('responsaveis')
    .select('id, nome, email, cpf, telefone, escola_id, created_at')
    .order('nome', { ascending: true })

  const alunos = ((rows ?? []) as unknown as AlunoAdminRow[])
    .map((row) => ({
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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#f8fafc', margin: 0, letterSpacing: '-.03em' }}>
            🎒 Alunos
          </h1>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '6px 0 0', fontWeight: 500 }}>
            Lista escolar com série, turma e responsáveis vinculados
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(110px, 1fr))', gap: 10, width: '100%', maxWidth: 400 }}>
          <MiniStat label="Alunos" value={alunos.length} tone="cyan" />
          <MiniStat label="Ativos" value={ativos} tone="emerald" />
          <MiniStat label="Sem vínculo" value={semResponsavel} tone={semResponsavel > 0 ? 'amber' : 'slate'} />
        </div>
      </div>

      {/* Filtros */}
      <form style={{
        background: 'rgba(255,255,255,.03)',
        border: '1px solid rgba(255,255,255,.06)',
        borderRadius: 16, padding: '14px 16px',
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr auto auto', gap: 10 }}>
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="Buscar por aluno ou responsável"
            style={{
              width: '100%', minWidth: 0, height: 46, borderRadius: 12,
              border: '1px solid rgba(255,255,255,.1)',
              background: 'rgba(0,0,0,.2)', padding: '0 14px',
              fontSize: 14, color: '#f8fafc', fontFamily: 'inherit',
            }}
          />
          <select
            name="serie"
            defaultValue={selectedSerie}
            style={{
              width: '100%', minWidth: 0, height: 46, borderRadius: 12,
              border: '1px solid rgba(255,255,255,.1)',
              background: 'rgba(0,0,0,.2)', padding: '0 14px',
              fontSize: 13, color: '#f8fafc', fontFamily: 'inherit',
            }}
          >
            <option value="" style={{ color: '#000' }}>Todas as séries</option>
            {seriesDisponiveis.map((option) => (
              <option key={option} value={option} style={{ color: '#000' }}>
                {option}
              </option>
            ))}
          </select>
          <button type="submit" style={btnStyle('rgba(255,255,255,.1)', '#f8fafc', '1px solid rgba(255,255,255,.1)')}>
            Filtrar
          </button>
          {(q || selectedSerie) && (
            <Link href="/admin/alunos" style={btnStyle('rgba(99,102,241,.15)', '#818cf8', '1px solid rgba(99,102,241,.3)')}>
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

      {/* Lista */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {alunos.length === 0 && (
          <EmptyState
            title="Nenhum aluno encontrado"
            description={q || selectedSerie ? 'Tente ajustar a busca ou remover o filtro de série.' : 'Ainda não há alunos cadastrados.'}
          />
        )}

        {alunos.map((aluno) => (
          <div key={aluno.id} style={{
            background: 'rgba(255,255,255,.02)',
            border: '1.5px solid rgba(255,255,255,.06)',
            borderRadius: 16, padding: 20,
            backdropFilter: 'blur(16px)',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            {/* Cabeçalho do aluno */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>{aluno.nome}</span>
                  <Badge tone={aluno.ativo ? 'info' : 'neutral'}>
                    {aluno.ativo ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                  {aluno.serie}{aluno.turma ? ` · Turma ${aluno.turma}` : ''} · cadastro em {new Date(aluno.created_at).toLocaleDateString('pt-BR')}
                </div>
              </div>
              <Badge>{aluno.responsaveis.length} responsável(is)</Badge>
            </div>

            {/* Responsáveis vinculados */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,.35)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                Responsáveis Vinculados
              </div>
              {aluno.responsaveis.length === 0 ? (
                <div style={{
                  padding: '12px 16px', borderRadius: 12,
                  background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)',
                  fontSize: 13, color: '#fca5a5', fontWeight: 600,
                }}>
                  Este aluno ainda não possui responsável vinculado.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                  {aluno.responsaveis.map((responsavel) => (
                    <form key={responsavel.id} action={desvincularAlunoResponsavelAction} style={{ margin: 0 }}>
                      <input type="hidden" name="responsavel_id" value={responsavel.id} />
                      <input type="hidden" name="aluno_id" value={aluno.id} />
                      <button type="submit" style={{
                        width: '100%', padding: '12px 14px', borderRadius: 12,
                        border: '1px solid rgba(255,255,255,.08)',
                        background: 'rgba(255,255,255,.04)', textAlign: 'left', cursor: 'pointer',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc' }}>{responsavel.nome}</div>
                          <span style={{ color: '#f87171', fontWeight: 800 }}>×</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{responsavel.email}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginTop: 6 }}>
                          {responsavel.telefone ? `Tel. ${responsavel.telefone}` : 'Sem telefone'}
                        </div>
                      </button>
                    </form>
                  ))}
                </div>
              )}
            </div>

            {/* Vincular responsável */}
            <form action={vincularAlunoResponsavelAction} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', paddingTop: 4, borderTop: '1px solid rgba(255,255,255,.05)' }}>
              <input type="hidden" name="aluno_id" value={aluno.id} />
              <select
                name="responsavel_id"
                defaultValue=""
                style={{
                  minWidth: 260, height: 40, borderRadius: 10,
                  border: '1px solid rgba(255,255,255,.1)',
                  background: 'rgba(0,0,0,.2)', padding: '0 12px',
                  fontSize: 13, color: '#f8fafc', fontFamily: 'inherit',
                }}
              >
                <option value="" style={{ color: '#000' }}>Vincular um responsável...</option>
                {responsaveisDisponiveis
                  .filter((responsavel) => !aluno.responsaveis.some((linked) => linked.id === responsavel.id))
                  .map((responsavel) => (
                    <option key={responsavel.id} value={responsavel.id} style={{ color: '#000' }}>
                      {responsavel.nome} · {responsavel.email}
                    </option>
                  ))}
              </select>
              <button type="submit" style={btnStyle('rgba(255,255,255,.1)', '#f8fafc', '1px solid rgba(255,255,255,.1)')}>
                Vincular responsável
              </button>
            </form>
          </div>
        ))}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
            Página {currentPage} de {totalPages} · {totalCount} alunos
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: '← Anterior', active: currentPage > 1, page: currentPage - 1 },
              { label: 'Próxima →',  active: currentPage < totalPages, page: currentPage + 1 },
            ].map(({ label, active, page: pg }) => {
              const params = new URLSearchParams()
              if (q) params.set('q', q)
              if (selectedSerie) params.set('serie', selectedSerie)
              params.set('page', String(pg))
              return (
                <Link
                  key={label}
                  href={active ? `/admin/alunos?${params.toString()}` : '#'}
                  style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    textDecoration: 'none',
                    background: active ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.02)',
                    color: active ? '#f8fafc' : '#475569',
                    border: `1px solid ${active ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.04)'}`,
                  }}
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

function MiniStat({ label, value, tone }: { label: string; value: number; tone: 'cyan' | 'emerald' | 'amber' | 'slate' }) {
  const tones = {
    cyan:    { bg: 'rgba(6,182,212,.1)',    border: 'rgba(6,182,212,.2)',    value: '#22d3ee' },
    emerald: { bg: 'rgba(16,185,129,.1)',   border: 'rgba(16,185,129,.2)',   value: '#34d399' },
    amber:   { bg: 'rgba(245,158,11,.1)',   border: 'rgba(245,158,11,.2)',   value: '#fbbf24' },
    slate:   { bg: 'rgba(255,255,255,.04)', border: 'rgba(255,255,255,.1)', value: '#94a3b8' },
  } as const

  return (
    <div style={{
      padding: '14px 16px', borderRadius: 14,
      border: `1px solid ${tones[tone].border}`,
      background: tones[tone].bg,
      backdropFilter: 'blur(10px)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '.06em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color: tones[tone].value, marginTop: 4 }}>{value}</div>
    </div>
  )
}

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'warning' | 'info' }) {
  const styles = {
    neutral: { color: 'rgba(255,255,255,.6)', bg: 'rgba(255,255,255,.06)',   border: 'rgba(255,255,255,.1)' },
    warning: { color: '#fbbf24',             bg: 'rgba(245,158,11,.1)',      border: 'rgba(245,158,11,.25)' },
    info:    { color: '#60a5fa',             bg: 'rgba(59,130,246,.1)',      border: 'rgba(59,130,246,.25)' },
  } as const

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 999,
      fontSize: 11, fontWeight: 700,
      color: styles[tone].color,
      background: styles[tone].bg,
      border: `1px solid ${styles[tone].border}`,
    }}>
      {children}
    </span>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,.02)',
      border: '1.5px dashed rgba(255,255,255,.1)',
      borderRadius: 16, padding: '56px 20px', textAlign: 'center',
      backdropFilter: 'blur(10px)',
    }}>
      <div style={{ fontSize: 44, marginBottom: 12, opacity: 0.5 }}>🎒</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc' }}>{title}</div>
      <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, marginTop: 8 }}>{description}</p>
    </div>
  )
}

function btnStyle(background: string, color: string, border: string) {
  return {
    height: 34, padding: '0 14px', borderRadius: 999,
    background, color, border,
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  } as const
}
