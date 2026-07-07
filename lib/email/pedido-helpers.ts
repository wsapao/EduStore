/**
 * Helpers puros dos e-mails de pedido — sem imports de next/supabase.
 * Testáveis direto no vitest e importáveis de qualquer contexto.
 */

export interface ItemEmailUnitario {
  produtoId: string
  alunoId: string
  nome: string
  imagemUrl: string | null
  alunoLabel: string
  variante: string | null
  precoUnitario: number
}

export interface ItemEmailAgrupado {
  nome: string
  imagemUrl: string | null
  alunoLabel: string
  variante: string | null
  quantidade: number
  precoUnitario: number
}

/** itens_pedido tem uma linha por unidade — agrupa por produto+variante+aluno. */
export function agruparItensEmail(itens: ItemEmailUnitario[]): ItemEmailAgrupado[] {
  const grupos = new Map<string, ItemEmailAgrupado>()
  for (const item of itens) {
    const chave = `${item.produtoId}|${item.variante ?? ''}|${item.alunoId}`
    const existente = grupos.get(chave)
    if (existente) {
      existente.quantidade += 1
    } else {
      grupos.set(chave, {
        nome: item.nome,
        imagemUrl: item.imagemUrl,
        alunoLabel: item.alunoLabel,
        variante: item.variante,
        quantidade: 1,
        precoUnitario: item.precoUnitario,
      })
    }
  }
  return Array.from(grupos.values())
}

export function formatarAlunoLabel(nome: string, serie?: string | null, turma?: string | null): string {
  const detalhe = [serie, turma].filter(Boolean).join(' ')
  return detalhe ? `${nome} · ${detalhe}` : nome
}

export function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Texto plano (ex.: corpo editável do admin) → HTML seguro com <br>. */
export function textoParaHtml(texto: string): string {
  return escapeHtml(texto).replace(/\r?\n/g, '<br>')
}

export function fmtBRL(v: number): string {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Data pura (YYYY-MM-DD) formata sem Date p/ não sofrer shift de fuso. */
export function fmtDataCurta(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

export function fmtDataHora(iso: string): string {
  return new Date(iso)
    .toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(', ', ' às ')
}
