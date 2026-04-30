import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { StoreHero } from '@/components/loja/StoreHero'
import { CategoryFilter, CATEGORIAS } from '@/components/loja/CategoryFilter'
import { StoreSearch } from '@/components/loja/StoreSearch'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProductCard } from '@/components/loja/ProductCard'
import type {
  Aluno,
  CategoriaProduto,
  Produto,
  Responsavel,
  Escola,
} from '@/types/database'
import { ESCOLA_FALLBACK } from '@/lib/escola/getEscola'

function fmtBRL(value: number) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function LojaPage({
  searchParams,
}: {
  searchParams: Promise<{ aluno?: string; categoria?: string; q?: string }>
}) {
  const { aluno: alunoId, q } = await searchParams
  const currentTimeMs = Date.now()
  const normalizedQuery = q?.trim().toLocaleLowerCase('pt-BR') ?? ''

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Dados iniciais
  const [{ data: vinculos }, { data: resp }, { data: allProdutosRaw }] = await Promise.all([
    supabase.from('responsavel_aluno').select('aluno:alunos(*)').eq('responsavel_id', user.id),
    supabase.from('responsaveis').select('*, escola:escolas(*)').eq('id', user.id).single(),
    supabase.from('produtos').select('*').eq('ativo', true).order('created_at', { ascending: false }),
  ])

  const responsavel = resp as unknown as Responsavel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const escola: Escola = (resp as any)?.escola ?? ESCOLA_FALLBACK
  
  const alunos: Aluno[] = (vinculos ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((v: any) => v.aluno as Aluno | null)
    .filter((aluno): aluno is Aluno => !!aluno && aluno.ativo)

  const selectedAluno = alunos.find((aluno) => aluno.id === alunoId) ?? alunos[0] ?? null
  const escolaId = responsavel?.escola_id

  const allProdutos = (allProdutosRaw ?? []).filter(p =>
    (!escolaId || p.escola_id === escolaId)
  )
  const produtos: Produto[] = allProdutos
  const produtosComCapacidade = produtos.filter((produto) => produto.capacidade !== null)
  const idsCapacidade = produtosComCapacidade.map(p => p.id)

  // Vagas limitadas
  const { data: ingressosRaw } = idsCapacidade.length > 0
      ? await supabase.from('ingressos').select('produto_id').in('produto_id', idsCapacidade).in('status', ['emitido', 'usado'])
      : { data: [] }

  const vagasMap: Record<string, number | null> = {}
  const countMap: Record<string, number> = {}
  for (const row of ingressosRaw ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pid = (row as any).produto_id as string
    countMap[pid] = (countMap[pid] ?? 0) + 1
  }
  for (const produto of produtosComCapacidade) {
    vagasMap[produto.id] = Math.max(0, (produto.capacidade ?? 0) - (countMap[produto.id] ?? 0))
  }

  const produtosPorAluno = selectedAluno
    ? produtos.filter((produto) => !produto.series || produto.series.length === 0 || produto.series.includes(selectedAluno.serie))
    : produtos

  const produtosFiltradosPorBusca = normalizedQuery
    ? produtosPorAluno.filter((produto) => {
        const haystack = `${produto.nome} ${produto.descricao ?? ''}`.toLocaleLowerCase('pt-BR')
        return haystack.includes(normalizedQuery)
      })
    : produtosPorAluno

  const sortedProdutos = [...produtosFiltradosPorBusca].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const counts: Partial<Record<CategoriaProduto | 'todas', number>> = { todas: sortedProdutos.length }
  for (const produto of sortedProdutos) {
    counts[produto.categoria] = (counts[produto.categoria] ?? 0) + 1
  }

  const grouped = sortedProdutos.reduce<Record<string, Produto[]>>((acc, produto) => {
    if (!acc[produto.categoria]) acc[produto.categoria] = []
    acc[produto.categoria].push(produto)
    return acc
  }, {})

  const urgentes = sortedProdutos.filter((produto) => {
    if (!produto.prazo_compra || produto.esgotado) return false
    const diff = Math.ceil((new Date(produto.prazo_compra).getTime() - currentTimeMs) / 86400000)
    return diff >= 0 && diff <= 4
  })

  const shouldShowFlatResults = normalizedQuery.length > 0

  return (
    <div className="pb-[100px]">
      {/* 1. Hero */}
      <StoreHero 
        responsavel={responsavel} 
        escola={escola} 
        selectedAluno={selectedAluno}
        alunos={alunos}
      />

      {/* 4. Urgency Strip (Prazos Encerrando) */}
      {!shouldShowFlatResults && urgentes.length > 0 && selectedAluno && (
        <div style={{ padding: '12px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', marginBottom: 7 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626' }} className="animate-pulse-red" />
            <div style={{ fontSize: 10, fontWeight: 800, color: '#dc2626', letterSpacing: '.07em', textTransform: 'uppercase' }}>
              Prazos encerrando
            </div>
          </div>
          
          <div className="no-scrollbar" style={{ display: 'flex', gap: 9, overflowX: 'auto', padding: '0 14px 10px' }}>
            {urgentes.map((produto) => {
              const diff = Math.ceil((new Date(produto.prazo_compra!).getTime() - currentTimeMs) / 86400000)

              return (
                <Link
                  key={produto.id}
                  href={`/loja/produto/${produto.id}?aluno=${selectedAluno.id}`}
                  style={{
                    width: 145, background: 'linear-gradient(135deg,#1a0505,#2d0a0a)',
                    border: '1px solid rgba(220,38,38,.3)', borderRadius: 15, padding: 12,
                    display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0,
                    textDecoration: 'none'
                  }}
                >
                  <div style={{ fontSize: 20 }}>{produto.icon ?? '📦'}</div>
                  
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.9)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {produto.nome}
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 'auto' }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#f87171', letterSpacing: '-.03em', lineHeight: 1 }}>
                        {diff === 0 ? 'Hoje' : `${diff} dias`}
                      </div>
                      <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(248,113,113,.6)', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                        restante{diff !== 0 && 's'}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'white', background: 'rgba(220,38,38,.4)', padding: '3px 6px', borderRadius: 6 }}>
                      {fmtBRL(produto.preco_promocional ?? produto.preco).replace(',00', '')}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {!selectedAluno ? (
        <div style={{ padding: '40px 20px' }}>
          <EmptyState
            icon="👨‍👩‍👧‍👦"
            title="Nenhum aluno cadastrado"
            description="Adicione seus filhos para liberar a home personalizada, a cantina e os produtos da série correta."
            actionLabel="➕ Adicionar meu filho"
            actionHref="/perfil/alunos?onboarding=1"
          />
        </div>
      ) : (
        <>
          {/* 5. Barra de Busca */}
          <Suspense>
            <StoreSearch
              initialQuery={normalizedQuery}
              resultCount={sortedProdutos.length}
            />
          </Suspense>

          {/* 6. Filtro de Categorias */}
          {!shouldShowFlatResults && sortedProdutos.length > 0 && (
            <Suspense>
              <CategoryFilter counts={counts} />
            </Suspense>
          )}

          {/* 7. Lista de Produtos */}
          <section style={{ padding: '14px 18px 0' }}>
            {sortedProdutos.length === 0 ? (
              <EmptyState
                icon="📭"
                title="Nenhum produto encontrado"
                description={
                  normalizedQuery
                    ? `Nenhum produto encontrado para "${normalizedQuery}".`
                    : 'A escola ainda não publicou itens para este perfil.'
                }
              />
            ) : shouldShowFlatResults ? (
              <div style={{ display: 'grid', gap: 12 }}>
                {sortedProdutos.map((produto, i) => (
                  <ProductCard key={produto.id} produto={produto} aluno={selectedAluno} index={i} vagasRestantes={vagasMap[produto.id] ?? null} />
                ))}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 28 }}>
                {Object.entries(grouped).map(([categoriaKey, produtosCategoria]) => (
                  <section key={categoriaKey} data-cat-key={categoriaKey} style={{ display: 'grid', gap: 12, scrollMarginTop: 120 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: -2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 18 }}>{CATEGORIAS[categoriaKey as CategoriaProduto]?.icon ?? '📦'}</span>
                        <h2 style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.02em', color: 'var(--text-1)', margin: 0 }}>
                          {CATEGORIAS[categoriaKey as CategoriaProduto]?.label ?? categoriaKey}
                        </h2>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>
                          {produtosCategoria.length}
                        </span>
                      </div>
                      <Link
                        href={`/loja/categoria/${categoriaKey}?aluno=${selectedAluno.id}`}
                        style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-soft)', padding: '5px 10px', borderRadius: 999, textDecoration: 'none' }}
                      >
                        Ver tudo
                      </Link>
                    </div>

                    <div style={{ display: 'grid', gap: 12 }}>
                      {produtosCategoria.map((produto, i) => (
                        <ProductCard key={produto.id} produto={produto} aluno={selectedAluno} index={i} vagasRestantes={vagasMap[produto.id] ?? null} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
