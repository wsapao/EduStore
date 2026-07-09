import { describe, it, expect } from 'vitest'
import { buildAlunoNomesExibicao } from '@/lib/loja/aluno-display'

function nomes(alunos: Array<{ id: string; nome: string | null }>) {
  return buildAlunoNomesExibicao(alunos)
}

describe('buildAlunoNomesExibicao', () => {
  it('usa primeiro + último nome quando não há ambiguidade', () => {
    const map = nomes([
      { id: '1', nome: 'EMANUELE TORRES DE ARAUJO' },
      { id: '2', nome: 'Marina Torres de Araújo' },
    ])
    expect(map.get('1')).toEqual({ primeiro: 'EMANUELE', curto: 'EMANUELE ARAUJO' })
    expect(map.get('2')).toEqual({ primeiro: 'Marina', curto: 'Marina Araújo' })
  })

  it('desambigua irmãos com o mesmo primeiro nome usando os dois primeiros nomes', () => {
    const map = nomes([
      { id: 'alicia', nome: 'MARIA ALÍCIA CABRAL DE OLIVEIRA' },
      { id: 'sofia', nome: 'Maria Sofia Cabral de Oliveira' },
    ])
    expect(map.get('alicia')).toEqual({ primeiro: 'MARIA ALÍCIA', curto: 'MARIA ALÍCIA' })
    expect(map.get('sofia')).toEqual({ primeiro: 'Maria Sofia', curto: 'Maria Sofia' })
  })

  it('compara primeiro nome ignorando caixa e acento', () => {
    const map = nomes([
      { id: '1', nome: 'JOSÉ Augusto Lima' },
      { id: '2', nome: 'Jose Miguel Lima' },
    ])
    expect(map.get('1')?.primeiro).toBe('JOSÉ Augusto')
    expect(map.get('2')?.primeiro).toBe('Jose Miguel')
  })

  it('estende o prefixo até desambiguar quando os dois primeiros nomes coincidem', () => {
    const map = nomes([
      { id: '1', nome: 'Ana Clara Souza Dias' },
      { id: '2', nome: 'Ana Clara Pereira Dias' },
    ])
    expect(map.get('1')?.primeiro).toBe('Ana Clara Souza')
    expect(map.get('2')?.primeiro).toBe('Ana Clara Pereira')
  })

  it('nome de uma palavra não duplica', () => {
    const map = nomes([{ id: '1', nome: 'Emanuele' }])
    expect(map.get('1')).toEqual({ primeiro: 'Emanuele', curto: 'Emanuele' })
  })

  it('tolera nome nulo ou vazio', () => {
    const map = nomes([
      { id: '1', nome: null },
      { id: '2', nome: '  ' },
    ])
    expect(map.get('1')).toEqual({ primeiro: '', curto: '' })
    expect(map.get('2')).toEqual({ primeiro: '', curto: '' })
  })

  it('nomes completos idênticos não entram em loop e ficam iguais', () => {
    const map = nomes([
      { id: '1', nome: 'Maria Silva' },
      { id: '2', nome: 'Maria Silva' },
    ])
    expect(map.get('1')?.primeiro).toBe('Maria Silva')
    expect(map.get('2')?.primeiro).toBe('Maria Silva')
  })
})
