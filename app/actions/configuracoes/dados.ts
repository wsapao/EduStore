'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission, PermissionDeniedError } from '@/lib/permissoes'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { auditLog } from '@/lib/auditoria/log'
import { limparCPF, mascaraCpf } from '@/lib/validacao/cpf'

// ---------- Tipos públicos ----------

export type CsvExport = { csv: string; filename: string }
export type JsonExport = { json: string; filename: string }

export type LgpdPreview = {
  responsavel: {
    id: string
    nome: string
    email: string
    cpf: string
    telefone: string | null
  }
  alunosVinculados: Array<{ id: string; nome: string; serie: string }>
  totalPedidos: number
  totalIngressos: number
  carteirasCantina: number
}

// ---------- Constantes ----------

const EXPORT_LIMIT = 10000

// ---------- Helpers ----------

async function ensurePermissao(): Promise<{ error: string } | null> {
  try {
    await requirePermission('configuracoes.ver')
    return null
  } catch (e) {
    if (e instanceof PermissionDeniedError) return { error: 'Sem permissão.' }
    return { error: 'Sem permissão.' }
  }
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = typeof value === 'string' ? value : JSON.stringify(value)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(row.map(escapeCsv).join(','))
  }
  return lines.join('\r\n')
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

// ---------- Exportações CSV ----------

export async function exportarPedidosCsvAction(input?: {
  dataInicio?: string | null
  dataFim?: string | null
}): Promise<CsvExport | { error: string }> {
  const denied = await ensurePermissao()
  if (denied) return denied

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const admin = createAdminClient()

  let query: any = admin
    .from('pedidos')
    .select(
      '*, itens:itens_pedido(produto_id, aluno_id, variante, preco_unitario, ingresso:ingressos(token))'
    )
    .eq('escola_id', escolaId)

  if (input?.dataInicio) query = query.gte('created_at', input.dataInicio)
  if (input?.dataFim) query = query.lte('created_at', input.dataFim)

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(EXPORT_LIMIT)

  if (error) return { error: 'Erro ao exportar pedidos.' }

  const rows = (data ?? []) as Array<Record<string, any>>

  const headers = [
    'numero',
    'data_criacao',
    'status',
    'metodo_pagamento',
    'total',
    'responsavel_id',
    'total_itens',
  ]
  const linhas = rows.map((p) => [
    p.numero ?? p.id ?? '',
    p.created_at ?? '',
    p.status ?? '',
    p.metodo_pagamento ?? '',
    p.total ?? '',
    p.responsavel_id ?? '',
    Array.isArray(p.itens) ? p.itens.length : 0,
  ])

  const csv = buildCsv(headers, linhas)

  await auditLog({
    modulo: 'dados',
    acao: 'exportou_pedidos',
    metadata: {
      count: rows.length,
      dataInicio: input?.dataInicio ?? null,
      dataFim: input?.dataFim ?? null,
    },
  })

  return { csv, filename: `pedidos-${today()}.csv` }
}

export async function exportarAlunosCsvAction(): Promise<CsvExport | { error: string }> {
  const denied = await ensurePermissao()
  if (denied) return denied

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('alunos')
    .select(
      'id, nome, serie, turma, ativo, vinculos:responsavel_aluno(responsavel:responsaveis(email))'
    )
    .eq('escola_id', escolaId)
    .order('nome', { ascending: true })
    .limit(EXPORT_LIMIT)

  if (error) return { error: 'Erro ao exportar alunos.' }

  const rows = (data ?? []) as Array<Record<string, any>>

  const headers = ['id', 'nome', 'serie', 'turma', 'ativo', 'responsaveis_emails']
  const linhas = rows.map((a) => {
    const emails: string[] = Array.isArray(a.vinculos)
      ? a.vinculos
          .map((v: any) => v?.responsavel?.email)
          .filter((e: any): e is string => typeof e === 'string' && e.length > 0)
      : []
    return [
      a.id ?? '',
      a.nome ?? '',
      a.serie ?? '',
      a.turma ?? '',
      a.ativo === false ? 'false' : 'true',
      emails.join('; '),
    ]
  })

  const csv = buildCsv(headers, linhas)

  await auditLog({
    modulo: 'dados',
    acao: 'exportou_alunos',
    metadata: { count: rows.length },
  })

  return { csv, filename: `alunos-${today()}.csv` }
}

