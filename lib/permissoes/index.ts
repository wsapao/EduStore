import { createClient } from '@/lib/supabase/server'
import { getUserPermissions } from './getUserPermissions'

export class PermissionDeniedError extends Error {
  constructor(public chave: string) {
    super(`Permissão negada: ${chave}`)
    this.name = 'PermissionDeniedError'
  }
}

export async function hasPermission(chave: string): Promise<boolean> {
  const supabase = await createClient()
  const perms = await getUserPermissions(supabase)
  return perms.includes(chave)
}

export async function requirePermission(chave: string): Promise<void> {
  const ok = await hasPermission(chave)
  if (!ok) throw new PermissionDeniedError(chave)
}

export async function currentPermissions(): Promise<string[]> {
  const supabase = await createClient()
  return getUserPermissions(supabase)
}

/**
 * Permissões que dão acesso à área /admin. Qualquer papel de equipe
 * (Admin, Financeiro, Gerente, Visualizador…) tem ao menos uma delas;
 * responsáveis sem papel não têm nenhuma.
 */
export const ADMIN_ENTRY_KEYS = ['configuracoes.ver', 'produtos.ver', 'pedidos.ver'] as const

export function podeAcessarAdmin(permissoes: string[]): boolean {
  return ADMIN_ENTRY_KEYS.some((chave) => permissoes.includes(chave))
}

export { getUserPermissions } from './getUserPermissions'
export * from './keys'
