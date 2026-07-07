import { describe, expect, it } from 'vitest'
import { validarEmail, EMAIL_RE } from '@/lib/validacao/email'

describe('validarEmail', () => {
  it('aceita e-mail válido', () => {
    expect(validarEmail('maria@email.com')).toBe(true)
    expect(validarEmail('joao.silva+tag@sub.dominio.com.br')).toBe(true)
  })
  it('rejeita e-mail sem @', () => {
    expect(validarEmail('maria.email.com')).toBe(false)
  })
  it('rejeita e-mail com espaços', () => {
    expect(validarEmail('maria silva@email.com')).toBe(false)
    expect(validarEmail('maria@email .com')).toBe(false)
  })
  it('rejeita TLD de 1 caractere', () => {
    expect(validarEmail('maria@email.c')).toBe(false)
  })
  it('rejeita lixo após o domínio', () => {
    expect(validarEmail('maria@email.com extra')).toBe(false)
  })
  it('exporta a regex compartilhada', () => {
    expect(EMAIL_RE.test('maria@email.com')).toBe(true)
  })
})
