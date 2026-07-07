import { describe, expect, it } from 'vitest'
import { limparCPF, validarCPF } from '@/lib/validacao/cpf'

describe('validarCPF', () => {
  it('aceita CPF válido com e sem máscara', () => {
    expect(validarCPF('529.982.247-25')).toBe(true)
    expect(validarCPF('52998224725')).toBe(true)
  })
  it('rejeita dígitos repetidos, tamanho errado e verificador inválido', () => {
    expect(validarCPF('111.111.111-11')).toBe(false)
    expect(validarCPF('123')).toBe(false)
    expect(validarCPF('529.982.247-26')).toBe(false)
  })
  it('limparCPF remove tudo que não for dígito', () => {
    expect(limparCPF('529.982.247-25')).toBe('52998224725')
  })
})
