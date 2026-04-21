import { createClient } from '@/lib/supabase/server'
import type { Escola } from '@/types/database'

// Fallback para quando a escola não está configurada no banco
export const ESCOLA_FALLBACK: Escola = {
  id: '',
  nome: process.env.NEXT_PUBLIC_ESCOLA_NOME ?? 'Loja Escolar',
  cnpj: null,
  cor_primaria: process.env.NEXT_PUBLIC_ESCOLA_COR ?? '#1a2f5a',
  logo_url: null,
  dominio: null,
  ativo: true,
  created_at: '',
}

/**
 * Busca a escola de um responsável autenticado.
 * Usado nos layouts da loja e do admin.
 */
export async function getEscolaByUser(userId: string): Promise<Escola> {
  try {
    const supabase = await createClient()

    // 1 query com join em vez de 2 sequenciais
    const { data } = await supabase
      .from('responsaveis')
      .select('escola:escolas(*)')
      .eq('id', userId)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const escola = (data as any)?.escola as Escola | null
    return escola ?? ESCOLA_FALLBACK
  } catch {
    return ESCOLA_FALLBACK
  }
}

/**
 * Retorna a cor primária da escola como CSS inline para injetar no layout.
 * Sobrescreve a variável --brand em tempo de renderização.
 */
export function escolaThemeStyle(escola: Escola): string {
  const brand = escola.cor_primaria || '#1a2f5a'
  return `:root { --brand: ${brand}; --brand-mid: ${brand}; }`
}
