import { describe, it, expect } from 'vitest'
import { limparCPF, validarCPF } from '@/lib/cpf'

describe('limparCPF', () => {
  it('remove máscara e caracteres não numéricos', () => {
    expect(limparCPF('529.982.247-25')).toBe('52998224725')
    expect(limparCPF(' 111.444.777-35 ')).toBe('11144477735')
    expect(limparCPF('abc')).toBe('')
  })
})

describe('validarCPF', () => {
  it('aceita CPFs válidos (com ou sem máscara)', () => {
    expect(validarCPF('52998224725')).toBe(true)
    expect(validarCPF('529.982.247-25')).toBe(true)
    expect(validarCPF('111.444.777-35')).toBe(true)
  })

  it('rejeita CPFs inválidos', () => {
    expect(validarCPF('')).toBe(false)
    expect(validarCPF('123')).toBe(false)
    expect(validarCPF('52998224726')).toBe(false) // dígito verificador errado
    expect(validarCPF('11111111111')).toBe(false) // sequência repetida
  })
})
