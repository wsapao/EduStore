import { describe, expect, it } from 'vitest'
import { emailInscricaoConcurso } from '@/lib/email/templates'

describe('emailInscricaoConcurso', () => {
  it('inclui número, aluno, modalidade e lembretes do edital', () => {
    const { subject, html } = emailInscricaoConcurso({
      responsavelNome: 'Maria', alunoNome: 'João', numero: 'CB2027-0001', modalidade: 'Futsal',
    })
    expect(subject).toContain('CB2027-0001')
    expect(html).toContain('João')
    expect(html).toContain('Futsal')
    expect(html).toContain('30/08')          // prova pedagógica
    expect(html).toContain('declaração de saúde')
    expect(html).toContain('boletim')
  })
})
