import { describe, expect, it } from 'vitest'
import { limparCPF, mascaraCpf, validarCPF } from '@/lib/validacao/cpf'

describe('validarCPF', () => {
  it('aceita CPF válido com e sem máscara', () => {
    expect(validarCPF('529.982.247-25')).toBe(true)
    expect(validarCPF('52998224725')).toBe(true)
    expect(validarCPF('111.444.777-35')).toBe(true)
  })
  it('rejeita dígitos repetidos, tamanho errado e verificador inválido', () => {
    expect(validarCPF('')).toBe(false)
    expect(validarCPF('111.111.111-11')).toBe(false)
    expect(validarCPF('123')).toBe(false)
    expect(validarCPF('529.982.247-26')).toBe(false)
  })
  it('limparCPF remove tudo que não for dígito', () => {
    expect(limparCPF('529.982.247-25')).toBe('52998224725')
    expect(limparCPF(' 111.444.777-35 ')).toBe('11144477735')
    expect(limparCPF('abc')).toBe('')
  })
})

describe('mascaraCpf', () => {
  it('mascara os dígitos do meio, com e sem formatação', () => {
    expect(mascaraCpf('52998224725')).toBe('529.***.***-25')
    expect(mascaraCpf('529.982.247-25')).toBe('529.***.***-25')
  })
  it('retorna *** quando não há 11 dígitos', () => {
    expect(mascaraCpf('')).toBe('***')
    expect(mascaraCpf('123')).toBe('***')
    expect(mascaraCpf('529982247251')).toBe('***')
  })
})
