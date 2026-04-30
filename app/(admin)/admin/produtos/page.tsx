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

  const { data: produtos, error: erroQuery } = await query.range(from, to)

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 80 }}>
      {erroQuery && (
        <div style={{ background: '#7f1d1d', color: '#fef2f2', padding: 16, borderRadius: 12, border: '1px solid #b91c1c' }}>
          <strong>ERRO NA QUERY:</strong> {erroQuery.message} - {erroQuery.details}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#f8fafc', margin: 0, letterSpacing: '-.03em' }}>
            Produtos
          </h1>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '6px 0 0', fontWeight: 500 }}>
            {totalFiltrado ?? 0} produtos encontrados · {ativos} ativos · {inativos} inativos · {esgotados} esgotados
          </p>
        </div>

        <Link href="/admin/produtos/novo" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          height: 42, padding: '0 20px', borderRadius: 14,
          background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff',
          fontSize: 14, fontWeight: 800, textDecoration: 'none',
          boxShadow: '0 4px 14px rgba(59,130,246,.3)', transition: 'all .2s'
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Novo produto
        </Link>
      </div>

      {/* Search Bar */}
      <form style={{
        background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 16, padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', backdropFilter: 'blur(10px)'
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
          <svg style={{ position: 'absolute', left: 14, top: 12, color: '#64748b' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            name="q"
            defaultValue={busca}
            placeholder="Buscar por nome ou descrição..."
            style={{
              width: '100%', height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,.1)',
              background: 'rgba(0,0,0,.2)', padding: '0 14px 0 40px', fontSize: 14, color: '#f8fafc', fontFamily: 'inherit',
              outline: 'none', boxSizing: 'border-box'
            }}
          />
        </div>
        <button type="submit" style={actionButton('rgba(255,255,255,.1)', '#f8fafc', '1px solid rgba(255,255,255,.05)')}>
          Buscar
        </button>
        {busca && (
          <Link href="/admin/produtos" style={actionButton('rgba(239,68,68,.1)', '#fca5a5', '1px solid rgba(239,68,68,.2)')}>
            Limpar
          </Link>
        )}
      </form>

      {/* Grid de Produtos */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 16,
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
              background: 'rgba(255,255,255,.02)',
              border: `1.5px solid ${!isAtivo ? 'rgba(239,68,68,.3)' : isEsgotado ? 'rgba(245,158,11,.3)' : 'rgba(255,255,255,.06)'}`,
              borderRadius: 20, overflow: 'hidden', backdropFilter: 'blur(16px)',
              opacity: isAtivo ? 1 : 0.6, display: 'flex', flexDirection: 'column'
            }}>
              <div style={{
                padding: '20px',
                borderBottom: '1px solid rgba(255,255,255,.05)',
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, flexShrink: 0,
                }}>
                  {produto.icon ?? CAT_ICONS[cat] ?? '📦'}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 16, fontWeight: 800, color: '#f8fafc', letterSpacing: '-.02em',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {produto.nome}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 800, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '.05em',
                      background: 'rgba(59,130,246,.1)', padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(59,130,246,.2)'
                    }}>
                      {CAT_LABELS[cat]}
                    </span>
                    {!isAtivo && (
                      <span style={{
                        fontSize: 10, fontWeight: 800, color: '#fca5a5', textTransform: 'uppercase', letterSpacing: '.05em',
                        background: 'rgba(239,68,68,.1)', padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(239,68,68,.2)'
                      }}>
                        INATIVO
                      </span>
                    )}
                    {isEsgotado && isAtivo && (
                      <span style={{
                        fontSize: 10, fontWeight: 800, color: '#fcd34d', textTransform: 'uppercase', letterSpacing: '.05em',
                        background: 'rgba(245,158,11,.1)', padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(245,158,11,.2)'
                      }}>
                        ESGOTADO
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em' }}>Preço</span>
                  <span style={{ fontSize: 20, fontWeight: 900, color: '#10b981', letterSpacing: '-.03em' }}>
                    {fmtBRL(produto.preco)}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em' }}>Métodos</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(produto.metodos_aceitos ?? []).map((m) => (
                      <span key={m} title={m} style={{ fontSize: 18 }}>
                        {METODO_ICONS[m as MetodoPagamento]}
                      </span>
                    ))}
                  </div>
                </div>

                {produto.data_evento && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em' }}>Evento</span>
                    <span style={{ fontSize: 12, color: '#f8fafc', fontWeight: 700 }}>
                      {new Date(produto.data_evento).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                )}

                {produto.prazo_compra && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em' }}>Prazo</span>
                    <span style={{ fontSize: 12, color: '#f8fafc', fontWeight: 700 }}>
                      {new Date(produto.prazo_compra).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                )}

                {produto.series && produto.series.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em' }}>Séries</span>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '60%' }}>
                      {produto.series.map((serie) => (
                        <span key={serie} style={{
                          fontSize: 10, fontWeight: 700, color: '#e2e8f0',
                          background: 'rgba(255,255,255,.05)', padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,.1)'
                        }}>
                          {serie}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {variantes.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em' }}>Variantes</span>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, maxWidth: '70%' }}>
                        <span style={{ fontSize: 11, color: '#f8fafc', fontWeight: 800 }}>
                          {variantesDisponiveis.length}/{variantes.length} ativas
                        </span>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <StockPill tone={variantesSemEstoque.length > 0 ? 'danger' : 'neutral'}>
                            {variantesSemEstoque.length} sem estoque
                          </StockPill>
                          <StockPill tone={variantesBaixoEstoque.length > 0 ? 'warning' : 'neutral'}>
                            {variantesBaixoEstoque.length} baixo est.
                          </StockPill>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div style={{
                padding: '14px 20px',
                background: 'rgba(0,0,0,.15)', borderTop: '1px solid rgba(255,255,255,.05)',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Link href={`/admin/produtos/${produto.id}/editar`} style={{
                    flex: 1, padding: '10px', borderRadius: 10,
                    fontSize: 13, fontWeight: 800, textAlign: 'center',
                    background: 'rgba(59,130,246,.15)', color: '#60a5fa',
                    textDecoration: 'none', border: '1.5px solid rgba(59,130,246,.3)', transition: 'all .2s'
                  }}>
                    ✏️ Editar
                  </Link>
                  <form action={duplicarProdutoAction.bind(null, produto.id) as any} style={{ flex: 1 }}>
                    <button type="submit" style={{
                      width: '100%', padding: '10px', borderRadius: 10,
                      fontSize: 13, fontWeight: 800, cursor: 'pointer',
                      background: 'rgba(255,255,255,.05)', color: '#e2e8f0',
                      border: '1.5px solid rgba(255,255,255,.1)', transition: 'all .2s'
                    }}>
                      📋 Duplicar
                    </button>
                  </form>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <form action={toggleProdutoAtivoAction.bind(null, produto.id, isAtivo) as any} style={{ flex: 1 }}>
                    <button type="submit" style={{
                      width: '100%', padding: '10px', borderRadius: 10,
                      fontSize: 13, fontWeight: 800, cursor: 'pointer',
                      background: isAtivo ? 'rgba(239,68,68,.1)' : 'rgba(16,185,129,.15)',
                      color: isAtivo ? '#fca5a5' : '#34d399', border: isAtivo ? '1.5px solid rgba(239,68,68,.2)' : '1.5px solid rgba(16,185,129,.3)',
                    }}>
                      {isAtivo ? '⏸ Desativar' : '▶ Ativar'}
                    </button>
                  </form>

                  {isAtivo && (
                    <form action={toggleEsgotadoAction.bind(null, produto.id, isEsgotado) as any} style={{ flex: 1 }}>
                      <button type="submit" style={{
                        width: '100%', padding: '10px', borderRadius: 10,
                        fontSize: 13, fontWeight: 800, cursor: 'pointer',
                        background: isEsgotado ? 'rgba(16,185,129,.1)' : 'rgba(245,158,11,.15)',
                        color: isEsgotado ? '#34d399' : '#fbbf24', border: isEsgotado ? '1.5px solid rgba(16,185,129,.2)' : '1.5px solid rgba(245,158,11,.3)',
                      }}>
                        {isEsgotado ? '↩ Reativar' : '🚫 Esgotar'}
                      </button>
                    </form>
                  )}
                </div>

                {!isAtivo && (
                  <form action={excluirProdutoAction.bind(null, produto.id) as any}>
                    <button
                      type="submit"
                      onClick={e => { if (!confirm(`Excluir "${produto.nome}" permanentemente?`)) e.preventDefault() }}
                      style={{
                        width: '100%', padding: '10px', borderRadius: 10,
                        fontSize: 13, fontWeight: 800, cursor: 'pointer',
                        background: 'transparent', color: '#64748b',
                        border: '1.5px dashed rgba(255,255,255,.1)',
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

      {lista.length === 0 && !erroQuery && (
        <div style={{
          background: 'rgba(255,255,255,.02)', border: '1.5px dashed rgba(255,255,255,.1)', borderRadius: 20,
          padding: '80px 20px', textAlign: 'center', backdropFilter: 'blur(10px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12
        }}>
          <div style={{ fontSize: 40, opacity: 0.5 }}>📦</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc' }}>Nenhum produto cadastrado.</div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>Os produtos que você adicionar aparecerão aqui.</div>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          flexWrap: 'wrap', padding: '10px 0'
        }}>
          <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 700 }}>
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
    neutral: { color: '#94a3b8', background: 'rgba(255,255,255,.05)', border: 'rgba(255,255,255,.1)' },
    warning: { color: '#fbbf24', background: 'rgba(245,158,11,.1)', border: 'rgba(245,158,11,.2)' },
    danger: { color: '#fca5a5', background: 'rgba(239,68,68,.1)', border: 'rgba(239,68,68,.2)' },
    muted: { color: '#64748b', background: 'rgba(255,255,255,.02)', border: 'rgba(255,255,255,.05)' },
  }

  return (
    <span style={{
      fontSize: 10, fontWeight: 800, borderRadius: 6, padding: '3px 8px', textTransform: 'uppercase', letterSpacing: '.05em',
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
    height: 44,
    padding: '0 20px',
    borderRadius: 12,
    background,
    color,
    border,
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all .2s'
  } as const
}

function pagerButton(enabled: boolean) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    padding: '0 16px',
    borderRadius: 10,
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 800,
    background: enabled ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.02)',
    color: enabled ? '#f8fafc' : '#475569',
    border: enabled ? '1px solid rgba(255,255,255,.15)' : '1px solid rgba(255,255,255,.05)',
    pointerEvents: enabled ? 'auto' : 'none',
    transition: 'all .2s'
  } as const
}
