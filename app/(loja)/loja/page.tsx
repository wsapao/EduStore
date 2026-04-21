import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { ChildSelector } from '@/components/loja/ChildSelector'
import { CategoryFilter } from '@/components/loja/CategoryFilter'
import { StoreSearch } from '@/components/loja/StoreSearch'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProductCard } from '@/components/loja/ProductCard'
import type {
  Aluno,
  CantinaCarteira,
  CategoriaProduto,
  Pagamento,
  Pedido,
  Produto,
  StatusPagamento,
  StatusPedido,
} from '@/types/database'

const CAT_LABELS: Record<CategoriaProduto, string> = {
  eventos: '🎉 Eventos',
  passeios: '🚌 Passeios',
  segunda_chamada: '📝 2a Chamada',
  materiais: '📚 Materiais',
  uniforme: '👕 Uniforme',
  outros: '📦 Outros',
}

type PedidoMini = Pick<Pedido, 'id' | 'numero' | 'status' | 'total' | 'created_at'> & {
  pagamento: Pick<Pagamento, 'status'> | Pick<Pagamento, 'status'>[] | null
}

export default async function LojaPage({
  searchParams,
}: {
  searchParams: Promise<{ aluno?: string; categoria?: string; q?: string; ordem?: string; min?: string; max?: string }>
}) {
  const { aluno: alunoId, categoria, q, ordem, min, max } = await searchParams
  const currentTimeMs = Date.now()
  const normalizedQuery = q?.trim().toLocaleLowerCase('pt-BR') ?? ''
  const normalizedSort = ordem === 'menor_preco' || ordem === 'maior_preco' ? ordem : 'recentes'
  const minPrice = parsePriceParam(min)
  const maxPrice = parsePriceParam(max)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: vinculos }, { data: responsavel }, { data: allProdutosRaw }] = await Promise.all([
    supabase.from('responsavel_aluno').select('aluno:alunos(*)').eq('responsavel_id', user.id),
    supabase.from('responsaveis').select('nome, escola_id').eq('id', user.id).single(),
    supabase.from('produtos').select('*').eq('ativo', true).order('created_at', { ascending: false }),
  ])

  const alunos: Aluno[] = (vinculos ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((v: any) => v.aluno as Aluno | null)
    .filter((aluno): aluno is Aluno => !!aluno && aluno.ativo)

  const selectedAluno = alunos.find((aluno) => aluno.id === alunoId) ?? alunos[0] ?? null
  const escolaId = responsavel?.escola_id

  // filtra por escola e categoria em JS (já buscados em paralelo)
  const allProdutos = (allProdutosRaw ?? []).filter(p =>
    (!escolaId || p.escola_id === escolaId) &&
    (!categoria || p.categoria === categoria)
  )
  const produtos: Produto[] = allProdutos ?? []

  const produtosComCapacidade = produtos.filter((produto) => produto.capacidade !== null)
  const vagasMap: Record<string, number | null> = {}
  if (produtosComCapacidade.length > 0) {
    const ids = produtosComCapacidade.map((produto) => produto.id)
    const { data: counts } = await supabase
      .from('ingressos')
      .select('produto_id')
      .in('produto_id', ids)
      .in('status', ['emitido', 'usado'])

    const countMap: Record<string, number> = {}
    for (const row of counts ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      countMap[(row as any).produto_id] = (countMap[(row as any).produto_id] ?? 0) + 1
    }

    for (const produto of produtosComCapacidade) {
      vagasMap[produto.id] = Math.max(0, (produto.capacidade ?? 0) - (countMap[produto.id] ?? 0))
    }
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

  const filteredProdutos = produtosFiltradosPorBusca.filter((produto) => {
    if (minPrice !== null && produto.preco < minPrice) return false
    if (maxPrice !== null && produto.preco > maxPrice) return false
    return true
  })

  const sortedProdutos = [...filteredProdutos].sort((a, b) => {
    if (normalizedSort === 'menor_preco') return a.preco - b.preco
    if (normalizedSort === 'maior_preco') return b.preco - a.preco
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const counts: Partial<Record<CategoriaProduto | 'todas', number>> = { todas: filteredProdutos.length }
  for (const produto of filteredProdutos) {
    counts[produto.categoria] = (counts[produto.categoria] ?? 0) + 1
  }

  const grouped = sortedProdutos.reduce<Record<string, Produto[]>>((acc, produto) => {
    if (!acc[produto.categoria]) acc[produto.categoria] = []
    acc[produto.categoria].push(produto)
    return acc
  }, {})

  const urgentes = sortedProdutos.filter((produto) => {
    if (!produto.prazo_compra || produto.esgotado) return false
    const diff = (new Date(produto.prazo_compra).getTime() - currentTimeMs) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= 3
  })

  const upcomingEvents = sortedProdutos
    .filter((produto) => produto.data_evento && new Date(produto.data_evento).getTime() >= currentTimeMs)
    .sort((a, b) => new Date(a.data_evento!).getTime() - new Date(b.data_evento!).getTime())
    .slice(0, 3)

  const shouldShowFlatResults =
    normalizedSort !== 'recentes' || minPrice !== null || maxPrice !== null || normalizedQuery.length > 0

  const [{ data: pedidosRecentes }, { data: carteiraAluno }, { data: pedidosCantinaPendentes }] = await Promise.all([
    supabase
      .from('pedidos')
      .select('id, numero, status, total, created_at, pagamento:pagamentos(status)')
      .eq('responsavel_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3),
    selectedAluno
      ? supabase
          .from('cantina_carteiras')
          .select('*')
          .eq('aluno_id', selectedAluno.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    selectedAluno
      ? supabase
          .from('cantina_pedidos')
          .select('id')
          .eq('aluno_id', selectedAluno.id)
          .in('status', ['aberto', 'confirmado', 'pronto'])
      : Promise.resolve({ data: [] }),
  ])

  const pendingPedidos = ((pedidosRecentes ?? []) as PedidoMini[]).filter((pedido) => pedido.status === 'pendente')
  const pixExpiradoCount = pendingPedidos.filter((pedido) => paymentStatus(pedido.pagamento) === 'expirado').length

  const resumoCards = [
    {
      label: 'Produtos disponiveis',
      value: sortedProdutos.length,
      note: selectedAluno ? `Para ${selectedAluno.nome.split(' ')[0]}` : 'Sem aluno selecionado',
      bg: 'linear-gradient(135deg, #eef2ff, #e0e7ff)',
    },
    {
      label: 'Pendencias',
      value: pendingPedidos.length,
      note: pixExpiradoCount > 0 ? `${pixExpiradoCount} PIX expirado(s)` : 'Tudo em acompanhamento',
      bg: 'linear-gradient(135deg, #fff7ed, #ffedd5)',
    },
    {
      label: 'Prazos criticos',
      value: urgentes.length,
      note: urgentes.length > 0 ? 'Compras que acabam em breve' : 'Sem urgencias por agora',
      bg: 'linear-gradient(135deg, #fef2f2, #fee2e2)',
    },
    {
      label: 'Cantina',
      value: carteiraAluno ? fmtBRL(Number((carteiraAluno as CantinaCarteira).saldo)) : 'Nao ativa',
      note: carteiraAluno ? `${(pedidosCantinaPendentes ?? []).length} pedido(s) em aberto` : 'Ative a carteira para usar',
      bg: 'linear-gradient(135deg, #ecfeff, #cffafe)',
    },
  ]

  const nextDeadline = sortedProdutos
    .filter((produto) => produto.prazo_compra && new Date(produto.prazo_compra).getTime() >= currentTimeMs)
    .sort((a, b) => new Date(a.prazo_compra!).getTime() - new Date(b.prazo_compra!).getTime())[0]

  return (
    <>
      <Suspense>
        <ChildSelector alunos={alunos} />
      </Suspense>

      <section className="px-5 pt-5 animate-fade-in">
        <div className="relative overflow-hidden rounded-[28px] p-8 bg-gradient-to-tr from-brand via-brand-mid to-blue-900 text-white shadow-2xl">
          {/* Background effects */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)', backgroundSize: '16px 16px' }} />
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-400 rounded-full mix-blend-screen filter blur-[100px] opacity-30 animate-pulse" />

          <div className="relative flex flex-col gap-5 z-10">
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-[10px] font-bold tracking-widest uppercase backdrop-blur-md">
                Painel da Família
              </span>
              <span className="text-sm font-medium text-white/70">
                Tudo o que importa antes de entrar na vitrine.
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <h1 className="text-3xl md:text-4xl lg:text-[40px] leading-tight font-black tracking-tight max-w-2xl text-transparent bg-clip-text bg-gradient-to-r from-white to-white/80">
                {selectedAluno
                  ? `${selectedAluno.nome.split(' ')[0]} em foco: compras, prazos e cantina em uma única tela.`
                  : 'Sua central da escola agora prioriza contexto, não só produtos.'}
              </h1>
            </div>

            {selectedAluno && (
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge>{selectedAluno.serie}{selectedAluno.turma ? ` · Turma ${selectedAluno.turma}` : ''}</Badge>
                <Badge>{sortedProdutos.length} opções disponíveis</Badge>
                {pendingPedidos.length > 0 && <Badge>{pendingPedidos.length} pedido(s) em acompanhamento</Badge>}
                {nextDeadline && <Badge>Prazo mais próximo: {fmtShortDate(nextDeadline.prazo_compra!)}</Badge>}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="px-5 pt-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {resumoCards.map((card) => (
            <article
              key={card.label}
              className={`rounded-[22px] p-5 border shadow-sm transition-transform hover:-translate-y-1 ${card.bg}`}
              style={{ borderColor: 'rgba(255,255,255,0.45)' }}
            >
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                {card.label}
              </div>
              <div className="text-[28px] font-black tracking-tight text-slate-900 mt-2">
                {card.value}
              </div>
              <div className="text-xs text-slate-600 font-medium mt-1.5 leading-relaxed">
                {card.note}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="px-5 pt-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { href: '/pedidos', title: 'Meus pedidos', desc: 'Acompanhe pagamento, comprovantes e histórico.', accent: 'text-blue-600', bg: 'bg-blue-600/10' },
            { href: '/cantina', title: 'Cantina', desc: 'Veja saldo, limites e pedidos do aluno.', accent: 'text-teal-600', bg: 'bg-teal-600/10' },
            { href: '/perfil/alunos', title: 'Meus filhos', desc: 'Gerencie alunos, série e vínculos da conta.', accent: 'text-purple-600', bg: 'bg-purple-600/10' },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="premium-card p-5 group flex flex-col no-underline text-slate-900"
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg mb-3 transition-transform group-hover:scale-110 ${action.bg} ${action.accent}`}
              >
                →
              </div>
              <div className="text-[15px] font-extrabold">{action.title}</div>
              <div className="text-[13px] text-slate-500 leading-relaxed mt-1">{action.desc}</div>
            </Link>
          ))}
        </div>
      </section>

      {(pendingPedidos.length > 0 || upcomingEvents.length > 0 || urgentes.length > 0) && (
        <section className="px-5 pt-5">
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
            <article className="premium-card p-5">
              <PanelHeader
                eyebrow="Acompanhar agora"
                title="Pendências e pedidos"
                description="O responsável precisa entender o que exige ação, não procurar isso no menu."
              />

              <div className="grid gap-3">
                {pendingPedidos.length > 0 ? (
                  pendingPedidos.map((pedido) => (
                    <Link
                      key={pedido.id}
                      href={`/pedido/${pedido.id}`}
                      className="group flex flex-col gap-2 p-4 rounded-xl border border-slate-200 bg-slate-50 no-underline text-slate-900 transition-colors hover:bg-slate-100 hover:border-slate-300"
                    >
                      <div className="flex justify-between items-center gap-3">
                        <strong className="text-[14px] group-hover:text-brand transition-colors">Pedido #{pedido.numero.replace('PED-', '')}</strong>
                        <span style={statusPillStyle(paymentStatus(pedido.pagamento) === 'expirado' ? 'PIX expirado' : 'Aguardando')} />
                      </div>
                      <div className="text-xs text-slate-500 leading-relaxed">
                        Total {fmtBRL(Number(pedido.total))} · criado em {fmtShortDate(pedido.created_at)}
                      </div>
                    </Link>
                  ))
                ) : (
                  <EmptyPanel text="Nenhum pedido pendente. A experiência aqui deve transmitir tranquilidade e previsibilidade." />
                )}
              </div>
            </article>

            <article className="premium-card p-5">
              <PanelHeader
                eyebrow="Agenda escolar"
                title="O que vem por aí"
                description="Eventos e prazos precisam aparecer antes da busca para reduzir esquecimento."
              />

              <div className="grid gap-3">
                {[...urgentes.slice(0, 2), ...upcomingEvents].slice(0, 3).map((produto) => (
                  <Link
                    key={produto.id}
                    href={`/loja/produto/${produto.id}?${selectedAluno ? `aluno=${selectedAluno.id}` : ''}`}
                    className="group flex flex-col gap-2 p-4 rounded-xl border border-slate-200 bg-slate-50 no-underline text-slate-900 transition-colors hover:bg-slate-100 hover:border-slate-300"
                  >
                    <div className="flex justify-between gap-3">
                      <strong className="text-[14px] group-hover:text-brand transition-colors">{produto.nome}</strong>
                      <span className="text-xl">{produto.icon ?? '📌'}</span>
                    </div>
                    <div className="text-xs text-slate-500 leading-relaxed">
                      {produto.data_evento
                        ? `Evento em ${fmtShortDate(produto.data_evento)}`
                        : produto.prazo_compra
                          ? `Compra até ${fmtShortDate(produto.prazo_compra)}`
                          : 'Sem data definida'}
                    </div>
                  </Link>
                ))}
                {upcomingEvents.length === 0 && urgentes.length === 0 && (
                  <EmptyPanel text="Sem eventos ou prazos para destacar neste momento." />
                )}
              </div>
            </article>
          </div>
        </section>
      )}

      <Suspense>
        <StoreSearch
          key={`${q ?? ''}|${normalizedSort}|${min ?? ''}|${max ?? ''}`}
          initialQuery={q ?? ''}
          initialSort={normalizedSort}
          initialMinPrice={min ?? ''}
          initialMaxPrice={max ?? ''}
          resultCount={sortedProdutos.length}
        />
      </Suspense>

      <Suspense>
        <CategoryFilter counts={counts} />
      </Suspense>

      {urgentes.length > 0 && !categoria && !normalizedQuery && minPrice === null && maxPrice === null && normalizedSort === 'recentes' && (
        <section style={{ padding: '20px 20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--danger)',
                animation: 'pulse-red 1.5s ease infinite',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--danger)',
                textTransform: 'uppercase',
                letterSpacing: '.06em',
              }}
            >
              Encerra em breve
            </span>
          </div>
          {urgentes.map((produto) => (
            selectedAluno && (
              <Link
                key={produto.id}
                href={`/loja/produto/${produto.id}?aluno=${selectedAluno.id}`}
                style={{
                  textDecoration: 'none',
                  background: 'var(--surface)',
                  border: '1.5px solid #fecaca',
                  borderRadius: 'var(--r-lg)',
                  padding: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  boxShadow: 'var(--shadow-xs)',
                  marginBottom: 10,
                  color: 'inherit',
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 'var(--r-md)',
                    background: 'var(--danger-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                    flexShrink: 0,
                  }}
                >
                  {produto.icon ?? '⚠️'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-.01em' }}>{produto.nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600, marginTop: 3 }}>
                    Fecha em {Math.ceil((new Date(produto.prazo_compra!).getTime() - currentTimeMs) / (1000 * 60 * 60 * 24))} dia(s) · {selectedAluno.serie}
                  </div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', whiteSpace: 'nowrap' }}>
                  {fmtBRL(produto.preco)}
                </div>
              </Link>
            )
          ))}
        </section>
      )}

      {!selectedAluno && (
        <div style={{ padding: '40px 20px' }}>
          <EmptyState
            icon="👨‍👩‍👧‍👦"
            title="Nenhum aluno cadastrado"
            description="Adicione seus filhos para liberar a home personalizada, a cantina e os produtos da serie correta."
            actionLabel="➕ Adicionar meu filho"
            actionHref="/perfil/alunos?onboarding=1"
          />
        </div>
      )}

      {selectedAluno && (
        <section style={{ padding: '20px 20px 0' }}>
          {sortedProdutos.length === 0 ? (
            <EmptyState
              icon="📭"
              title="Nenhum produto disponivel"
              description={
                normalizedQuery
                  ? `Nenhum produto encontrado para "${q}".`
                  : minPrice !== null || maxPrice !== null
                    ? 'Nenhum produto ficou dentro da faixa de preco escolhida.'
                    : categoria
                      ? 'Nenhum produto nesta categoria para o aluno selecionado.'
                      : 'A escola ainda nao publicou itens para este perfil.'
              }
              actionLabel={normalizedQuery || categoria || minPrice !== null || maxPrice !== null ? "Limpar filtros" : undefined}
              actionHref={normalizedQuery || categoria || minPrice !== null || maxPrice !== null ? "/loja" : undefined}
            />
          ) : shouldShowFlatResults ? (
            <div style={{ display: 'grid', gap: 14 }}>
              {sortedProdutos.map((produto, i) => (
                <ProductCard key={produto.id} produto={produto} aluno={selectedAluno} index={i} vagasRestantes={vagasMap[produto.id] ?? null} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 22 }}>
              {Object.entries(grouped).map(([categoriaKey, produtosCategoria]) => (
                <section key={categoriaKey} style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <h2 style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-.03em', color: 'var(--text-1)', margin: 0 }}>
                        {CAT_LABELS[categoriaKey as CategoriaProduto]}
                      </h2>
                      <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '4px 0 0' }}>
                        {produtosCategoria.length} {produtosCategoria.length === 1 ? 'opcao' : 'opcoes'} para {selectedAluno.nome.split(' ')[0]}
                      </p>
                    </div>
                    <Link
                      href={`/loja?${buildCategoryHref(categoriaKey, selectedAluno.id)}`}
                      style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textDecoration: 'none' }}
                    >
                      Ver tudo
                    </Link>
                  </div>

                  <div style={{ display: 'grid', gap: 14 }}>
                    {produtosCategoria.map((produto, i) => (
                      <ProductCard key={produto.id} produto={produto} aluno={selectedAluno} index={i} vagasRestantes={vagasMap[produto.id] ?? null} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  )
}

function parsePriceParam(value?: string) {
  if (!value) return null
  const normalized = Number(value)
  return Number.isFinite(normalized) && normalized >= 0 ? normalized : null
}

function paymentStatus(payment: PedidoMini['pagamento']): StatusPagamento | null {
  if (!payment) return null
  return Array.isArray(payment) ? payment[0]?.status ?? null : payment.status
}

function buildCategoryHref(categoria: string, alunoId: string) {
  const params = new URLSearchParams()
  params.set('categoria', categoria)
  params.set('aluno', alunoId)
  return params.toString()
}

function fmtBRL(value: number) {
  return Number(value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtShortDate(date: string) {
  return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '7px 12px',
        borderRadius: 999,
        background: 'rgba(255,255,255,.12)',
        border: '1px solid rgba(255,255,255,.16)',
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  )
}

function PanelHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div style={{ display: 'grid', gap: 4, marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
        {eyebrow}
      </div>
      <h2 style={{ fontSize: 19, fontWeight: 900, letterSpacing: '-.03em', color: 'var(--text-1)', margin: 0 }}>
        {title}
      </h2>
      <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-3)', margin: 0 }}>{description}</p>
    </div>
  )
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div
      style={{
        borderRadius: 'var(--r-lg)',
        border: '1px dashed var(--border-strong)',
        background: 'var(--surface-2)',
        padding: '18px 16px',
        fontSize: 13,
        color: 'var(--text-3)',
        lineHeight: 1.6,
      }}
    >
      {text}
    </div>
  )
}

function statusPillStyle(text: string) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    background: text === 'PIX expirado' ? '#ffedd5' : '#fef3c7',
    color: text === 'PIX expirado' ? '#9a3412' : '#92400e',
  } as const
}

const panelStyle = {
  background: 'var(--surface)',
  border: '1.5px solid var(--border)',
  borderRadius: 'var(--r-xl)',
  padding: 18,
  boxShadow: 'var(--shadow-xs)',
} as const
