'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission, PermissionDeniedError } from '@/lib/permissoes'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { auditLog } from '@/lib/auditoria/log'
import { getResend, EMAIL_FROM } from '@/lib/email/resend'
import { renderEmailTemplate } from '@/lib/email/render'
import { getTemplateEmail } from '@/lib/email/get-template'
import {
  EMAIL_TEMPLATE_META,
  EMAIL_TEMPLATE_TYPES,
  isEmailTemplateTipo,
  type EmailTemplateTipo,
} from '@/lib/email/templates-config'

const ASSUNTO_MIN = 3
const ASSUNTO_MAX = 200
const CORPO_MIN = 10
const CORPO_MAX = 5000

async function ensurePerm(): Promise<{ ok: true } | { error: string }> {
  try {
    await requirePermission('configuracoes.editar_identidade')
    return { ok: true }
  } catch (e) {
    if (e instanceof PermissionDeniedError) return { error: 'Sem permissão.' }
    return { error: 'Sem permissão.' }
  }
}

export interface EmailTemplateEntry {
  tipo: EmailTemplateTipo
  customizado: boolean
  assunto: string
  corpo: string
  updated_at: string | null
  updated_by_email: string | null
}

export async function listarTemplatesEmailAction(): Promise<
  { templates: EmailTemplateEntry[] } | { error: string }
> {
  const perm = await ensurePerm()
  if ('error' in perm) return perm

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const { data, error } = await supabase
    .from('email_templates')
    .select('tipo, assunto, corpo, updated_at, updated_by')
    .eq('escola_id', escolaId)

  if (error) return { error: 'Erro ao listar templates.' }

  type Row = {
    tipo: EmailTemplateTipo
    assunto: string
    corpo: string
    updated_at: string | null
    updated_by: string | null
  }
  const rows = (data ?? []) as Row[]
  const byTipo = new Map<EmailTemplateTipo, Row>()
  for (const r of rows) {
    if (isEmailTemplateTipo(r.tipo)) byTipo.set(r.tipo, r)
  }

  // Resolve emails dos updated_by em paralelo (apenas para os customizados)
  let admin: ReturnType<typeof createAdminClient> | null = null
  try {
    admin = createAdminClient()
  } catch {
    admin = null
  }

  const userIds = Array.from(
    new Set(
      Array.from(byTipo.values())
        .map((r) => r.updated_by)
        .filter((v): v is string => !!v),
    ),
  )

  const emailByUserId = new Map<string, string | null>()
  if (admin && userIds.length > 0) {
    await Promise.all(
      userIds.map(async (uid) => {
        try {
          const res = await admin!.auth.admin.getUserById(uid)
          emailByUserId.set(uid, res?.data?.user?.email ?? null)
        } catch {
          emailByUserId.set(uid, null)
        }
      }),
    )
  }

  const templates: EmailTemplateEntry[] = EMAIL_TEMPLATE_TYPES.map((tipo) => {
    const meta = EMAIL_TEMPLATE_META[tipo]
    const row = byTipo.get(tipo)
    if (row) {
      return {
        tipo,
        customizado: true,
        assunto: row.assunto,
        corpo: row.corpo,
        updated_at: row.updated_at,
        updated_by_email: row.updated_by ? emailByUserId.get(row.updated_by) ?? null : null,
      }
    }
    return {
      tipo,
      customizado: false,
      assunto: meta.defaultAssunto,
      corpo: meta.defaultCorpo,
      updated_at: null,
      updated_by_email: null,
    }
  })

  return { templates }
}

export async function salvarTemplateEmailAction(input: {
  tipo: EmailTemplateTipo
  assunto: string
  corpo: string
}): Promise<{ success: true } | { error: string }> {
  const perm = await ensurePerm()
  if ('error' in perm) return perm

  if (!isEmailTemplateTipo(input.tipo)) return { error: 'Tipo inválido.' }

  const assunto = (input.assunto ?? '').trim()
  if (assunto.length < ASSUNTO_MIN || assunto.length > ASSUNTO_MAX) {
    return { error: `Assunto deve ter entre ${ASSUNTO_MIN} e ${ASSUNTO_MAX} caracteres.` }
  }

  const corpo = (input.corpo ?? '').trim()
  if (corpo.length < CORPO_MIN || corpo.length > CORPO_MAX) {
    return { error: `Corpo deve ter entre ${CORPO_MIN} e ${CORPO_MAX} caracteres.` }
  }

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const userId = user?.id ?? null

  const { error: upsertErr } = await supabase
    .from('email_templates')
    .upsert(
      {
        escola_id: escolaId,
        tipo: input.tipo,
        assunto,
        corpo,
        updated_by: userId,
      },
      { onConflict: 'escola_id,tipo' },
    )

  if (upsertErr) return { error: 'Erro ao salvar template.' }

  await auditLog({
    modulo: 'emails',
    acao: 'salvou_template',
    metadata: { tipo: input.tipo },
  })

  revalidatePath('/admin/configuracoes/emails')

  return { success: true }
}

export async function restaurarPadraoTemplateAction(input: {
  tipo: EmailTemplateTipo
}): Promise<{ success: true } | { error: string }> {
  const perm = await ensurePerm()
  if ('error' in perm) return perm

  if (!isEmailTemplateTipo(input.tipo)) return { error: 'Tipo inválido.' }

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const { error } = await supabase
    .from('email_templates')
    .delete()
    .eq('escola_id', escolaId)
    .eq('tipo', input.tipo)

  if (error) return { error: 'Erro ao restaurar padrão.' }

  await auditLog({
    modulo: 'emails',
    acao: 'restaurou_padrao',
    metadata: { tipo: input.tipo },
  })

  revalidatePath('/admin/configuracoes/emails')

  return { success: true }
}

export async function enviarTesteEmailAction(input: {
  tipo: EmailTemplateTipo
}): Promise<{ success: true; destinatario: string } | { error: string }> {
  const perm = await ensurePerm()
  if ('error' in perm) return perm

  if (!isEmailTemplateTipo(input.tipo)) return { error: 'Tipo inválido.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const destinatario = user?.email ?? null
  if (!destinatario) return { error: 'Usuário sem e-mail cadastrado.' }

  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const resend = getResend()
  if (!resend) return { error: 'RESEND_API_KEY não configurada no Vercel.' }

  const tpl = await getTemplateEmail(escolaId, input.tipo)

  // Renderiza com os exemplos do manifest
  const exemplos: Record<string, string> = {}
  for (const v of EMAIL_TEMPLATE_META[input.tipo].variaveis) {
    exemplos[v.chave] = v.exemplo
  }
  const rendered = renderEmailTemplate(input.tipo, { assunto: tpl.assunto, corpo: tpl.corpo }, exemplos)

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: destinatario,
      subject: `[TESTE] ${rendered.assunto}`,
      text: rendered.corpo,
    })
  } catch {
    return { error: 'Falha ao enviar e-mail de teste.' }
  }

  await auditLog({
    modulo: 'emails',
    acao: 'enviou_teste',
    metadata: { tipo: input.tipo, destinatario },
  })

  return { success: true, destinatario }
}
