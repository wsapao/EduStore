import { createClient } from '@/lib/supabase/server'
import { EMAIL_TEMPLATE_META, type EmailTemplateTipo } from './templates-config'

/**
 * Substitui {{var}} pelos valores fornecidos. Whitelist-based: só substitui
 * chaves que existem em EMAIL_TEMPLATE_META[tipo].variaveis. Variáveis
 * whitelisted que não recebem valor viram string vazia (não deixa "{{xxx}}"
 * solto no output). Placeholders fora da whitelist são mantidos como estão
 * — assim, "{{aluno}}" em um template que só conhece "{{nome_aluno}}" fica
 * visível para o admin perceber o erro.
 *
 * Função pura — pode ser chamada do client (preview) e do server.
 */
export function renderEmailTemplate(
  tipo: EmailTemplateTipo,
  template: { assunto: string; corpo: string },
  vars: Record<string, string | number | undefined | null>,
): { assunto: string; corpo: string } {
  const meta = EMAIL_TEMPLATE_META[tipo]
  const chavesValidas = new Set(meta.variaveis.map((v) => v.chave))

  const substituir = (texto: string) =>
    texto.replace(/\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi, (match, chave) => {
      if (!chavesValidas.has(chave)) return match
      const v = vars[chave]
      return v === undefined || v === null ? '' : String(v)
    })

  return {
    assunto: substituir(template.assunto),
    corpo: substituir(template.corpo),
  }
}

/**
 * Resolve o template ativo para uma escola+tipo. Se o admin customizou,
 * usa o registro do banco; caso contrário, devolve o default do manifest.
 *
 * Server-only (depende de `createClient` com cookies). NÃO chame do client.
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
