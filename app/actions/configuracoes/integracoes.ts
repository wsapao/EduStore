'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission, PermissionDeniedError } from '@/lib/permissoes'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { activesoft } from '@/lib/activesoft'

const GA4_RE = /^G-[A-Z0-9]+$/i
const PIXEL_RE = /^\d+$/

async function checkPermission(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requirePermission('configuracoes.editar_identidade')
    return { ok: true }
  } catch (e) {
    if (e instanceof PermissionDeniedError) return { ok: false, error: 'Sem permissão.' }
    return { ok: false, error: 'Sem permissão.' }
  }
}

export async function atualizarIntegracoesAction(formData: FormData) {
  const perm = await checkPermission()
  if (!perm.ok) return { error: perm.error }

  const ga4Raw = (formData.get('ga4_id') as string | null)?.trim() || ''
  if (ga4Raw && ga4Raw.length > 50) {
    return { error: 'GA4 ID inválido — use o formato G-XXXXXXXXXX' }
  }
  if (ga4Raw && !GA4_RE.test(ga4Raw)) {
    return { error: 'GA4 ID inválido — use o formato G-XXXXXXXXXX' }
  }
  const ga4 = ga4Raw || null

  const pixelRaw = (formData.get('meta_pixel_id') as string | null)?.trim() || ''
  if (pixelRaw && pixelRaw.length > 30) {
    return { error: 'Meta Pixel ID inválido — use só dígitos' }
  }
  if (pixelRaw && !PIXEL_RE.test(pixelRaw)) {
    return { error: 'Meta Pixel ID inválido — use só dígitos' }
  }
  const pixel = pixelRaw || null

  const supabase = await createClient()
  const escolaId = await getEscolaIdParaAdmin(supabase)
  if (!escolaId) return { error: 'Escola não encontrada para este usuário.' }

  const { error } = await supabase
    .from('escola_configuracoes')
    .update({
      activesoft_ativo: formData.get('activesoft_ativo') === 'on',
      crm_ativo: formData.get('crm_ativo') === 'on',
      ga4_id: ga4,
      meta_pixel_id: pixel,
    })
    .eq('escola_id', escolaId)

  if (error) return { error: 'Erro ao salvar configurações de integrações.' }

  revalidatePath('/admin/configuracoes/integracoes')
  return { success: true }
}

export async function testarActivesoftAction(): Promise<{ ok: boolean; message: string }> {
  const perm = await checkPermission()
  if (!perm.ok) return { ok: false, message: perm.error }

  if (!process.env.ACTIVESOFT_TOKEN) {
    return { ok: false, message: 'ACTIVESOFT_TOKEN não configurada no Vercel.' }
  }
  try {
    const turmas = await activesoft.listTurmas()
    const count = Array.isArray(turmas) ? turmas.length : 0
    return { ok: true, message: `Conexão OK — ${count} turmas retornadas.` }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, message: 'Falha na conexão: ' + msg }
  }
}

export async function testarCrmAction(): Promise<{ ok: boolean; message: string }> {
  const perm = await checkPermission()
  if (!perm.ok) return { ok: false, message: perm.error }

  const url = process.env.EDUCRM_API_URL
  const key = process.env.EDUCRM_API_KEY
  if (!url || !key) {
    return { ok: false, message: 'EDUCRM_API_URL ou EDUCRM_API_KEY não configurada.' }
  }

  try {
    const res = await fetch(`${url}/api/webhooks/loja/series`, {
      headers: { 'x-webhook-secret': key },
    })
    if (res.ok) return { ok: true, message: 'Conexão OK.' }
    return { ok: false, message: `CRM respondeu HTTP ${res.status}` }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, message: 'Falha na conexão: ' + msg }
  }
}

export type AsaasWebhook = {
  id: string
  name: string
  url: string
  interrupted: boolean
}

export async function getStatusAsaasWebhookAction(): Promise<
  { ok: true; webhooks: AsaasWebhook[] } | { ok: false; message: string }
> {
  const perm = await checkPermission()
  if (!perm.ok) return { ok: false, message: perm.error }

  if (!process.env.ASAAS_API_KEY) {
    return { ok: false, message: 'ASAAS_API_KEY não configurada.' }
  }

  try {
    const res = await fetch('https://api.asaas.com/v3/webhooks', {
      headers: { access_token: process.env.ASAAS_API_KEY },
    })
    if (!res.ok) {
      return { ok: false, message: `Asaas respondeu HTTP ${res.status}` }
    }
    const body = await res.json()
    const data = Array.isArray(body?.data) ? body.data : []
    const webhooks: AsaasWebhook[] = data.map((w: any) => ({
      id: String(w.id),
      name: String(w.name ?? ''),
      url: String(w.url ?? ''),
      interrupted: Boolean(w.interrupted),
    }))
    return { ok: true, webhooks }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, message: 'Falha na conexão: ' + msg }
  }
}

export async function reativarAsaasWebhookAction({ webhookId }: { webhookId: string }) {
  const perm = await checkPermission()
  if (!perm.ok) return { error: perm.error }

  if (!process.env.ASAAS_API_KEY) {
    return { error: 'ASAAS_API_KEY não configurada.' }
  }
  if (!webhookId) return { error: 'webhookId obrigatório.' }

  try {
    const res = await fetch(`https://api.asaas.com/v3/webhooks/${webhookId}`, {
      method: 'PUT',
      headers: {
        access_token: process.env.ASAAS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ interrupted: false }),
    })
    if (!res.ok) return { error: `Asaas respondeu HTTP ${res.status}` }
    revalidatePath('/admin/configuracoes/integracoes')
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { error: 'Falha na conexão: ' + msg }
  }
}
