// Lógica pura do relatório de compras por produto (aba "Compras" do admin).
// Mantida sem dependências de React/Supabase para ser testável em unidade.

export interface CompraRow {
  item_id: string
  aluno_nome: string | null
  aluno_serie: string | null
  aluno_turma: string | null
  responsavel_nome: string | null
  responsavel_email: string | null
  responsavel_telefone: string | null
  variante: string | null
  pedido_numero: string
  pedido_status: string
  data_pagamento: string | null
  preco_unitario: number
  estornado: boolean
}

export type StatusFiltro = 'pago' | 'pendente' | 'cancelado' | 'todos'

export interface FiltrosCompras {
  serie: string | null
  turma: string | null
  status: StatusFiltro
  incluirEstornados: boolean
}

export const COLUNAS_COMPRAS = [
  { key: 'aluno_nome', label: 'Aluno' },
  { key: 'aluno_serie', label: 'Série' },
  { key: 'aluno_turma', label: 'Turma' },
  { key: 'responsavel_nome', label: 'Responsável' },
  { key: 'responsavel_email', label: 'E-mail' },
  { key: 'responsavel_telefone', label: 'Telefone' },
  { key: 'variante', label: 'Variante' },
  { key: 'pedido_numero', label: 'Pedido' },
  { key: 'pedido_status', label: 'Status' },
  { key: 'data_pagamento', label: 'Pago em' },
  { key: 'preco_unitario', label: 'Valor' },
] as const

export type ColunaKey = (typeof COLUNAS_COMPRAS)[number]['key']

export function filtrarCompras(rows: CompraRow[], f: FiltrosCompras): CompraRow[] {
  return rows.filter(r => {
    if (!f.incluirEstornados && r.estornado) return false
    if (f.status !== 'todos' && r.pedido_status !== f.status) return false
    if (f.serie && r.aluno_serie !== f.serie) return false
    if (f.turma && r.aluno_turma !== f.turma) return false
    return true
  })
}

export function resumoCompras(rows: CompraRow[]): { qtd: number; total: number } {
  return {
    qtd: rows.length,
    total: rows.reduce((acc, r) => acc + Number(r.preco_unitario), 0),
  }
}

export function formatarDataHora(iso: string | null, timeZone = 'America/Recife'): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', timeZone,
  }).replace(',', '')
}

export function formatarValor(valor: number): string {
  return Number(valor).toFixed(2).replace('.', ',')
}

function celula(row: CompraRow, key: ColunaKey): string {
  switch (key) {
    case 'data_pagamento': return row.data_pagamento ? formatarDataHora(row.data_pagamento) : ''
    case 'preco_unitario': return formatarValor(row.preco_unitario)
    default: return String(row[key] ?? '')
  }
}

export function montarCsvCompras(rows: CompraRow[], colunas: ColunaKey[]): string {
  const meta = COLUNAS_COMPRAS.filter(c => colunas.includes(c.key))
  const header = meta.map(c => c.label).join(',')
  const linhas = rows.map(r =>
    meta.map(c => `"${celula(r, c.key).replace(/"/g, '""')}"`).join(','),
  )
  return [header, ...linhas].join('\n')
}
