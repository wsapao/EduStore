import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Responsavel } from '@/types/database'
import { desvincularAlunoResponsavelAction, vincularAlunoResponsavelAction } from '@/app/actions/admin'

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

const SERIES_OPTIONS = [
  'Berçário I', 'Berçário II', 'Maternal I', 'Maternal II', 'Jardim I', 'Jardim II',
  '1º ano EF', '2º ano EF', '3º ano EF', '4º ano EF', '5º ano EF',
  '6º ano EF', '7º ano EF', '8º ano EF', '9º ano EF',
  '1º ano EM', '2º ano EM', '3º ano EM',
]

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

  const { data: rows, count: totalCount } = await query.range(from, to)

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
  const porSerie = alunos.reduce<Record<string, number>>((acc, row) => {
    acc[row.serie] = (acc[row.serie] ?? 0) + 1
    return acc
  }, {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 80 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-.02em' }}>
            Alunos
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
            Lista escolar com série, turma e responsáveis vinculados
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))', gap: 10, width: '100%', maxWidth: 430 }}>
          <MiniStat label="Alunos" value={alunos.length} tone="cyan" />
          <MiniStat label="Ativos" value={ativos} tone="emerald" />
          <MiniStat label="Sem responsável" value={semResponsavel} tone={semResponsavel > 0 ? 'amber' : 'slate'} />
        </div>
      </div>

      <form style={{
        background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 14, padding: 14,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr auto auto', gap: 10 }}>
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="Buscar por aluno ou responsável"
            style={{
              width: '100%', minWidth: 0, height: 46, borderRadius: 12, border: '1.5px solid #e2e8f0',
              background: '#f8fafc', padding: '0 14px', fontSize: 14, color: '#0f172a', fontFamily: 'inherit',
            }}
          />
          <select
            name="serie"
            defaultValue={selectedSerie}
            style={{
              width: '100%', minWidth: 0, height: 46, borderRadius: 12, border: '1.5px solid #e2e8f0',
              background: '#f8fafc', padding: '0 14px', fontSize: 13, color: '#0f172a', fontFamily: 'inherit',
            }}
          >
            <option value="">Todas as séries</option>
            {SERIES_OPTIONS.filter((option) => porSerie[option]).map((option) => (
              <option key={option} value={option}>
                {option} ({porSerie[option]})
              </option>
            ))}
          </select>
          <button type="submit" style={actionButton('#0f172a', '#fff', 'none')}>
            Filtrar
          </button>
          {(q || selectedSerie) && (
            <Link href="/admin/alunos" style={actionButton('#eef2ff', '#4338ca', '1px solid #c7d2fe')}>
              Limpar
            </Link>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <FilterBadge>{alunos.length} alunos</FilterBadge>
          {selectedSerie && <FilterBadge tone="info">{selectedSerie}</FilterBadge>}
          <FilterBadge tone={semResponsavel > 0 ? 'warning' : 'neutral'}>{semResponsavel} sem vínculo</FilterBadge>
        </div>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {alunos.length === 0 && (
          <EmptyState
            title="Nenhum aluno encontrado"
            description={q || selectedSerie ? 'Tente ajustar a busca ou remover o filtro de série.' : 'Ainda não há alunos cadastrados.'}
          />
        )}

        {alunos.map((aluno) => (
          <div key={aluno.id} style={{
            background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 14, padding: 18,
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{aluno.nome}</span>
                  <FilterBadge tone={aluno.ativo ? 'info' : 'neutral'}>
                    {aluno.ativo ? 'Ativo' : 'Inativo'}
                  </FilterBadge>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  {aluno.serie}{aluno.turma ? ` · Turma ${aluno.turma}` : ''} · cadastro em {new Date(aluno.created_at).toLocaleDateString('pt-BR')}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <FilterBadge>{aluno.responsaveis.length} responsável(is)</FilterBadge>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '.06em', marginBottom: 8 }}>
                RESPONSÁVEIS VINCULADOS
              </div>
              {aluno.responsaveis.length === 0 ? (
                <div style={{
                  padding: '12px 14px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca',
                  fontSize: 13, color: '#b91c1c', fontWeight: 600,
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
                        width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #e2e8f0',
                        background: '#f8fafc', textAlign: 'left', cursor: 'pointer',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{responsavel.nome}</div>
                          <span style={{ color: '#b91c1c', fontWeight: 800 }}>×</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{responsavel.email}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                          {responsavel.telefone ? `Tel. ${responsavel.telefone}` : 'Sem telefone'}
                        </div>
                      </button>
                    </form>
                  ))}
                </div>
              )}
            </div>

            <form action={vincularAlunoResponsavelAction} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="hidden" name="aluno_id" value={aluno.id} />
              <select
                name="responsavel_id"
                defaultValue=""
                style={{
                  minWidth: 260, height: 40, borderRadius: 10, border: '1.5px solid #e2e8f0',
                  background: '#f8fafc', padding: '0 12px', fontSize: 13, color: '#0f172a', fontFamily: 'inherit',
                }}
              >
                <option value="">Vincular um responsável...</option>
                {responsaveisDisponiveis
                  .filter((responsavel) => !aluno.responsaveis.some((linked) => linked.id === responsavel.id))
                  .map((responsavel) => (
                    <option key={responsavel.id} value={responsavel.id}>
                      {responsavel.nome} · {responsavel.email}
                    </option>
                  ))}
              </select>
              <button type="submit" style={actionButton('#0f172a', '#fff', 'none')}>
                Vincular responsável
              </button>
            </form>
          </div>
        ))}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
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
                  style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    textDecoration: 'none',
                    background: active ? '#fff' : '#f8fafc',
                    color: active ? '#0f172a' : '#cbd5e1',
                    border: `1.5px solid ${active ? '#e2e8f0' : '#f1f5f9'}`,
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
    cyan: { bg: '#ecfeff', border: '#a5f3fc', value: '#0e7490' },
    emerald: { bg: '#ecfdf5', border: '#bbf7d0', value: '#047857' },
    amber: { bg: '#fffbeb', border: '#fde68a', value: '#b45309' },
    slate: { bg: '#f8fafc', border: '#e2e8f0', value: '#334155' },
  } as const

  return (
    <div style={{ padding: '12px 14px', borderRadius: 14, border: `1.5px solid ${tones[tone].border}`, background: tones[tone].bg }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '.05em' }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: tones[tone].value, marginTop: 4 }}>{value}</div>
    </div>
  )
}

function FilterBadge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'warning' | 'info' }) {
  const styles = {
    neutral: { color: '#475569', bg: '#f8fafc', border: '#e2e8f0' },
    warning: { color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
    info: { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  } as const

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '5px 9px', borderRadius: 999,
      fontSize: 11, fontWeight: 700, color: styles[tone].color, background: styles[tone].bg,
      border: `1px solid ${styles[tone].border}`,
    }}>
      {children}
    </span>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div style={{
      background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 14, padding: '56px 20px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 44, marginBottom: 12, opacity: 0.45 }}>🎒</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{title}</div>
      <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, marginTop: 8 }}>{description}</p>
    </div>
  )
}

function actionButton(background: string, color: string, border: string) {
  return {
    height: 34,
    padding: '0 12px',
    borderRadius: 999,
    background,
    color,
    border,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } as const
}
