/**
 * Agregações financeiras e export CSV das inscrições do concurso.
 * Funções puras — testáveis sem Supabase.
 */

export interface InscricaoRow {
  numero: string
  aluno_nome: string
  serie_2026: string
  modalidade: string
  resp1_nome: string
  resp1_cpf: string
  resp1_email: string
  resp1_telefone: string | null
  status_pagamento: string
  valor: number
  valor_liquido: number | null
  created_at: string
  pago_em: string | null
}

export interface ResumoFinanceiro {
  totalBruto: number
  totalLiquido: number
  totalTaxa: number
  porStatus: Record<string, number>
  porModalidade: Record<string, number>
}

export function resumoFinanceiro(rows: InscricaoRow[]): ResumoFinanceiro {
  const pagos = rows.filter((r) => r.status_pagamento === 'pago')
  const totalBruto = pagos.reduce((s, r) => s + Number(r.valor), 0)
  const totalLiquido = pagos.reduce((s, r) => s + Number(r.valor_liquido ?? 0), 0)
  const conta = (key: (r: InscricaoRow) => string) =>
    rows.reduce<Record<string, number>>((acc, r) => {
      const k = key(r)
      acc[k] = (acc[k] ?? 0) + 1
      return acc
    }, {})
  return {
    totalBruto,
    totalLiquido,
    totalTaxa: totalBruto - totalLiquido,
    porStatus: conta((r) => r.status_pagamento),
    porModalidade: conta((r) => r.modalidade),
  }
}

const CSV_COLS: (keyof InscricaoRow)[] = [
  'numero', 'aluno_nome', 'serie_2026', 'modalidade', 'resp1_nome', 'resp1_cpf',
  'resp1_email', 'resp1_telefone', 'status_pagamento', 'valor', 'created_at', 'pago_em',
]

function esc(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function gerarCSV(rows: InscricaoRow[]): string {
  const header = CSV_COLS.join(';')
  const body = rows.map((r) => CSV_COLS.map((c) => esc(r[c])).join(';'))
  return [header, ...body].join('\n')
}
