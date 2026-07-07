import { describe, expect, it } from 'vitest'
import { validarInscricao, type InscricaoInput } from '@/lib/concurso/validacao'

const valida: InscricaoInput = {
  aluno_nome: 'João Pedro Silva', aluno_nascimento: '2015-03-10',
  serie_2026: '5º ano EF', modalidade: 'futsal', instituicao_atual: 'Escola ABC',
  resp1_nome: 'Maria Silva', resp1_cpf: '529.982.247-25', resp1_email: 'maria@email.com',
  resp1_telefone: '(81) 99999-0000', resp1_profissao: 'Enfermeira', resp1_parentesco: 'Mãe',
  resp1_endereco: 'Rua X, 1', resp2_nome: '', resp2_endereco: '', resp2_telefone: '',
  resp2_profissao: '', resp2_parentesco: '', tem_irmaos: false, irmaos_series_2026: '',
  consentimento: true,
}

describe('validarInscricao', () => {
  it('aceita input completo', () => {
    expect(validarInscricao(valida)).toEqual({ ok: true })
  })
  it('exige obrigatórios do aluno e do responsável 1', () => {
    const r = validarInscricao({ ...valida, aluno_nome: ' ', resp1_email: 'x' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.erros).toContain('Informe o nome do estudante.')
      expect(r.erros).toContain('E-mail do responsável inválido.')
    }
  })
  it('rejeita CPF inválido e modalidade desconhecida', () => {
    const r = validarInscricao({ ...valida, resp1_cpf: '111.111.111-11', modalidade: 'xadrez' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.erros).toContain('CPF do responsável inválido.')
      expect(r.erros).toContain('Modalidade inválida.')
    }
  })
  it('exige consentimento LGPD', () => {
    const r = validarInscricao({ ...valida, consentimento: false })
    expect(r.ok).toBe(false)
  })
})