export async function exportarResponsaveisCsvAction(): Promise<
  CsvExport | { error: string }
> {
  const denied = await ensurePermissao()
  if (denied) return denied

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('responsaveis')
    .select('id, nome, email, cpf, telefone, ativo, excluido_em, created_at')
    .eq('escola_id', escolaId)
    .order('nome', { ascending: true })
    .limit(EXPORT_LIMIT)

  if (error) return { error: 'Erro ao exportar responsáveis.' }

  const rows = (data ?? []) as Array<Record<string, any>>

  const headers = ['id', 'nome', 'email', 'cpf', 'telefone', 'ativo', 'excluido_em', 'created_at']
  const linhas = rows.map((r) => [
    r.id ?? '',
    r.nome ?? '',
    r.email ?? '',
    r.cpf ?? '',
    r.telefone ?? '',
    r.ativo === false ? 'false' : 'true',
    r.excluido_em ?? '',
    r.created_at ?? '',
  ])

  const csv = buildCsv(headers, linhas)

  await auditLog({
    modulo: 'dados',
    acao: 'exportou_responsaveis',
    metadata: { count: rows.length },
  })

  return { csv, filename: `responsaveis-${today()}.csv` }
}

// ---------- LGPD por CPF ----------

async function buscarResponsavelPorCpf(
  admin: ReturnType<typeof createAdminClient>,
  escolaId: string,
  cpf: string
): Promise<{ id: string; nome: string; email: string; cpf: string; telefone: string | null } | null> {
  const { data, error } = await admin
    .from('responsaveis')
    .select('id, nome, email, cpf, telefone')
    .eq('escola_id', escolaId)
    .eq('cpf', cpf)
    .maybeSingle()

  if (error || !data) return null
  return data as any
}

export async function previewExclusaoLgpdAction(
  cpfInput: string
): Promise<{ preview: LgpdPreview } | { error: string }> {
  const denied = await ensurePermissao()
  if (denied) return denied

  const cpf = limparCPF(cpfInput)
  if (cpf.length !== 11) return { error: 'CPF inválido.' }

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const admin = createAdminClient()
  const responsavel = await buscarResponsavelPorCpf(admin, escolaId, cpf)
  if (!responsavel) return { error: 'CPF não encontrado nesta escola.' }

  const { data: vinculos } = await admin
    .from('responsavel_aluno')
    .select('aluno:alunos(id, nome, serie)')
    .eq('responsavel_id', responsavel.id)

  const alunosVinculados: Array<{ id: string; nome: string; serie: string }> = Array.isArray(
    vinculos
  )
    ? (vinculos as any[])
        .map((v) => v?.aluno)
        .filter((a: any) => a && a.id)
        .map((a: any) => ({ id: a.id, nome: a.nome ?? '', serie: a.serie ?? '' }))
    : []

  const alunoIds = alunosVinculados.map((a) => a.id)

  const [{ count: pedidosCount }, { count: ingressosCount }, carteiraCount] = await Promise.all([
    admin
      .from('pedidos')
      .select('id', { count: 'exact', head: true })
      .eq('responsavel_id', responsavel.id),
    admin
      .from('ingressos')
      .select('id', { count: 'exact', head: true })
      .eq('responsavel_id', responsavel.id),
    alunoIds.length === 0
      ? Promise.resolve({ count: 0 })
      : admin
          .from('cantina_carteiras')
          .select('id', { count: 'exact', head: true })
          .in('aluno_id', alunoIds),
  ])

  return {
    preview: {
      responsavel,
      alunosVinculados,
      totalPedidos: pedidosCount ?? 0,
      totalIngressos: ingressosCount ?? 0,
      carteirasCantina: (carteiraCount as any).count ?? 0,
    },
  }
}

