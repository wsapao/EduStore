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

  // Busca com paginação — filtro por nome/email/cpf via ilike no servidor
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 80 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-.02em' }}>
            Responsáveis
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
            Base de contatos das famílias e alunos vinculados
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))', gap: 10, width: '100%', maxWidth: 430 }}>
          <MiniStat label="Famílias" value={totalCount ?? 0} tone="indigo" />
          <MiniStat label="Alunos ligados" value={totalAlunosVinculados} tone="cyan" />
          <MiniStat label="Sem telefone" value={semTelefone} tone={semTelefone > 0 ? 'amber' : 'slate'} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Link href={q ? `/admin/responsaveis/export?q=${encodeURIComponent(q)}` : '/admin/responsaveis/export'} style={actionButton('#0f172a', '#fff', 'none')}>
          Exportar CSV
        </Link>
      </div>

      <form style={{
        background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 14, padding: 14,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, minHeight: 48,
          borderRadius: 12, border: '1.5px solid #e2e8f0', background: '#f8fafc', padding: '0 14px',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="Buscar por nome, email, CPF, telefone ou aluno"
            style={{
              flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 14, fontFamily: 'inherit', color: '#0f172a',
            }}
          />
          <button type="submit" style={actionButton('#0f172a', '#fff', 'none')}>
            Buscar
          </button>
          {q && (
            <Link href="/admin/responsaveis" style={actionButton('#eef2ff', '#4338ca', '1px solid #c7d2fe')}>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {responsaveis.length === 0 && (
          <EmptyState
            title="Nenhum responsável encontrado"
            description={q ? `Nenhum resultado para "${q}".` : 'Ainda não há responsáveis cadastrados.'}
          />
        )}

        {responsaveis.map((responsavel) => (
          <div key={responsavel.id} style={{
            background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 14, padding: 18,
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: '50%',
                  background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 13, fontWeight: 800,
                }}>
                  {initials(responsavel.nome)}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{responsavel.nome}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    {responsavel.email}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <FilterBadge tone="neutral">{responsavel.alunos.length} aluno(s)</FilterBadge>
                {!responsavel.telefone && <FilterBadge tone="warning">Sem telefone</FilterBadge>}
                <form action={resetSenhaResponsavelAction}>
                  <input type="hidden" name="responsavel_id" value={responsavel.id} />
                  <button type="submit" style={actionButton('#eff6ff', '#1d4ed8', '1px solid #bfdbfe')}>
                    Enviar reset de senha
                  </button>
                </form>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <InfoCard label="CPF" value={maskCPF(responsavel.cpf)} />
              <InfoCard label="Telefone" value={maskPhone(responsavel.telefone)} />
              <InfoCard label="Cadastro" value={new Date(responsavel.created_at).toLocaleDateString('pt-BR')} />
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '.06em', marginBottom: 8 }}>
                ALUNOS VINCULADOS
              </div>
              {responsavel.alunos.length === 0 ? (
                <div style={{
                  padding: '12px 14px', borderRadius: 12, background: '#fff7ed', border: '1px solid #fdba74',
                  fontSize: 13, color: '#9a3412', fontWeight: 600,
                }}>
                  Este responsável ainda não tem aluno vinculado.
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {responsavel.alunos.map((aluno) => (
                    <form key={aluno.id} action={desvincularAlunoResponsavelAction} style={{ margin: 0 }}>
                      <input type="hidden" name="responsavel_id" value={responsavel.id} />
                      <input type="hidden" name="aluno_id" value={aluno.id} />
                      <button type="submit" style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '8px 10px', borderRadius: 999, background: aluno.ativo ? '#eff6ff' : '#f3f4f6',
                        color: aluno.ativo ? '#1d4ed8' : '#6b7280',
                        border: `1px solid ${aluno.ativo ? '#bfdbfe' : '#d1d5db'}`,
                        fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      }}>
                        <span>{aluno.nome}</span>
                        <span style={{ opacity: 0.85 }}>
                          {aluno.serie}{aluno.turma ? ` · ${aluno.turma}` : ''}
                        </span>
                        <span style={{ color: '#b91c1c', fontWeight: 800 }}>×</span>
                      </button>
                    </form>
                  ))}
                </div>
              )}
            </div>

            <form action={vincularAlunoResponsavelAction} style={{
              display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
              paddingTop: 2,
            }}>
              <input type="hidden" name="responsavel_id" value={responsavel.id} />
              <select
                name="aluno_id"
                defaultValue=""
                style={{
                  minWidth: 240, height: 40, borderRadius: 10, border: '1.5px solid #e2e8f0',
                  background: '#f8fafc', padding: '0 12px', fontSize: 13, color: '#0f172a', fontFamily: 'inherit',
                }}
              >
                <option value="">Vincular um aluno...</option>
                {alunosDisponiveis
                  .filter((aluno) => !responsavel.alunos.some((linked) => linked.id === aluno.id))
                  .map((aluno) => (
                    <option key={aluno.id} value={aluno.id}>
                      {aluno.nome} · {aluno.serie}{aluno.turma ? ` · ${aluno.turma}` : ''}
                    </option>
                  ))}
              </select>
              <button type="submit" style={actionButton('#0f172a', '#fff', 'none')}>
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
          gap: 12, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
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
    display: 'inline-flex', alignItems: 'center',
    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    textDecoration: 'none',
    background: active ? '#fff' : '#f8fafc',
    color: active ? '#0f172a' : '#cbd5e1',
    border: `1.5px solid ${active ? '#e2e8f0' : '#f1f5f9'}`,
    cursor: active ? 'pointer' : 'default',
  } as const
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: 'indigo' | 'cyan' | 'amber' | 'slate' }) {
  const tones = {
    indigo: { bg: '#eef2ff', border: '#c7d2fe', value: '#4338ca' },
    cyan: { bg: '#ecfeff', border: '#a5f3fc', value: '#0e7490' },
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

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '.05em' }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{value}</div>
    </div>
  )
}

function FilterBadge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'warning' | 'danger' }) {
  const styles = {
    neutral: { color: '#475569', bg: '#f8fafc', border: '#e2e8f0' },
    warning: { color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
    danger: { color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
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
      <div style={{ fontSize: 44, marginBottom: 12, opacity: 0.45 }}>👥</div>
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
