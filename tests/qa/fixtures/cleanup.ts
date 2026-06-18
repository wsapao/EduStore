// tests/qa/fixtures/cleanup.ts
// Marca entidades de teste com prefixo QA- e oferece limpeza best-effort.
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export const QA_PREFIX = 'QA-'

/** Gera um rótulo único com prefixo QA- (ex.: QA-aluno-1718600000000). */
export function qaTag(label: string): string {
  return `${QA_PREFIX}${label}-${Date.now()}`
}

function qaAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('cleanup: faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

// Tabelas/colunas onde dados QA- aparecem por nome. Ajuste conforme o schema real.
const QA_NAME_TARGETS: Array<{ table: string; column: string }> = [
  { table: 'alunos', column: 'nome' },
  { table: 'responsaveis', column: 'nome' },
]

/** Remove linhas cujo `column` começa com QA-. Best-effort: ignora tabela inexistente. */
export async function cleanupQAData(): Promise<void> {
  const db = qaAdminClient()
  for (const { table, column } of QA_NAME_TARGETS) {
    const { error } = await db.from(table).delete().like(column, `${QA_PREFIX}%`)
    if (error && !/does not exist/i.test(error.message)) {
      console.warn(`cleanup: falha ao limpar ${table}.${column}: ${error.message}`)
    }
  }
}
