import { describe, expect, it } from 'vitest'
import { CONCURSO, inscricoesAbertas, MODALIDADES } from '@/lib/concurso/config'

describe('config do concurso', () => {
  it('expõe valores acordados', () => {
    expect(CONCURSO.escolaId).toBe('5d4b0ca0-b55b-4c7b-a41f-08b83e3ec350')
    expect(CONCURSO.valorInscricao).toBe(25)
    expect(MODALIDADES.map(m => m.slug)).toEqual(['futsal', 'volei', 'basquete', 'handebol', 'judo', 'ginastica', 'ballet', 'natacao'])
  })
  it('inscricoesAbertas respeita a janela 06/07–23/08/2026', () => {
    expect(inscricoesAbertas(new Date('2026-07-05T00:00:00-03:00'))).toBe(false)
    expect(inscricoesAbertas(new Date('2026-07-06T08:00:00-03:00'))).toBe(true)
    expect(inscricoesAbertas(new Date('2026-08-23T23:00:00-03:00'))).toBe(true)
    expect(inscricoesAbertas(new Date('2026-08-24T00:01:00-03:00'))).toBe(false)
  })
})
