import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ProductDetailClient } from './ProductDetailClient'
import { normalizarProduto, normalizarVariantes } from '@/lib/produtos/normalizers'
import type { Produto, Aluno, ProdutoVariante } from '@/types/database'

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

  const produtoNormalizado = normalizarProduto(produto as Produto & { variantes_rel?: ProdutoVariante[] | null })
  const variantesDetalhadas = normalizarVariantes(produto as Produto & { variantes_rel?: ProdutoVariante[] | null })

  const alunos: Aluno[] = (vinculos ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((v: any) => v.aluno as Aluno | null)
    .filter((a): a is Aluno => !!a && a.ativo)

  const selectedAluno = alunos.find(a => a.id === alunoId) ?? alunos[0] ?? null

  return (
    <ProductDetailClient
      produto={produtoNormalizado}
      variantesDetalhadas={variantesDetalhadas}
      alunos={alunos}
      initialAlunoId={selectedAluno?.id ?? null}
    />
  )
}
