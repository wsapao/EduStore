// tests/qa/fixtures/data.ts
// Toolkit de dados "como um humano": CPF válido, nomes, e-mails e arquivos aleatórios.
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function cpfCheckDigit(nums: number[], startWeight: number): number {
  const sum = nums.reduce((acc, n, i) => acc + n * (startWeight - i), 0)
  const rest = (sum * 10) % 11
  return rest === 10 ? 0 : rest
}

/** Gera um CPF de 11 dígitos com dígitos verificadores válidos (sem máscara). */
export function randomCPF(): string {
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))
  const d1 = cpfCheckDigit(base, 10)
  const d2 = cpfCheckDigit([...base, d1], 11)
  return [...base, d1, d2].join('')
}

/** Valida dígitos verificadores de um CPF (com ou sem máscara). */
export function isValidCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return false
  if (/^(\d)\1{10}$/.test(digits)) return false // rejeita 000... 111... etc.
  const nums = digits.split('').map(Number)
  const d1 = cpfCheckDigit(nums.slice(0, 9), 10)
  const d2 = cpfCheckDigit(nums.slice(0, 10), 11)
  return d1 === nums[9] && d2 === nums[10]
}

export function formatCPF(cpf: string): string {
  return cpf.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

const FIRST = ['Ana', 'Bruno', 'Carla', 'Diego', 'Eva', 'Felipe', 'Gabi', 'Hugo', 'Iris', 'João']
const LAST = ['Silva', 'Souza', 'Lima', 'Costa', 'Alves', 'Pereira', 'Rocha', 'Gomes']

/** Nome plausível com prefixo QA (facilita limpeza e identificação). */
export function randomName(): string {
  return `QA ${pick(FIRST)} ${pick(LAST)}`
}

/** E-mail único para a caixa de teste (domínio configurável via QA_TEST_EMAIL_DOMAIN). */
export function randomEmail(): string {
  const domain = process.env.QA_TEST_EMAIL_DOMAIN ?? 'qa.test'
  return `qa+${Date.now()}-${Math.floor(Math.random() * 1e4)}@${domain}`
}

/** Escreve um PNG 1x1 válido num arquivo temporário único e retorna o caminho. */
export function randomImageFile(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'qa-'))
  const file = path.join(dir, `qa-${Date.now()}.png`)
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  writeFileSync(file, Buffer.from(pngBase64, 'base64'))
  return file
}
