export interface AlunoNomeExibicao {
  /** Nome usado em destaque (hero): primeiro nome, estendido até desambiguar irmãos. */
  primeiro: string
  /** Nome usado em cartões/listas: primeiro + último nome, ou o prefixo desambiguado. */
  curto: string
}

function palavras(nome: string | null | undefined): string[] {
  return (nome ?? '').split(' ').filter(Boolean)
}

function chave(words: string[], len: number): string {
  return words
    .slice(0, len)
    .join(' ')
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * Calcula nomes de exibição para um conjunto de alunos (irmãos da mesma conta).
 * Irmãos com o mesmo primeiro nome (ex.: "Maria Alícia" e "Maria Sofia") ganham
 * prefixos maiores até ficarem distinguíveis, em vez de ambos virarem "Maria Oliveira".
 */
export function buildAlunoNomesExibicao(
  alunos: Array<{ id: string; nome: string | null | undefined }>,
): Map<string, AlunoNomeExibicao> {
  const words = alunos.map((aluno) => palavras(aluno.nome))
  const prefixLens = words.map((w) => Math.min(1, w.length))

  let mudou = true
  while (mudou) {
    mudou = false
    const grupos = new Map<string, number[]>()
    words.forEach((w, i) => {
      if (w.length === 0) return
      const k = chave(w, prefixLens[i])
      grupos.set(k, [...(grupos.get(k) ?? []), i])
    })
    for (const indices of grupos.values()) {
      if (indices.length < 2) continue
      for (const i of indices) {
        if (prefixLens[i] < words[i].length) {
          prefixLens[i] += 1
          mudou = true
        }
      }
    }
  }

  const resultado = new Map<string, AlunoNomeExibicao>()
  alunos.forEach((aluno, i) => {
    const w = words[i]
    if (w.length === 0) {
      resultado.set(aluno.id, { primeiro: '', curto: '' })
      return
    }
    const primeiro = w.slice(0, prefixLens[i]).join(' ')
    const curto = prefixLens[i] > 1 || w.length === 1
      ? primeiro
      : `${w[0]} ${w[w.length - 1]}`
    resultado.set(aluno.id, { primeiro, curto })
  })
  return resultado
}
