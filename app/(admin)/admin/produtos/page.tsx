import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { toggleProdutoAtivoAction, toggleEsgotadoAction, duplicarProdutoAction, excluirProdutoAction } from '@/app/actions/admin'
import type { Produto, CategoriaProduto, MetodoPagamento, ProdutoVariante } from '@/types/database'

function fmtBRL(v: number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const CAT_ICONS: Record<CategoriaProduto, string> = {
  eventos: '🎉', passeios: '🚌', segunda_chamada: '📝',
  materiais: '📚', uniforme: '👕', outros: '📦',
}

const CAT_LABELS: Record<CategoriaProduto, string> = {
  eventos: 'Evento', passeios: 'Passeio', segunda_chamada: '2ª Chamada',
  materiais: 'Material', uniforme: 'Uniforme', outros: 'Outros',
}

const METODO_ICONS: Record<MetodoPagamento, string> = {
  pix: '⚡', cartao: '💳', boleto: '📄',
}

export default async function AdminProdutos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') redirect('/loja')

  const { q, page } = await searchParams
  const busca = q?.trim() ?? ''
  const currentPage = Math.max(1, Number.parseInt(page ?? '1', 10) || 1)
  const pageSize = 12
  const from = (currentPage - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('produtos')
    .select('*, variantes_rel:produto_variantes(*)')
    .order('created_at', { ascending: false })

  if (busca) {
    query = query.or(`nome.ilike.%${busca}%,descricao.ilike.%${busca}%`)
  }

  const { data: produtos } = await query.range(from, to)

  let countQuery = supabase.from('produtos').select('id', { count: 'exact', head: true })
  if (busca) {
    countQuery = countQuery.or(`nome.ilike.%${busca}%,descricao.ilike.%${busca}%`)
  }
  const { count: totalFiltrado } = await countQuery

  const { data: resumo } = await supabase.from('produtos').select('id, ativo, esgotado')
  const ativos = (resumo ?? []).filter((p) => p.ativo).length
  const inativos = (resumo ?? []).filter((p) => !p.ativo).length
  const esgotados = (resumo ?? []).filter((p) => p.esgotado).length
  const totalPages = Math.max(1, Math.ceil((totalFiltrado ?? 0) / pageSize))

  const lista = (produtos ?? []) as Array<Produto & { variantes_rel?: ProdutoVariante[] | null }>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 80 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-.02em' }}>
            Produtos
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
            {totalFiltrado ?? 0} produtos encontrados · {ativos} ativos · {inativos} inativos · {esgotados} esgotados
          </p>
        </div>

        <Link href="/admin/produtos/novo" style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          height: 38, padding: '0 16px', borderRadius: 8,
          background: 'var(--brand)', color: '#fff',
          fontSize: 13, fontWeight: 700, textDecoration: 'none',
          boxShadow: '0 2px 8px rgba(26,47,90,.25)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Novo produto
        </Link>
      </div>

      <form style={{
        background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: 14,
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      }}>
        <input
          name="q"
          defaultValue={busca}
          placeholder="Buscar por nome ou descrição"
          style={{
            flex: 1, minWidth: 240, height: 42, borderRadius: 10, border: '1.5px solid #e2e8f0',
            background: '#f8fafc', padding: '0 14px', fontSize: 14, color: '#0f172a', fontFamily: 'inherit',
          }}
        />
        <button type="submit" style={actionButton('#0f172a', '#fff', 'none')}>
          Buscar
        </button>
        {busca && (
          <Link href="/admin/produtos" style={actionButton('#eef2ff', '#4338ca', '1px solid #c7d2fe')}>
            Limpar
          </Link>
        )}
      </form>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 14,
      }}>
        {lista.map((produto) => {
          const cat = produto.categoria as CategoriaProduto
          const isAtivo = produto.ativo
          const isEsgotado = produto.esgotado
          const variantes = (produto.variantes_rel ?? []).sort((a, b) => a.ordem - b.ordem)
          const variantesDisponiveis = variantes.filter((variante) => variante.disponivel && (variante.estoque === null || variante.estoque > 0))
          const variantesSemEstoque = variantes.filter((variante) => variante.disponivel && variante.estoque === 0)
          const variantesBaixoEstoque = variantes.filter((variante) => variante.disponivel && variante.estoque !== null && variante.estoque > 0 && variante.estoque <= 3)
          const variantesIndisponiveis = variantes.filter((variante) => !variante.disponivel)

          return (
            <div key={produto.id} style={{
              background: '#fff',
              border: `1.5px solid ${!isAtivo ? '#fecaca' : isEsgotado ? '#fed7aa' : '#e2e8f0'}`,
              borderRadius: 12, overflow: 'hidden',
              opacity: isAtivo ? 1 : 0.7,
            }}>
              <div style={{
                padding: '14px 16px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: '#f1f5f9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, flexShrink: 0,
                }}>
                  {produto.icon ?? CAT_ICONS[cat] ?? '📦'}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 700, color: '#0f172a',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {produto.nome}
                  </div>
                  <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: '#6366f1',
                      background: '#eef2ff', padding: '2px 7px', borderRadius: 4,
                    }}>
                      {CAT_LABELS[cat]}
                    </span>
                    {!isAtivo && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: '#991b1b',
                        background: '#fee2e2', padding: '2px 7px', borderRadius: 4,
                      }}>
                        INATIVO
                      </span>
                    )}
                    {isEsgotado && isAtivo && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: '#92400e',
                        background: '#fef3c7', padding: '2px 7px', borderRadius: 4,
                      }}>
                        ESGOTADO
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>PREÇO</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                    {fmtBRL(produto.preco)}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>MÉTODOS</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(produto.metodos_aceitos ?? []).map((m) => (
                      <span key={m} title={m} style={{ fontSize: 16 }}>
                        {METODO_ICONS[m as MetodoPagamento]}
                      </span>
                    ))}
                  </div>
                </div>

                {produto.data_evento && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>EVENTO</span>
                    <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>
                      {new Date(produto.data_evento).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                )}

                {produto.prazo_compra && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>PRAZO</span>
                    <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>
                      {new Date(produto.prazo_compra).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                )}

                {produto.series && produto.series.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>SÉRIES</span>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '60%' }}>
                      {produto.series.map((serie) => (
                        <span key={serie} style={{
                          fontSize: 10, fontWeight: 600, color: '#374151',
                          background: '#f1f5f9', padding: '2px 6px', borderRadius: 4,
                        }}>
                          {serie}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {variantes.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>VARIANTES</span>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, maxWidth: '65%' }}>
                        <span style={{ fontSize: 11, color: '#374151', fontWeight: 700 }}>
                          {variantesDisponiveis.length}/{variantes.length} prontas para venda
                        </span>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <StockPill tone={variantesSemEstoque.length > 0 ? 'danger' : 'neutral'}>
                            {variantesSemEstoque.length} sem estoque
                          </StockPill>
                          <StockPill tone={variantesBaixoEstoque.length > 0 ? 'warning' : 'neutral'}>
                            {variantesBaixoEstoque.length} baixo estoque
                          </StockPill>
                          <StockPill tone={variantesIndisponiveis.length > 0 ? 'muted' : 'neutral'}>
                            {variantesIndisponiveis.length} indisponíveis
                          </StockPill>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {variantes.map((variante) => {
                        const semEstoque = variante.estoque === 0
                        const baixoEstoque = variante.estoque !== null && variante.estoque > 0 && variante.estoque <= 3
                        const prontaParaVenda = variante.disponivel && !semEstoque

                        return (
                          <span key={variante.id} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            fontSize: 10, fontWeight: 800, padding: '4px 7px', borderRadius: 999,
                            border: `1px solid ${!variante.disponivel ? '#d1d5db' : semEstoque ? '#fecaca' : baixoEstoque ? '#fde68a' : '#c7d2fe'}`,
                            color: !variante.disponivel ? '#6b7280' : semEstoque ? '#b91c1c' : baixoEstoque ? '#92400e' : '#4338ca',
                            background: !variante.disponivel ? '#f3f4f6' : semEstoque ? '#fef2f2' : baixoEstoque ? '#fffbeb' : '#eef2ff',
                            textDecoration: !variante.disponivel ? 'line-through' : 'none',
                          }}>
                            <span>{variante.nome}</span>
                            <span style={{ opacity: 0.85 }}>
                              {!variante.disponivel ? 'off' : variante.estoque === null ? 'livre' : prontaParaVenda ? `${variante.estoque} un` : '0 un'}
                            </span>
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div style={{
                padding: '10px 14px',
                borderTop: '1px solid #f1f5f9',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Link href={`/admin/produtos/${produto.id}/editar`} style={{
                    flex: 1, padding: '7px 10px', borderRadius: 7,
                    fontSize: 12, fontWeight: 700, textAlign: 'center',
                    background: '#eff6ff', color: '#1d4ed8',
                    textDecoration: 'none', border: '1px solid #bfdbfe',
                  }}>
                    ✏️ Editar
                  </Link>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <form action={duplicarProdutoAction.bind(null, produto.id) as any} style={{ flex: 1 }}>
                    <button type="submit" style={{
                      width: '100%', padding: '7px 10px', borderRadius: 7,
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      background: '#f5f3ff', color: '#6d28d9',
                      border: '1px solid #ddd6fe',
                    }}>
                      📋 Duplicar
                    </button>
                  </form>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <form action={toggleProdutoAtivoAction.bind(null, produto.id, isAtivo) as any} style={{ flex: 1 }}>
                    <button type="submit" style={{
                      width: '100%', padding: '7px 10px', borderRadius: 7,
                      fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
                      background: isAtivo ? '#fee2e2' : '#dcfce7',
                      color: isAtivo ? '#991b1b' : '#166534',
                    }}>
                      {isAtivo ? '⏸ Desativar' : '▶ Ativar'}
                    </button>
                  </form>

                  {isAtivo && (
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    <form action={toggleEsgotadoAction.bind(null, produto.id, isEsgotado) as any} style={{ flex: 1 }}>
                      <button type="submit" style={{
                        width: '100%', padding: '7px 10px', borderRadius: 7,
                        fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
                        background: isEsgotado ? '#d1fae5' : '#fef3c7',
                        color: isEsgotado ? '#065f46' : '#92400e',
                      }}>
                        {isEsgotado ? '↩ Reativar' : '🚫 Esgotar'}
                      </button>
                    </form>
                  )}
                </div>

                {/* Linha 3: Excluir (só se inativo, para evitar acidentes) */}
                {!isAtivo && (
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  <form action={excluirProdutoAction.bind(null, produto.id) as any}>
                    <button
                      type="submit"
                      onClick={e => { if (!confirm(`Excluir "${produto.nome}" permanentemente?`)) e.preventDefault() }}
                      style={{
                        width: '100%', padding: '7px 10px', borderRadius: 7,
                        fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        background: 'transparent', color: '#94a3b8',
                        border: '1px dashed #e2e8f0',
                      }}
                    >
                      🗑 Excluir produto
                    </button>
                  </form>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {lista.length === 0 && (
        <div style={{
          background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12,
          padding: '60px 20px', textAlign: 'center',
          fontSize: 14, color: '#94a3b8',
        }}>
          Nenhum produto cadastrado.
        </div>
      )}

      {totalPages > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
            Página {currentPage} de {totalPages}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link
              href={currentPage > 1 ? buildPageHref('/admin/produtos', { q: busca || undefined, page: String(currentPage - 1) }) : '#'}
              style={pagerButton(currentPage > 1)}
            >
              ← Anterior
            </Link>
            <Link
              href={currentPage < totalPages ? buildPageHref('/admin/produtos', { q: busca || undefined, page: String(currentPage + 1) }) : '#'}
              style={pagerButton(currentPage < totalPages)}
            >
              Próxima →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function StockPill({ children, tone }: {
  children: React.ReactNode
  tone: 'neutral' | 'warning' | 'danger' | 'muted'
}) {
  const styles: Record<typeof tone, { color: string; background: string; border: string }> = {
    neutral: { color: '#475569', background: '#f8fafc', border: '#e2e8f0' },
    warning: { color: '#92400e', background: '#fffbeb', border: '#fde68a' },
    danger: { color: '#b91c1c', background: '#fef2f2', border: '#fecaca' },
    muted: { color: '#6b7280', background: '#f3f4f6', border: '#d1d5db' },
  }

  return (
    <span style={{
      fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '3px 8px',
      color: styles[tone].color, background: styles[tone].background,
      border: `1px solid ${styles[tone].border}`,
    }}>
      {children}
    </span>
  )
}

function buildPageHref(pathname: string, params: Record<string, string | undefined>) {
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) sp.set(key, value)
  }
  const query = sp.toString()
  return query ? `${pathname}?${query}` : pathname
}

function actionButton(background: string, color: string, border: string) {
  return {
    height: 36,
    padding: '0 12px',
    borderRadius: 999,
    background,
    color,
    border,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as const
}

function pagerButton(enabled: boolean) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    padding: '0 12px',
    borderRadius: 999,
    textDecoration: 'none',
    fontSize: 12,
    fontWeight: 700,
    background: enabled ? '#0f172a' : '#e5e7eb',
    color: enabled ? '#fff' : '#94a3b8',
    pointerEvents: enabled ? 'auto' : 'none',
  } as const
}
