'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission, PermissionDeniedError } from '@/lib/permissoes'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'

export type AuditFiltro = {
  userId?: string | null
  modulo?: string | null
  dataInicio?: string | null // ISO
  dataFim?: string | null    // ISO
  limit?: number             // default 100, max 500
}

export type AuditEntry = {
  id: string
  user_id: string | null
  user_email: string | null
  modulo: string
  acao: string
  descricao: string | null
  metadata: Record<string, unknown> | null
  ip: string | null
  created_at: string
}

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500
const EXPORT_LIMIT = 5000

type AuditRow = {
  id: string
  user_id: string | null
  modulo: string
  acao: string
  descricao: string | null
  metadata: Record<string, unknown> | null
  ip: string | null
  created_at: string
}

async function ensurePermissao(): Promise<{ error: string } | null> {
  try {
    await requirePermission('configuracoes.ver')
    return null
  } catch (e) {
    if (e instanceof PermissionDeniedError) return { error: 'Sem permissão.' }
    return { error: 'Sem permissão.' }
  }
}

async function buscarLinhas(
  filtro: AuditFiltro,
  limit: number
): Promise<{ rows: AuditRow[] } | { error: string }> {
  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  let query: any = supabase
    .from('auditoria_log')
    .select('id, user_id, modulo, acao, descricao, metadata, ip, created_at')
    .eq('escola_id', escolaId)

  if (filtro.userId) query = query.eq('user_id', filtro.userId)
  if (filtro.modulo) query = query.eq('modulo', filtro.modulo)
  if (filtro.dataInicio) query = query.gte('created_at', filtro.dataInicio)
  if (filtro.dataFim) query = query.lte('created_at', filtro.dataFim)

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) return { error: 'Erro ao buscar registros de auditoria.' }

  return { rows: (data ?? []) as AuditRow[] }
}

async function resolverEmails(rows: AuditRow[]): Promise<Map<string, string | null>> {
  const cache = new Map<string, string | null>()
  const ids = Array.from(new Set(rows.map((r) => r.user_id).filter((v): v is string => !!v)))
  if (ids.length === 0) return cache

  let admin: ReturnType<typeof createAdminClient> | null = null
  try {
    admin = createAdminClient()
  } catch {
    // sem service role — devolvemos cache vazio
    return cache
  }

  await Promise.all(
    ids.map(async (id) => {
      try {
        const res = await admin!.auth.admin.getUserById(id)
        cache.set(id, res?.data?.user?.email ?? null)
      } catch {
        cache.set(id, null)
      }
    })
  )

  return cache
}

export async function listarAuditoriaAction(
  filtro: AuditFiltro = {}
): Promise<{ entries: AuditEntry[] } | { error: string }> {
  const denied = await ensurePermissao()
  if (denied) return denied

  const limit = Math.min(Math.max(1, filtro.limit ?? DEFAULT_LIMIT), MAX_LIMIT)
  const result = await buscarLinhas(filtro, limit)
  if ('error' in result) return result

  const emails = await resolverEmails(result.rows)

  const entries: AuditEntry[] = result.rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    user_email: r.user_id ? emails.get(r.user_id) ?? null : null,
    modulo: r.modulo,
    acao: r.acao,
    descricao: r.descricao,
    metadata: r.metadata,
    ip: r.ip,
    created_at: r.created_at,
  }))

  return { entries }
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = typeof value === 'string' ? value : JSON.stringify(value)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function exportarAuditoriaCsvAction(
  filtro: AuditFiltro = {}
): Promise<{ csv: string; filename: string } | { error: string }> {
  const denied = await ensurePermissao()
  if (denied) return denied

  const result = await buscarLinhas(filtro, EXPORT_LIMIT)
  if ('error' in result) return result

  const emails = await resolverEmails(result.rows)

  const header = ['created_at', 'modulo', 'acao', 'user_email', 'descricao', 'metadata', 'ip']
  const lines = [header.join(',')]

  for (const r of result.rows) {
    const email = r.user_id ? emails.get(r.user_id) ?? '' : ''
    lines.push(
      [
        escapeCsv(r.created_at),
        escapeCsv(r.modulo),
        escapeCsv(r.acao),
        escapeCsv(email),
        escapeCsv(r.descricao),
        escapeCsv(r.metadata),
        escapeCsv(r.ip),
      ].join(',')
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  return { csv: lines.join('\n'), filename: `auditoria-${today}.csv` }
}
