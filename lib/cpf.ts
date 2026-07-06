// Utilitários de CPF compartilhados entre login/cadastro (app/actions/auth.ts)
// e convite de equipe (app/actions/configuracoes/usuarios.ts).

export function limparCPF(cpf: string) {
  return cpf.replace(/[^0-9]/g, '')
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
