import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'

import {
  CategoryFilter,
  type CategoryTab,
} from '@/components/loja/CategoryFilter'
import { ProductCard } from '@/components/loja/ProductCard'
import { StoreHero } from '@/components/loja/StoreHero'
import { StoreSearch } from '@/components/loja/StoreSearch'
import { EmptyState } from '@/components/ui/EmptyState'
import { getDefaultCategoryMeta } from '@/lib/categorias/defaults'
import { ESCOLA_FALLBACK } from '@/lib/escola/getEscola'
import {
  buildLojaCategoryHref,
  filterGroupedEntriesByCategory,
  resolveSelectedCategoryKey,
} from '@/lib/loja/browse'
import {
  buildCategoriasHome,
  isLojaDisponivelAgora,
  normalizeLojaFuncionamento,
  pickProdutosDestaque,
} from '@/lib/loja-online/config'
import { produtoDisponivelParaSerie } from '@/lib/crm/series-core'
import { createClient } from '@/lib/supabase/server'
import type {
  Aluno,
  Categoria,
  Escola,
  EscolaConfiguracoes,
  Produto,
  Responsavel,
} from '@/types/database'

function fmtBRL(value: number) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function LojaPage({
  searchParams,
}: {
  searchParams: Promise<{ aluno?: string; categoria?: string; q?: string }>
}) {
  const { aluno: alunoId, categoria, q } = await searchParams
  const currentTimeMs = Date.now()
  const normalizedQuery = q?.trim().toLocaleLowerCase('pt-BR') ?? ''

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: vinculos }, { data: resp }] = await Promise.all([
    supabase.from('responsavel_aluno').select('aluno:alunos(*)').eq('responsavel_id', user.id),
    supabase.from('responsaveis').select('*, escola:escolas(*)').eq('id', user.id).single(),
  ])

  const responsavel = resp as unknown as Responsavel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const escola: Escola = (resp as any)?.escola ?? ESCOLA_FALLBACK
  const escolaId = responsavel?.escola_id

  const alunos: Aluno[] = (vinculos ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((v: any) => v.aluno as Aluno | null)
    .filter((aluno): aluno is Aluno => !!aluno && aluno.ativo)

  const selectedAluno = alunos.find((aluno) => aluno.id === alunoId) ?? alunos[0] ?? null

  let produtos: Produto[] = []
  let configRaw: EscolaConfiguracoes | null = null
  let categoriasRaw: Array<Pick<Categoria, 'nome' | 'icone'>> = []

  if (escolaId) {
    const [{ data: produtosData }, { data: configData }, { data: categoriasData }] = await Promise.all([
      supabase
        .from('produtos')
        .select('*')
        .eq('escola_id', escolaId)
        .eq('ativo', true)
        .order('created_at', { ascending: false }),
      supabase
        .from('escola_configuracoes')
        .select('*')
        .eq('escola_id', escolaId)
        .maybeSingle<EscolaConfiguracoes>(),
      supabase
        .from('categorias_produto')
        .select('nome, icone')
        .eq('escola_id', escolaId)
        .eq('ativo', true)
        .order('nome', { ascending: true }),
    ])

    produtos = (produtosData ?? []) as Produto[]
    configRaw = configData
    categoriasRaw = (categoriasData ?? []) as Array<Pick<Categoria, 'nome' | 'icone'>>
  }

  const lojaConfig = normalizeLojaConfig(configRaw)
  const lojaAbertaAgora = isLojaDisponivelAgora(lojaConfig.loja_funcionamento)

  const produtosComCapacidade = produtos.filter((produto) => produto.capacidade !== null)
  const idsCapacidade = produtosComCapacidade.map((produto) => produto.id)
  const { data: ingressosRaw } = idsCapacidade.length > 0
    ? await supabase
      .from('ingressos')
      .select('produto_id')
      .in('produto_id', idsCapacidade)
      .in('status', ['emitido', 'usado'])
    : { data: [] }

  const countMap: Record<string, number> = {}
  for (const row of ingressosRaw ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const produtoId = (row as any).produto_id as string
    countMap[produtoId] = (countMap[produtoId] ?? 0) + 1
  }

  const vagasMap: Record<string, number | null> = {}
  for (const produto of produtosComCapacidade) {
    vagasMap[produto.id] = Math.max(0, (produto.capacidade ?? 0) - (countMap[produto.id] ?? 0))
  }

  const produtosPorAluno = selectedAluno
    ? produtos.filter((produto) => produtoDisponivelParaSerie(produto.series, selectedAluno.serie))
    : produtos

  const produtosFiltradosPorBusca = normalizedQuery
    ? produtosPorAluno.filter((produto) => {
      const haystack = `${produto.nome} ${produto.descricao ?? ''}`.toLocaleLowerCase('pt-BR')
      return haystack.includes(normalizedQuery)
    })
    : produtosPorAluno

  const sortedProdutos = [...produtosFiltradosPorBusca].sort((left, right) => {
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  })

  const counts: Partial<Record<string, number>> = { todas: sortedProdutos.length }
  for (const produto of sortedProdutos) {
    counts[produto.categoria] = (counts[produto.categoria] ?? 0) + 1
  }

  const grouped = sortedProdutos.reduce<Record<string, Produto[]>>((acc, produto) => {
    if (!acc[produto.categoria]) acc[produto.categoria] = []
    acc[produto.categoria].push(produto)
    return acc
  }, {})

  const visibleCategoryKeys = buildCategoriasHome({
    categoriasConfig: lojaConfig.categorias_home_visiveis,
    categoriasDescobertas: sortedProdutos.map((produto) => produto.categoria),
  })

  const categoryTabs: CategoryTab[] = visibleCategoryKeys
    .filter((categoryKey) => (counts[categoryKey] ?? 0) > 0)
    .map((categoryKey) => ({
      key: categoryKey,
      ...getCategoryPresentation(categoryKey, categoriasRaw),
    }))

  const groupedEntries = visibleCategoryKeys
    .map((categoryKey) => [categoryKey, grouped[categoryKey] ?? []] as const)
    .filter(([, produtosCategoria]) => produtosCategoria.length > 0)

  const selectedCategoryKey = resolveSelectedCategoryKey(categoria, visibleCategoryKeys)
  const selectedCategoryMeta = selectedCategoryKey
    ? getCategoryPresentation(selectedCategoryKey, categoriasRaw)
    : null
  const visibleGroupedEntries = filterGroupedEntriesByCategory(groupedEntries, selectedCategoryKey)

  const urgentes = sortedProdutos.filter((produto) => {
    if (!produto.prazo_compra || produto.esgotado) return false
    const diff = Math.ceil((new Date(produto.prazo_compra).getTime() - currentTimeMs) / 86400000)
    return diff >= 0 && diff <= 4
  })

  const destaques = pickProdutosDestaque(lojaConfig.produtos_home_destaque, sortedProdutos)
  const shouldShowFlatResults = normalizedQuery.length > 0
  const productListStyle = getProductListStyle(lojaConfig.layout_home)

  return (
    <div className="pb-[100px]">
      <StoreHero
        responsavel={responsavel}
        escola={escola}
        selectedAluno={selectedAluno}
        alunos={alunos}
      />

      <SchoolBrandIntro escola={escola} />

      {lojaConfig.modo_manutencao ? (
        <div style={{ padding: '36px 20px 0' }}>
          <EmptyState
            icon="🛠️"
            title="Loja temporariamente em manutenção"
            description={
              lojaConfig.modo_manutencao_mensagem
              ?? 'Estamos fazendo ajustes rápidos na loja. Tente novamente em breve.'
            }
          />
        </div>
      ) : (
        <>
          {!lojaAbertaAgora && (
            <div style={{ padding: '14px 14px 0' }}>
              <div style={warningBannerStyle}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#a05a00', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Loja fechada neste horário
                </div>
                <div style={{ fontSize: 13, color: '#7a4a10', lineHeight: 1.5 }}>
                  A vitrine continua visível, mas novos pedidos só podem ser finalizados durante o horário configurado pela escola.
                </div>
              </div>
            </div>
          )}

          {!shouldShowFlatResults && urgentes.length > 0 && selectedAluno && (
            <div style={{ padding: '12px 0 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', marginBottom: 7 }}>
                <div
                  style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff383c' }}
                  className="animate-pulse-red"
                />
                <div style={{ fontSize: 10, fontWeight: 800, color: '#ff383c', letterSpacing: '.07em', textTransform: 'uppercase' }}>
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
                        width: 145,
                        background: 'linear-gradient(135deg,#1c1c1e,#2c2c2e)',
                        border: '1px solid rgba(255,66,69,.35)',
                        borderRadius: 16,
                        padding: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        flexShrink: 0,
                        textDecoration: 'none',
                      }}
                    >
                      <div style={{ fontSize: 20 }}>{produto.icon ?? '📦'}</div>

                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'rgba(255,255,255,.9)',
                          lineHeight: 1.3,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {produto.nome}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 'auto' }}>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: '#ff4245', letterSpacing: '-.03em', lineHeight: 1 }}>
                            {diff === 0 ? 'Hoje' : `${diff} dias`}
                          </div>
                          <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,66,69,.65)', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                            restante{diff !== 0 && 's'}
                          </div>
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'white', background: 'rgba(255,66,69,.4)', padding: '3px 6px', borderRadius: 999 }}>
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
                description="Adicione seus filhos para liberar a home personalizada, a cantina e os produtos da serie correta."
                actionLabel="➕ Adicionar meu filho"
                actionHref="/perfil/alunos?onboarding=1"
              />
            </div>
          ) : (
            <>
              <Suspense>
                <StoreSearch initialQuery={normalizedQuery} resultCount={sortedProdutos.length} />
              </Suspense>

              {!shouldShowFlatResults && sortedProdutos.length > 0 && !selectedCategoryKey && (
                <Suspense>
                  <CategoryFilter counts={counts} tabs={categoryTabs} />
                </Suspense>
              )}

              <section style={{ padding: '14px 18px 0' }}>
                {selectedCategoryMeta && selectedAluno && !shouldShowFlatResults && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '0 2px 12px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 12,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 18,
                        }}
                      >
                        {selectedCategoryMeta.icon}
                      </div>
                      <div style={{ display: 'grid', gap: 2 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
                          Categoria
                        </span>
                        <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.02em', color: 'var(--text-1)' }}>
                          {selectedCategoryMeta.label}
                        </span>
                      </div>
                    </div>

                    <Link
                      href={`/loja?aluno=${selectedAluno.id}`}
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--accent)',
                        background: 'var(--accent-soft)',
                        padding: '6px 12px',
                        borderRadius: 999,
                        textDecoration: 'none',
                      }}
                    >
                      ← Voltar para todas
                    </Link>
                  </div>
                )}

                {sortedProdutos.length === 0 ? (
                  <EmptyState
                    icon="📭"
                    title="Nenhum produto encontrado"
                    description={
                      normalizedQuery
                        ? `Nenhum produto encontrado para "${normalizedQuery}".`
                        : 'A escola ainda nao publicou itens para este perfil.'
                    }
                  />
                ) : shouldShowFlatResults ? (
                  <div style={productListStyle}>
                    {sortedProdutos.map((produto, index) => (
                      <ProductCard
                        key={produto.id}
                        produto={produto}
                        aluno={selectedAluno}
                        index={index}
                        vagasRestantes={vagasMap[produto.id] ?? null}
                        layout={lojaConfig.layout_home}
                        showLowStockBadge={lojaConfig.mostrar_estoque_baixo}
                      />
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 28 }}>
                    {!selectedCategoryKey && destaques.length > 0 && (
                      <section style={{ display: 'grid', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 18 }}>⭐</span>
                          <h2 style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.02em', color: 'var(--text-1)', margin: 0 }}>
                            Destaques da escola
                          </h2>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>
                            {destaques.length}
                          </span>
                        </div>

                        <div style={productListStyle}>
                          {destaques.map((produto, index) => (
                            <ProductCard
                              key={produto.id}
                              produto={produto}
                              aluno={selectedAluno}
                              index={index}
                              vagasRestantes={vagasMap[produto.id] ?? null}
                              layout={lojaConfig.layout_home}
                              showLowStockBadge={lojaConfig.mostrar_estoque_baixo}
                            />
                          ))}
                        </div>
                      </section>
                    )}

                    {visibleGroupedEntries.map(([categoryKey, produtosCategoria]) => {
                      const meta = getCategoryPresentation(categoryKey, categoriasRaw)

                      return (
                        <section key={categoryKey} data-cat-key={categoryKey} style={{ display: 'grid', gap: 12, scrollMarginTop: 120 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: -2 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 18 }}>{meta.icon}</span>
                              <h2 style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.02em', color: 'var(--text-1)', margin: 0 }}>
                                {meta.label}
                              </h2>
                              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>
                                {produtosCategoria.length}
                              </span>
                            </div>
                            {!selectedCategoryKey && (
                              <Link
                                href={buildLojaCategoryHref(categoryKey, selectedAluno.id)}
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: 'var(--accent)',
                                  background: 'var(--accent-soft)',
                                  padding: '5px 10px',
                                  borderRadius: 999,
                                  textDecoration: 'none',
                                }}
                              >
                                Ver tudo
                              </Link>
                            )}
                          </div>

                          <div style={productListStyle}>
                            {produtosCategoria.map((produto, index) => (
                              <ProductCard
                                key={produto.id}
                                produto={produto}
                                aluno={selectedAluno}
                                index={index}
                                vagasRestantes={vagasMap[produto.id] ?? null}
                                layout={lojaConfig.layout_home}
                                showLowStockBadge={lojaConfig.mostrar_estoque_baixo}
                              />
                            ))}
                          </div>
                        </section>
                      )
                    })}
                  </div>
                )}
              </section>
            </>
          )}

          {lojaConfig.texto_rodape && (
            <footer style={footerStyle}>
              {lojaConfig.texto_rodape}
            </footer>
          )}
        </>
      )}
    </div>
  )
}

