import { validarCPF } from '@/lib/validacao/cpf'
import { validarEmail } from '@/lib/validacao/email'
import { MODALIDADES } from './config'

export interface InscricaoInput {
  aluno_nome: string; aluno_nascimento: string; serie_2026: string
  modalidade: string; instituicao_atual: string
  resp1_nome: string; resp1_cpf: string; resp1_email: string
  resp1_telefone: string; resp1_endereco: string; resp1_profissao: string; resp1_parentesco: string
  resp2_nome: string; resp2_endereco: string; resp2_telefone: string
  resp2_profissao: string; resp2_parentesco: string
  tem_irmaos: boolean; irmaos_series_2026: string
  consentimento: boolean
}

export type ResultadoValidacao = { ok: true } | { ok: false; erros: string[] }

/** Chave de comparação de candidato p/ regra de 1 modalidade (edital 2.2.e): ignora caixa, acentos e espaços. */
export function normalizarNomeCandidato(nome: string): string {
  return (nome ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

/** Data ISO (aaaa-mm-dd) que existe de fato no calendário (Date.parse rola 30/02 p/ março). */
function dataValida(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso ?? '')) return false
  const d = new Date(`${iso}T00:00:00Z`)
  if (isNaN(d.getTime())) return false
  const [ano, mes, dia] = iso.split('-').map(Number)
  return d.getUTCFullYear() === ano && d.getUTCMonth() + 1 === mes && d.getUTCDate() === dia
}

export function validarInscricao(i: InscricaoInput): ResultadoValidacao {
  const erros: string[] = []
  if (!i.aluno_nome?.trim()) erros.push('Informe o nome do estudante.')
  if (!dataValida(i.aluno_nascimento)) erros.push('Data de nascimento inválida.')
  if (!i.serie_2026?.trim()) erros.push('Informe a série em 2026.')
  if (!MODALIDADES.some(m => m.slug === i.modalidade)) erros.push('Modalidade inválida.')
  if (!i.instituicao_atual?.trim()) erros.push('Informe a instituição de ensino atual.')
  if (!i.resp1_nome?.trim()) erros.push('Informe o nome do responsável.')
  if (!validarCPF(i.resp1_cpf ?? '')) erros.push('CPF do responsável inválido.')
  if (!validarEmail(i.resp1_email ?? '')) erros.push('E-mail do responsável inválido.')
  if (!i.consentimento) erros.push('É necessário aceitar o tratamento dos dados (LGPD).')
  return erros.length ? { ok: false, erros } : { ok: true }
}
