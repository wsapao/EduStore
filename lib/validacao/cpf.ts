// Validação de CPF (documento pessoal brasileiro), compartilhada entre
// o fluxo de login/cadastro e outros formulários públicos (ex.: concurso de bolsas).
export function limparCPF(cpf: string) {
  return cpf.replace(/[^0-9]/g, '')
}

// Máscara parcial p/ exibição em contextos administrativos (LGPD):
// mantém apenas os 3 primeiros dígitos e os 2 verificadores.
export function mascaraCpf(cpf: string): string {
  const c = limparCPF(cpf)
  if (c.length !== 11) return '***'
  return `${c.slice(0, 3)}.***.***-${c.slice(9)}`
}

export function validarCPF(cpf: string): boolean {
  const c = limparCPF(cpf)
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false
  let soma = 0
  for (let i = 0; i < 9; i++) soma += parseInt(c[i]) * (10 - i)
  let resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(c[9])) return false
  soma = 0
  for (let i = 0; i < 10; i++) soma += parseInt(c[i]) * (11 - i)
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  return resto === parseInt(c[10])
}