function SchoolBrandIntro({ escola }: { escola: Escola }) {
  if (!escola.banner_url && !escola.slogan && !escola.texto_boas_vindas) return null

  return (
    <div style={{ padding: '14px 14px 0' }}>
      {escola.banner_url && (
        <div
          style={{
            width: '100%',
            aspectRatio: '32 / 10',
            borderRadius: 16,
            overflow: 'hidden',
            marginBottom: 12,
            background: '#1c1c1e',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={escola.banner_url}
            alt={escola.nome}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      )}

      {(escola.slogan || escola.texto_boas_vindas) && (
        <div style={{ padding: '0 4px 4px' }}>
          {escola.slogan && (
            <div style={{ fontSize: 16, fontWeight: 700, color: '#000000', letterSpacing: '-.01em', marginBottom: 2 }}>
              {escola.slogan}
            </div>
          )}
          {escola.texto_boas_vindas && (
            <div style={{ fontSize: 12, fontWeight: 500, color: '#3c3c43', lineHeight: 1.4 }}>
              {escola.texto_boas_vindas}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function normalizeLojaConfig(config: EscolaConfiguracoes | null): {
  modo_manutencao: boolean
  modo_manutencao_mensagem: string | null
  loja_funcionamento: EscolaConfiguracoes['loja_funcionamento']
  categorias_home_visiveis: string[] | null
  produtos_home_destaque: string[]
  layout_home: 'grid' | 'lista'
  mostrar_estoque_baixo: boolean
  texto_rodape: string | null
} {
  return {
    modo_manutencao: config?.modo_manutencao ?? false,
    modo_manutencao_mensagem: config?.modo_manutencao_mensagem ?? null,
    loja_funcionamento: normalizeLojaFuncionamento(config?.loja_funcionamento ?? []),
    categorias_home_visiveis: Array.isArray(config?.categorias_home_visiveis)
      ? config.categorias_home_visiveis
      : null,
    produtos_home_destaque: Array.isArray(config?.produtos_home_destaque)
      ? config.produtos_home_destaque
      : [],
    layout_home: config?.layout_home === 'lista' ? 'lista' : 'grid',
    mostrar_estoque_baixo: config?.mostrar_estoque_baixo ?? true,
    texto_rodape: config?.texto_rodape ?? null,
  }
}

function getCategoryPresentation(
  categoryKey: string,
  categorias: Array<Pick<Categoria, 'nome' | 'icone'>>,
) {
  const fromDb = categorias.find((categoria) => categoria.nome === categoryKey)
  const fallback = getDefaultCategoryMeta(categoryKey)

  return {
    label: fromDb?.nome ?? fallback.label,
    icon: fromDb?.icone || fallback.icon,
  }
}

function getProductListStyle(layout: 'grid' | 'lista'): React.CSSProperties {
  if (layout === 'grid') {
    return {
      display: 'grid',
      gap: 12,
      // auto-fill (não auto-fit): seção com 1 produto mantém card em largura de
      // coluna em vez de esticar até a largura toda da tela no desktop.
      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
      alignItems: 'start',
    }
  }

  return {
    display: 'grid',
    gap: 12,
  }
}

const warningBannerStyle: React.CSSProperties = {
  display: 'grid',
  gap: 4,
  borderRadius: 18,
  border: '1px solid rgba(255,141,40,.35)',
  background: 'linear-gradient(135deg,rgba(255,141,40,.14),rgba(255,146,48,.2))',
  padding: '14px 16px',
}

const footerStyle: React.CSSProperties = {
  margin: '28px 18px 0',
  padding: '16px 18px',
  borderRadius: 18,
  background: 'rgba(118,118,128,.1)',
  color: '#3c3c43',
  fontSize: 12,
  lineHeight: 1.6,
  textAlign: 'center',
}