export async function executarExclusaoLgpdAction(input: {
  cpf: string
  senhaConfirmacao: string
}): Promise<{ success: true } | { error: string }> {
  const denied = await ensurePermissao()
  if (denied) return denied

  const cpf = limparCPF(input.cpf)
  if (cpf.length !== 11) return { error: 'CPF inválido.' }
  if (!input.senhaConfirmacao) return { error: 'Informe sua senha de admin para confirmar.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) return { error: 'Sessão inválida — refaça login.' }

  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  // Re-autentica admin para confirmar a operação destrutiva
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: input.senhaConfirmacao,
  })
  if (authErr) return { error: 'Senha incorreta.' }

  const admin = createAdminClient()
  const responsavel = await buscarResponsavelPorCpf(admin, escolaId, cpf)
  if (!responsavel) return { error: 'CPF não encontrado nesta escola.' }

  const anonEmail = `anon+${responsavel.id}@lgpd.local`
  const anonNome = 'Usuário removido'
  const anonCpf = `ANON-${responsavel.id.slice(0, 8)}`

  const { error: updErr } = await admin
    .from('responsaveis')
    .update({
      nome: anonNome,
      email: anonEmail,
      cpf: anonCpf,
      telefone: null,
      ativo: false,
      excluido_em: new Date().toISOString(),
    })
    .eq('id', responsavel.id)

  if (updErr) return { error: 'Não foi possível anonimizar o responsável.' }

  // Invalida sessões do auth (best-effort — não falha a action se errar)
  try {
    await admin.auth.admin.deleteUser(responsavel.id)
  } catch {
    // ignorado
  }

  await auditLog({
    modulo: 'dados',
    acao: 'lgpd_excluido',
    descricao: mascaraCpf(cpf),
    metadata: { responsavelId: responsavel.id },
  })

  return { success: true }
}

export async function exportarPortabilidadeLgpdAction(
  cpfInput: string
): Promise<JsonExport | { error: string }> {
  const denied = await ensurePermissao()
  if (denied) return denied

  const cpf = limparCPF(cpfInput)
  if (cpf.length !== 11) return { error: 'CPF inválido.' }

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const admin = createAdminClient()
  const responsavel = await buscarResponsavelPorCpf(admin, escolaId, cpf)
  if (!responsavel) return { error: 'CPF não encontrado nesta escola.' }

  const [
    { data: responsavelFull },
    { data: vinculos },
    { data: pedidos },
    { data: ingressos },
  ] = await Promise.all([
    admin.from('responsaveis').select('*').eq('id', responsavel.id).maybeSingle(),
    admin
      .from('responsavel_aluno')
      .select('aluno:alunos(*)')
      .eq('responsavel_id', responsavel.id),
    admin
      .from('pedidos')
      .select('*, itens:itens_pedido(*)')
      .eq('responsavel_id', responsavel.id),
    admin.from('ingressos').select('*').eq('responsavel_id', responsavel.id),
  ])

  const alunos: any[] = Array.isArray(vinculos)
    ? (vinculos as any[]).map((v) => v?.aluno).filter(Boolean)
    : []
  const alunoIds = alunos.map((a) => a.id).filter(Boolean)

  const { data: carteiras } =
    alunoIds.length > 0
      ? await admin
          .from('cantina_carteiras')
          .select('*, movimentacoes:cantina_movimentacoes(*)')
          .in('aluno_id', alunoIds)
      : { data: [] as any[] }

  const payload = {
    exportado_em: new Date().toISOString(),
    lgpd: {
      lei: 'Lei Geral de Proteção de Dados (Lei 13.709/2018)',
      direito_exercido: 'art. 18, V — portabilidade dos dados',
      origem: 'admin',
    },
    responsavel: responsavelFull ?? responsavel,
    alunos,
    pedidos: pedidos ?? [],
    ingressos: ingressos ?? [],
    carteiras_cantina: carteiras ?? [],
  }

  const json = JSON.stringify(payload, null, 2)

  await auditLog({
    modulo: 'dados',
    acao: 'lgpd_portabilidade',
    descricao: mascaraCpf(cpf),
    metadata: { responsavelId: responsavel.id },
  })

  return {
    json,
    filename: `lgpd-portabilidade-${cpf.slice(0, 3)}xxx${cpf.slice(9)}-${today()}.json`,
  }
}
