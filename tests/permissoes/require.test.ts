import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/permissoes/getUserPermissions', () => ({
  getUserPermissions: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { getUserPermissions } from '@/lib/permissoes/getUserPermissions'
import { hasPermission, requirePermission, PermissionDeniedError } from '@/lib/permissoes'

describe('hasPermission / requirePermission', () => {
  it('hasPermission é true quando a chave está na lista', async () => {
    ;(createClient as any).mockResolvedValue({})
    ;(getUserPermissions as any).mockResolvedValue(['produtos.ver','pedidos.ver'])
    expect(await hasPermission('produtos.ver')).toBe(true)
  })

  it('hasPermission é false quando a chave NÃO está na lista', async () => {
    ;(createClient as any).mockResolvedValue({})
    ;(getUserPermissions as any).mockResolvedValue(['pedidos.ver'])
    expect(await hasPermission('produtos.editar')).toBe(false)
  })

  it('requirePermission lança PermissionDeniedError quando não autorizado', async () => {
    ;(createClient as any).mockResolvedValue({})
    ;(getUserPermissions as any).mockResolvedValue([])
    await expect(requirePermission('produtos.ver')).rejects.toBeInstanceOf(PermissionDeniedError)
  })

  it('requirePermission resolve sem erro quando autorizado', async () => {
    ;(createClient as any).mockResolvedValue({})
    ;(getUserPermissions as any).mockResolvedValue(['produtos.ver'])
    await expect(requirePermission('produtos.ver')).resolves.toBeUndefined()
  })
})
