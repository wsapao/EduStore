/** Configuração do Concurso de Bolsas – Seletivas Esportivas 2027 (ESJT). */

export const MODALIDADES = [
  { slug: 'futsal',    nome: 'Futsal',    icone: '⚽' },
  { slug: 'volei',     nome: 'Vôlei',     icone: '🏐' },
  { slug: 'judo',      nome: 'Judô',      icone: '🥋' },
  { slug: 'ginastica', nome: 'Ginástica', icone: '🤸' },
  { slug: 'natacao',   nome: 'Natação',   icone: '🏊' },
] as const

export type ModalidadeSlug = (typeof MODALIDADES)[number]['slug']

export const SERIES_2026 = [
  '1º ano EF', '2º ano EF', '3º ano EF', '4º ano EF', '5º ano EF',
  '6º ano EF', '7º ano EF', '8º ano EF',
  '9º ano EF', '1ª série EM', '2ª série EM',
] as const // série ATUAL (2026); em 2027 cursará a seguinte (2º EF à 3ª EM)

export const CONCURSO = {
  escolaId: '5d4b0ca0-b55b-4c7b-a41f-08b83e3ec350',
  valorInscricao: 25,
  // Janela em America/Recife (UTC-3, sem horário de verão)
  inscricoesAbertura:     new Date('2026-07-06T00:00:00-03:00'),
  inscricoesEncerramento: new Date('2026-08-23T23:59:59-03:00'),
  pagamentoLimite:        new Date('2026-08-26T23:59:59-03:00'),
  editalPdfUrl: '/concurso/edital-bolsas-esportivas-2027.pdf',
} as const

export function inscricoesAbertas(agora: Date = new Date()): boolean {
  return agora >= CONCURSO.inscricoesAbertura && agora <= CONCURSO.inscricoesEncerramento
}
