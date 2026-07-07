import type { SupabaseClient } from '@supabase/supabase-js'
import { getTemplateEmail } from './get-template'
import { renderEmailTemplate } from './render'
import { textoParaHtml } from './pedido-helpers'
import { EMAIL_TEMPLATE_META, type EmailTemplateTipo } from './templates-config'

/**
 * Resolve assunto + texto de abertura de um e-mail de pedido a partir do
 * template editável (banco ou default), com {{vars}} substituídas e o corpo
 * convertido em HTML seguro (escape + <br>).
 */
export async function resolverTemplatePedido(opts: {
  escolaId: string | null
  tipo: EmailTemplateTipo
  vars: Record<string, string | number | undefined | null>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client?: SupabaseClient<any, any, any>
}): Promise<{ assunto: string; aberturaHtml: string }> {
  const meta = EMAIL_TEMPLATE_META[opts.tipo]
  const tpl = opts.escolaId
    ? await getTemplateEmail(opts.escolaId, opts.tipo, opts.client)
    : { assunto: meta.defaultAssunto, corpo: meta.defaultCorpo }

  const r = renderEmailTemplate(opts.tipo, { assunto: tpl.assunto, corpo: tpl.corpo }, opts.vars)
  return { assunto: r.assunto, aberturaHtml: textoParaHtml(r.corpo) }
}
