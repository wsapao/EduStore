import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Aluno } from '@/types/database'
import { desvincularAlunoResponsavelAction, resetSenhaResponsavelAction, vincularAlunoResponsavelAction } from '@/app/actions/admin'

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
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
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
  const to   = from + PAGE_SIZE - 1

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') redirect('/loja')

  let query = supabase
    .from('responsaveis')
    .select(`
      id, nome, email, cpf, telefone, created_at,
      vinculos:responsavel_aluno(
        aluno:alunos(id, nome, serie, turma, ativo, escola_id, created_at)
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })

  if (term) {
    query = query.or(`nome.ilike.%${term}%,email.ilike.%${term}%,cpf.ilike.%${term}%`)
  }

  const { data: rows, count: totalCount } = await query.range(from, to)

  const { data: alunosRows } = await supabase
    .from('alunos')
    .select('id, nome, serie, turma, ativo, escola_id, created_at')
    .order('nome', { ascending: true })

  const responsaveis = ((rows ?? []) as unknown as ResponsavelRow[])
    .map((row) => ({
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
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#f8fafc', margin: 0, letterSpacing: '-.03em' }}>
            Responsáveis
          </h1>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '6px 0 0', fontWeight: 500 }}>
            Base de contatos das famílias e alunos vinculados
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))', gap: 12, width: '100%', maxWidth: 460 }}>
          <MiniStat label="Famílias" value={totalCount ?? 0} tone="indigo" />
          <MiniStat label="Alunos ligados" value={totalAlunosVinculados} tone="cyan" />
          <MiniStat label="Sem telefone" value={semTelefone} tone={semTelefone > 0 ? 'amber' : 'slate'} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Link href={q ? `/admin/responsaveis/export?q=${encodeURIComponent(q)}` : '/admin/responsaveis/export'} style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, height: 42, padding: '0 20px', borderRadius: 14,
          background: 'rgba(255,255,255,0.05)', color: '#f8fafc', fontSize: 13, fontWeight: 800, textDecoration: 'none',
          border: '1px solid rgba(255,255,255,0.1)', transition: 'all .2s'
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Exportar CSV
        </Link>
      </div>

      {/* SEARCH BAR */}
      <form style={{
        background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 16, padding: '16px',
        display: 'flex', flexDirection: 'column', gap: 14, backdropFilter: 'blur(10px)'
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap'
        }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
            <svg style={{ position: 'absolute', left: 14, top: 12, color: '#64748b' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              name="q"
              defaultValue={q ?? ''}
              placeholder="Buscar por nome, email, CPF, telefone ou aluno..."
              style={{
                width: '100%', height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,.1)',
                background: 'rgba(0,0,0,.2)', padding: '0 14px 0 40px', fontSize: 14, color: '#f8fafc', fontFamily: 'inherit',
                outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>
          <button type="submit" style={actionButton('rgba(255,255,255,.1)', '#f8fafc', '1px solid rgba(255,255,255,.05)')}>
            Buscar
          </button>
          {q && (
            <Link href="/admin/responsaveis" style={actionButton('rgba(239,68,68,.1)', '#fca5a5', '1px solid rgba(239,68,68,.2)')}>
              Limpar
            </Link>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <FilterBadge>{responsaveis.length} responsáveis</FilterBadge>
          <FilterBadge>{totalAlunosVinculados} vínculos ativos</FilterBadge>
          <FilterBadge tone={semAlunos > 0 ? 'danger' : 'neutral'}>{semAlunos} sem alunos</FilterBadge>
        </div>
      </form>

      {/* LISTA */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {responsaveis.length === 0 && (
          <EmptyState
            title="Nenhum responsável encontrado"
            description={q ? `Nenhum resultado para "${q}".` : 'Ainda não há responsáveis cadastrados.'}
          />
        )}

        {responsaveis.map((responsavel) => (
          <div key={responsavel.id} style={{
            background: 'rgba(255,255,255,.02)', border: '1.5px solid rgba(255,255,255,.06)', borderRadius: 20, padding: 20,
            display: 'flex', flexDirection: 'column', gap: 16, backdropFilter: 'blur(16px)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 16, fontWeight: 900, border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  {initials(responsavel.nome)}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#f8fafc', letterSpacing: '-.02em' }}>{responsavel.nome}</div>
                  <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2, fontWeight: 500 }}>
                    {responsavel.email}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <FilterBadge tone="neutral">{responsavel.alunos.length} aluno(s)</FilterBadge>
                {!responsavel.telefone && <FilterBadge tone="warning">Sem telefone</FilterBadge>}
                <form action={resetSenhaResponsavelAction}>
                  <input type="hidden" name="responsavel_id" value={responsavel.id} />
                  <button type="submit" style={actionButton('rgba(59,130,246,.15)', '#60a5fa', '1px solid rgba(59,130,246,.3)')}>
                    Enviar reset de senha
                  </button>
                </form>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <InfoCard label="CPF" value={maskCPF(responsavel.cpf)} />
              <InfoCard label="Telefone" value={maskPhone(responsavel.telefone)} />
              <InfoCard label="Cadastro" value={new Date(responsavel.created_at).toLocaleDateString('pt-BR')} />
            </div>

            <div style={{ marginTop: 4, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12 }}>
                ALUNOS VINCULADOS
              </div>
              {responsavel.alunos.length === 0 ? (
                <div style={{
                  padding: '14px 16px', borderRadius: 12, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.2)',
                  fontSize: 13, color: '#fcd34d', fontWeight: 600,
                }}>
                  Este responsável ainda não tem aluno vinculado.
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {responsavel.alunos.map((aluno) => (
                    <form key={aluno.id} action={desvincularAlunoResponsavelAction} style={{ margin: 0 }}>
                      <input type="hidden" name="responsavel_id" value={responsavel.id} />
                      <input type="hidden" name="aluno_id" value={aluno.id} />
                      <button type="submit" style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '8px 12px', borderRadius: 999, background: aluno.ativo ? 'rgba(59,130,246,.1)' : 'rgba(255,255,255,.05)',
                        color: aluno.ativo ? '#93c5fd' : '#94a3b8',
                        border: `1px solid ${aluno.ativo ? 'rgba(59,130,246,.2)' : 'rgba(255,255,255,.1)'}`,
                        fontSize: 12, fontWeight: 800, cursor: 'pointer', transition: 'all .2s'
                      }}>
                        <span>{aluno.nome}</span>
                        <span style={{ opacity: 0.7 }}>
                          {aluno.serie}{aluno.turma ? ` · ${aluno.turma}` : ''}
                        </span>
                        <span style={{ color: '#fca5a5', fontWeight: 900, marginLeft: 4 }}>×</span>
                      </button>
                    </form>
                  ))}
                </div>
              )}
            </div>

            <form action={vincularAlunoResponsavelAction} style={{
              display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
              paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)'
            }}>
              <input type="hidden" name="responsavel_id" value={responsavel.id} />
              <select
                name="aluno_id"
                defaultValue=""
                style={{
                  minWidth: 260, height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,.1)',
                  background: 'rgba(0,0,0,.2)', padding: '0 14px', fontSize: 13, color: '#f8fafc', fontFamily: 'inherit',
                  outline: 'none'
                }}
              >
                <option value="" style={{ color: '#000' }}>Vincular um aluno...</option>
                {alunosDisponiveis
                  .filter((aluno) => !responsavel.alunos.some((linked) => linked.id === aluno.id))
                  .map((aluno) => (
                    <option key={aluno.id} value={aluno.id} style={{ color: '#000' }}>
                      {aluno.nome} · {aluno.serie}{aluno.turma ? ` · ${aluno.turma}` : ''}
                    </option>
                  ))}
              </select>
              <button type="submit" style={actionButton('rgba(255,255,255,.1)', '#f8fafc', '1px solid rgba(255,255,255,.05)')}>
                Vincular aluno
              </button>
            </form>
          </div>
        ))}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexWrap: 'wrap', padding: '10px 0'
        }}>
          <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 700 }}>
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
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    height: 40, padding: '0 16px', borderRadius: 10, fontSize: 13, fontWeight: 800,
    textDecoration: 'none', transition: 'all .2s',
    background: active ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.02)',
    color: active ? '#f8fafc' : '#475569',
    border: active ? '1px solid rgba(255,255,255,.15)' : '1px solid rgba(255,255,255,.05)',
    pointerEvents: active ? 'auto' : 'none',
  } as const
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: 'indigo' | 'cyan' | 'amber' | 'slate' }) {
  const tones = {
    indigo: { bg: 'rgba(59,130,246,.1)', border: 'rgba(59,130,246,.2)', value: '#60a5fa' },
    cyan: { bg: 'rgba(6,182,212,.1)', border: 'rgba(6,182,212,.2)', value: '#22d3ee' },
    amber: { bg: 'rgba(245,158,11,.1)', border: 'rgba(245,158,11,.2)', value: '#fbbf24' },
    slate: { bg: 'rgba(255,255,255,.05)', border: 'rgba(255,255,255,.1)', value: '#f8fafc' },
  } as const

  return (
    <div style={{ padding: '16px', borderRadius: 16, border: `1px solid ${tones[tone].border}`, background: tones[tone].bg, backdropFilter: 'blur(10px)' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '.05em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: tones[tone].value, marginTop: 4, letterSpacing: '-.02em' }}>{value}</div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,.05)', background: 'rgba(0,0,0,.15)' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '.05em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc', marginTop: 6 }}>{value}</div>
    </div>
  )
}

function FilterBadge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'warning' | 'danger' }) {
  const styles = {
    neutral: { color: '#94a3b8', bg: 'rgba(255,255,255,.05)', border: 'rgba(255,255,255,.1)' },
    warning: { color: '#fbbf24', bg: 'rgba(245,158,11,.1)', border: 'rgba(245,158,11,.2)' },
    danger: { color: '#fca5a5', bg: 'rgba(239,68,68,.1)', border: 'rgba(239,68,68,.2)' },
  } as const

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '6px 12px', borderRadius: 999,
      fontSize: 11, fontWeight: 800, color: styles[tone].color, background: styles[tone].bg,
      border: `1px solid ${styles[tone].border}`, textTransform: 'uppercase', letterSpacing: '.05em'
    }}>
      {children}
    </span>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,.02)', border: '1.5px dashed rgba(255,255,255,.1)', borderRadius: 20, padding: '70px 20px', textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center'
    }}>
      <div style={{ fontSize: 44, marginBottom: 16, opacity: 0.5 }}>👥</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: '#f8fafc', letterSpacing: '-.02em' }}>{title}</div>
      <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6, marginTop: 8, maxWidth: 300 }}>{description}</p>
    </div>
  )
}

function actionButton(background: string, color: string, border: string) {
  return {
    height: 44,
    padding: '0 20px',
    borderRadius: 12,
    background,
    color,
    border,
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all .2s'
  } as const
}
