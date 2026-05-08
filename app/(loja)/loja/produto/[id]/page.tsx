import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ProductDetailClient } from './ProductDetailClient'
import { normalizarProduto, normalizarVariantes } from '@/lib/produtos/normalizers'
import type { Produto, Aluno, ProdutoVariante } from '@/types/database'

function coerceString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'bigint') return String(value)
  return fallback
}

function coerceOptionalString(value: unknown): string | null {
  const normalized = coerceString(value).trim()
  return normalized ? normalized : null
}

function coerceStringArray(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => coerceOptionalString(item))
      .filter((item): item is string => !!item)

    return normalized.length > 0 ? normalized : null
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null

    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) {
        const normalized = parsed
          .map((item) => coerceOptionalString(item))
          .filter((item): item is string => !!item)

        return normalized.length > 0 ? normalized : null
      }
    } catch {
      // Legacy rows may still store comma-separated strings.
    }

    const normalized = trimmed
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    return normalized.length > 0 ? normalized : null
  }

  return null
}

function coerceNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const normalized = Number(value.replace(',', '.'))
    if (Number.isFinite(normalized)) return normalized
  }
  return fallback
}

function coerceNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  return coerceNumber(value, 0)
}

function coerceBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function coerceDateString(value: unknown): string | null {
  const normalized = coerceOptionalString(value)
  if (!normalized) return null
  return Number.isFinite(new Date(normalized).getTime()) ? normalized : null
}

function coerceImageUrl(value: unknown): string | null {
  const normalized = coerceOptionalString(value)
  if (!normalized) return null

  try {
    const parsed = new URL(normalized)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? normalized : null
  } catch {
    return null
  }
}

function sanitizeProduto(raw: Produto): Produto {
  const metodos = (coerceStringArray(raw.metodos_aceitos) ?? ['pix']).filter((metodo) =>
    ['pix', 'cartao', 'boleto'].includes(metodo)
  ) as Produto['metodos_aceitos']

  return {
    ...raw,
    id: coerceOptionalString(raw.id) ?? 'produto-sem-id',
    escola_id: coerceOptionalString(raw.escola_id) ?? '',
    nome: coerceOptionalString(raw.nome) ?? 'Produto',
    descricao: coerceOptionalString(raw.descricao),
    preco: coerceNumber(raw.preco, 0),
    categoria: coerceOptionalString(raw.categoria) ?? 'outros',
    metodos_aceitos: metodos.length > 0 ? metodos : ['pix'],
    max_parcelas: Math.max(1, Math.floor(coerceNumber(raw.max_parcelas, 1))),
    prazo_compra: coerceDateString(raw.prazo_compra),
    data_evento: coerceDateString(raw.data_evento),
    hora_evento: coerceOptionalString(raw.hora_evento),
    local_evento: coerceOptionalString(raw.local_evento),
    gera_ingresso: coerceBoolean(raw.gera_ingresso),
    capacidade: coerceNullableNumber(raw.capacidade),
    series: coerceStringArray(raw.series),
    variantes: coerceStringArray(raw.variantes),
    icon: coerceOptionalString(raw.icon),
    imagem_url: coerceImageUrl(raw.imagem_url),
    preco_promocional: coerceNullableNumber(raw.preco_promocional),
    aceita_vouchers: coerceBoolean(raw.aceita_vouchers),
    estoque: coerceNullableNumber(raw.estoque),
    exige_termo: coerceBoolean(raw.exige_termo),
    texto_termo: coerceOptionalString(raw.texto_termo),
    ativo: coerceBoolean(raw.ativo, true),
    esgotado: coerceBoolean(raw.esgotado),
    created_at: coerceOptionalString(raw.created_at) ?? new Date(0).toISOString(),
  }
}

function sanitizeVariante(raw: ProdutoVariante, index: number, produtoId: string, createdAt: string): ProdutoVariante {
  return {
    ...raw,
    id: coerceOptionalString(raw.id) ?? `variante-${index}`,
    produto_id: coerceOptionalString(raw.produto_id) ?? produtoId,
    nome: coerceOptionalString(raw.nome) ?? `Opcao ${index + 1}`,
    disponivel: coerceBoolean(raw.disponivel, true),
    estoque: coerceNullableNumber(raw.estoque),
    reservado: coerceNullableNumber(raw.reservado),
    ordem: Math.max(0, Math.floor(coerceNumber(raw.ordem, index))),
    created_at: coerceOptionalString(raw.created_at) ?? createdAt,
  }
}

function sanitizeAluno(raw: unknown): Aluno | null {
  if (!raw || typeof raw !== 'object') return null

  const aluno = raw as Partial<Aluno>
  const nome = coerceOptionalString(aluno.nome)
  if (!nome) return null

  return {
    id: coerceOptionalString(aluno.id) ?? `aluno-${nome.toLowerCase().replace(/\s+/g, '-')}`,
    nome,
    serie: coerceOptionalString(aluno.serie) ?? 'Serie nao informada',
    turma: coerceOptionalString(aluno.turma),
    escola_id: coerceOptionalString(aluno.escola_id) ?? '',
    cor: coerceOptionalString(aluno.cor),
    ativo: coerceBoolean(aluno.ativo, true),
    created_at: coerceOptionalString(aluno.created_at) ?? new Date(0).toISOString(),
  }
}

export default async function ProdutoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ aluno?: string }>
}) {
  const { id } = await params
  const { aluno: alunoId } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: produto }, { data: vinculos }] = await Promise.all([
    supabase.from('produtos').select('*, variantes_rel:produto_variantes(*)').eq('id', id).single(),
    supabase
      .from('responsavel_aluno')
      .select('aluno:alunos(*)')
      .eq('responsavel_id', user.id),
  ])

  if (!produto) notFound()

  const produtoNormalizado = sanitizeProduto(
    normalizarProduto(produto as Produto & { variantes_rel?: ProdutoVariante[] | null })
  )
  const variantesDetalhadas = normalizarVariantes(produto as Produto & { variantes_rel?: ProdutoVariante[] | null })
    .map((variante, index) => sanitizeVariante(variante, index, produtoNormalizado.id, produtoNormalizado.created_at))

  const alunos: Aluno[] = (vinculos ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((v: any) => sanitizeAluno(v.aluno))
    .filter((aluno): aluno is Aluno => !!aluno && aluno.ativo)

  const selectedAluno = alunos.find((aluno) => aluno.id === alunoId) ?? alunos[0] ?? null

  return (
    <ProductDetailClient
      produto={produtoNormalizado}
      variantesDetalhadas={variantesDetalhadas}
      alunos={alunos}
      initialAlunoId={selectedAluno?.id ?? null}
    />
  )
}
