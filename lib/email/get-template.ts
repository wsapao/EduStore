import { createClient } from '@/lib/supabase/server'
import { EMAIL_TEMPLATE_META, type EmailTemplateTipo } from './templates-config'

/**
 * Resolve o template ativo para uma escola+tipo. Se o admin customizou,
 * usa o registro do banco; caso contrário, devolve o default do manifest.
 *
 * Server-only (depende de `createClient` com cookies). NÃO importe de
 * Client Components — use `renderEmailTemplate` puro de `./render` no
 * client.
 */
export async function getTemplateEmail(
  escolaId: string,
  tipo: EmailTemplateTipo,
): Promise<{ assunto: string; corpo: string; origem: 'banco' | 'padrao' }> {
  const meta = EMAIL_TEMPLATE_META[tipo]

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('email_templates')
      .select('assunto, corpo, ativo')
      .eq('escola_id', escolaId)
      .eq('tipo', tipo)
      .maybeSingle()

    if (!error && data && (data as any).ativo !== false) {
      const row = data as { assunto: string; corpo: string }
      return { assunto: row.assunto, corpo: row.corpo, origem: 'banco' }
    }
  } catch {
    // cai pro fallback abaixo
  }

  return { assunto: meta.defaultAssunto, corpo: meta.defaultCorpo, origem: 'padrao' }
}
