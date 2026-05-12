import { describe, it, expect } from 'vitest'
import { PERMISSION_KEYS, PERMISSION_GROUPS, isValidPermissionKey } from '@/lib/permissoes/keys'

describe('permission keys', () => {
  it('contém pelo menos uma chave por módulo do spec', () => {
    const modulos = [
      'produtos','categorias','pedidos','pagamentos','vouchers',
      'alunos','responsaveis','checkin','pdv','cantina',
      'relatorios','receita','configuracoes',
    ]
    for (const m of modulos) {
      expect(PERMISSION_KEYS.some(k => k.startsWith(`${m}.`))).toBe(true)
    }
  })

  it('todas as chaves são únicas', () => {
    expect(new Set(PERMISSION_KEYS).size).toBe(PERMISSION_KEYS.length)
  })

  it('PERMISSION_GROUPS cobre todas as chaves', () => {
    const flat = PERMISSION_GROUPS.flatMap(g => g.permissoes.map(p => p.chave))
    expect(new Set(flat)).toEqual(new Set(PERMISSION_KEYS))
  })

  it('isValidPermissionKey identifica chaves válidas e inválidas', () => {
    expect(isValidPermissionKey('produtos.ver')).toBe(true)
    expect(isValidPermissionKey('foo.bar')).toBe(false)
  })
})
