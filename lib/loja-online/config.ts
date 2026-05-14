import type { LojaFuncionamentoSlot } from '@/types/database'

export type { LojaFuncionamentoSlot } from '@/types/database'

type BuildCategoriasHomeInput = {
  categoriasConfig: string[] | null
  categoriasDescobertas: string[]
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_RE.test(value)
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function uniqueStrings(values: readonly string[]) {
  const result: string[] = []
  const seen = new Set<string>()

  for (const value of values) {
    const normalized = value.trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }

  return result
}

export function normalizeLojaFuncionamento(raw: unknown): LojaFuncionamentoSlot[] {
  if (!Array.isArray(raw)) return []

  const slots: LojaFuncionamentoSlot[] = []

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue

    const dia = Number((item as { dia?: unknown }).dia)
    const inicio = (item as { inicio?: unknown }).inicio
    const fim = (item as { fim?: unknown }).fim

    if (!Number.isInteger(dia) || dia < 0 || dia > 6) continue
    if (!isValidTime(inicio) || !isValidTime(fim)) continue
    if (toMinutes(inicio) >= toMinutes(fim)) continue

    slots.push({ dia, inicio, fim })
  }

  return slots.sort((left, right) => {
    if (left.dia !== right.dia) return left.dia - right.dia
    return toMinutes(left.inicio) - toMinutes(right.inicio)
  })
}

export function isLojaDisponivelAgora(
  slots: LojaFuncionamentoSlot[],
  now = new Date(),
) {
  if (slots.length === 0) return true

  const diaAtual = now.getDay()
  const minutoAtual = now.getHours() * 60 + now.getMinutes()

  return slots.some((slot) => {
    if (slot.dia !== diaAtual) return false

    const inicio = toMinutes(slot.inicio)
    const fim = toMinutes(slot.fim)

    return minutoAtual >= inicio && minutoAtual < fim
  })
}

export function buildCategoriasHome({
  categoriasConfig,
  categoriasDescobertas,
}: BuildCategoriasHomeInput) {
  const discovered = uniqueStrings(categoriasDescobertas)

  if (categoriasConfig === null) return discovered

  const allowed = new Set(discovered)
  return uniqueStrings(categoriasConfig).filter((categoria) => allowed.has(categoria))
}

export function pickProdutosDestaque<T extends { id: string }>(
  ids: readonly string[] | null | undefined,
  produtos: readonly T[],
) {
  if (!ids || ids.length === 0) return []

  const produtosById = new Map(produtos.map((produto) => [produto.id, produto]))
  const result: T[] = []
  const seen = new Set<string>()

  for (const id of ids) {
    const normalized = id.trim()
    if (!normalized || seen.has(normalized)) continue

    const produto = produtosById.get(normalized)
    if (!produto) continue

    seen.add(normalized)
    result.push(produto)

    if (result.length === 6) break
  }

  return result
}
