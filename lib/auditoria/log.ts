import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'

export type AuditEvent = {
  modulo: string
  acao: string
  descricao?: string | null
  metadata?: Record<string, unknown> | null
  /** Fluxos públicos (sem admin autenticado) podem informar a escola explicitamente. */
  escolaId?: string | null
}

/**
 * Registra um evento de auditoria. Best-effort: nunca lança exception, apenas
 * loga em console.error se falhar (não pode quebrar a action principal por
 * causa do log).
 *
 * Resolve user/escola/IP automaticamente do contexto do request.
 */
export async function auditLog(event: AuditEvent): Promise<void> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const escolaId = event.escolaId ?? await getEscolaIdParaAdmin(supabase)

    if (!escolaId) return // sem escola, sem auditoria — silencioso

    const h = await headers()
    const fwd = h.get('x-forwarded-for')
    const ip =
      (fwd ? fwd.split(',')[0]?.trim() : null) ??
      h.get('x-real-ip') ??
      null

    const admin = createAdminClient()
    await admin.from('auditoria_log').insert({
      escola_id: escolaId,
      user_id: user?.id ?? null,
      modulo: event.modulo,
      acao: event.acao,
      descricao: event.descricao ?? null,
      metadata: event.metadata ?? null,
      ip,
    })
  } catch (err) {
    console.error('[auditoria] falha ao registrar evento', err)
  }
}
