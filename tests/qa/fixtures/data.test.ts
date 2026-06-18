import { describe, it, expect } from 'vitest'
import { existsSync, statSync } from 'node:fs'
import {
  randomCPF, isValidCPF, formatCPF, randomName, randomEmail, randomImageFile,
} from './data'

describe('geradores de dados "humanos"', () => {
  it('randomCPF gera 11 dígitos com verificadores válidos', () => {
    for (let i = 0; i < 50; i++) {
      const cpf = randomCPF()
      expect(cpf).toMatch(/^\d{11}$/)
      expect(isValidCPF(cpf)).toBe(true)
    }
  })

  it('formatCPF aplica a máscara', () => {
    expect(formatCPF('12345678909')).toBe('123.456.789-09')
  })

  it('randomName usa prefixo QA', () => {
    expect(randomName()).toMatch(/^QA /)
  })

  it('randomEmail é plausível e único', () => {
    expect(randomEmail()).toMatch(/@/)
    expect(randomEmail()).not.toBe(randomEmail())
  })

  it('randomImageFile escreve um PNG real no disco', () => {
    const f = randomImageFile()
    expect(existsSync(f)).toBe(true)
    expect(statSync(f).size).toBeGreaterThan(0)
    expect(f).toMatch(/\.png$/)
  })
})
