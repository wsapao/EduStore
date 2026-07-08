import { describe, expect, it } from 'vitest'
import { mascararCPF, formatarContador } from '@/app/concurso-bolsas-2027/inscricao/helpers'

describe('helpers do formulário', () => {
  it('mascara CPF progressivamente', () => {
    expect(mascararCPF('529')).toBe('529')
    expect(mascararCPF('5299822')).toBe('529.982.2')
    expect(mascararCPF('52998224725')).toBe('529.982.247-25')
    expect(mascararCPF('529982247259999')).toBe('529.982.247-25') // trunca em 11 dígitos
  })
  it('formata contador mm:ss e não fica negativo', () => {
    expect(formatarContador(29 * 60_000 + 41_000)).toBe('29:41')
    expect(formatarContador(0)).toBe('00:00')
    expect(formatarContador(-5000)).toBe('00:00')
  })
})
