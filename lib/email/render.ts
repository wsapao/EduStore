import { EMAIL_TEMPLATE_META, type EmailTemplateTipo } from './templates-config'

/**
 * Substitui {{var}} pelos valores fornecidos. Whitelist-based: só substitui
 * chaves que existem em EMAIL_TEMPLATE_META[tipo].variaveis. Variáveis
 * whitelisted que não recebem valor viram string vazia (não deixa "{{xxx}}"
 * solto no output). Placeholders fora da whitelist são mantidos como estão
 * — assim, "{{aluno}}" em um template que só conhece "{{nome_aluno}}" fica
 * visível para o admin perceber o erro.
 *
 * Função pura — pode ser chamada do client (preview) e do server. Não importa
 * nada de `next/*` ou Supabase, então é seguro consumir em Client Components.
 *
 * SEGURANÇA — contrato text/plain: os valores são substituídos SEM escape de
 * HTML. O output só pode ser consumido como texto puro (Resend `text:`, JSX
 * auto-escapado). NUNCA envie `corpo` como parte `html` nem injete via
 * dangerouslySetInnerHTML — template do banco + nomes de responsável/aluno
 * virariam vetor de injeção. Se um dia precisar de HTML, escape cada valor
 * substituído com `escapeHtml` (lib/email/templates.ts) e escape/valide o
 * corpo do template também.
 *
 * Para resolver o template ativo (banco vs default), use `getTemplateEmail`
 * em `lib/email/get-template.ts` (server-only).
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
