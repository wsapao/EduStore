import { createClient } from '@/lib/supabase/server'

function escapeCsv(value: string | null | undefined) {
  const normalized = value ?? ''
  return `"${normalized.replace(/"/g, '""')}"`
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'admin') {
    return new Response('Acesso negado.', { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim().toLocaleLowerCase('pt-BR') ?? ''

  const { data: rows } = await supabase
    .from('responsaveis')
    .select(`
      nome, email, cpf, telefone, created_at,
      vinculos:responsavel_aluno(
        aluno:alunos(nome, serie, turma, ativo)
      )
    `)
    .order('created_at', { ascending: false })

  const filtered = (rows ?? []).filter((row) => {
    if (!q) return true
    const alunos = (row.vinculos ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((vinculo: any) => Array.isArray(vinculo.aluno) ? vinculo.aluno[0] : vinculo.aluno)
      .filter(Boolean)

    const haystack = [
      row.nome,
      row.email,
      row.cpf,
      row.telefone ?? '',
      ...alunos.map((aluno: { nome: string; serie: string; turma: string | null }) => `${aluno.nome} ${aluno.serie} ${aluno.turma ?? ''}`),
    ].join(' ').toLocaleLowerCase('pt-BR')

    return haystack.includes(q)
  })

  const header = ['nome', 'email', 'cpf', 'telefone', 'cadastro_em', 'alunos']
  const lines = filtered.map((row) => {
    const alunos = (row.vinculos ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((vinculo: any) => Array.isArray(vinculo.aluno) ? vinculo.aluno[0] : vinculo.aluno)
      .filter(Boolean)
      .map((aluno: { nome: string; serie: string; turma: string | null; ativo: boolean }) =>
        `${aluno.nome} (${aluno.serie}${aluno.turma ? `/${aluno.turma}` : ''}${aluno.ativo ? '' : ' - inativo'})`
      )
      .join(' | ')

    return [
      escapeCsv(row.nome),
      escapeCsv(row.email),
      escapeCsv(row.cpf),
      escapeCsv(row.telefone),
      escapeCsv(new Date(row.created_at).toLocaleDateString('pt-BR')),
      escapeCsv(alunos),
    ].join(',')
  })

  const csv = [header.join(','), ...lines].join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="responsaveis.csv"',
      'Cache-Control': 'no-store',
    },
  })
}
