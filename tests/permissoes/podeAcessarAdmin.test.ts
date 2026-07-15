import { describe, it, expect } from 'vitest'
import { podeAcessarAdmin, ADMIN_ENTRY_KEYS } from '@/lib/permissoes'

describe('podeAcessarAdmin', () => {
  it('qualquer chave de entrada dá acesso ao painel', () => {
    for (const chave of ADMIN_ENTRY_KEYS) {
      expect(podeAcessarAdmin([chave])).toBe(true)
    }
  })

  it('papel Financeiro (subset real) tem acesso', () => {
    expect(podeAcessarAdmin(['pedidos.ver', 'pagamentos.ver', 'relatorios.ver'])).toBe(true)
  })

  it('permissões sem chave de entrada não dão acesso', () => {
    expect(podeAcessarAdmin(['checkin.usar', 'cantina.operar'])).toBe(false)
  })

  it('lista vazia (pai sem papel) não dá acesso', () => {
    expect(podeAcessarAdmin([])).toBe(false)
  })
})
