'use client'

import { useState, useTransition, useRef } from 'react'
import { buscarAlunoCantinaAction, confirmarCompraCantinaAction } from '@/app/actions/cantina'
import type { CantinaProduto } from '@/types/database'

interface AlunoInfo {
  id: string
  nome: string
  serie: string
  carteira: {
    id: string
    saldo: number
    limite_diario: number | null
    ativo: boolean
    bloqueio_motivo: string | null
  }
  gastoHoje: number
  restricoes: { produto_id: string | null; categoria: string | null }[]
}

interface ItemCarrinho {
  produto: CantinaProduto
  quantidade: number
}

interface Props {
  produtos: CantinaProduto[]
  operadorId?: string
}

function fmtMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtHora() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function PdvClient({ produtos, operadorId }: Props) {
  const [pending, startTransition] = useTransition()
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<AlunoInfo[]>([])
  const [alunoSelecionado, setAlunoSelecionado] = useState<AlunoInfo | null>(null)
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<{ alunoNome: string; total: number; hora: string; itens: ItemCarrinho[] } | null>(null)
  const buscaRef = useRef<HTMLInputElement>(null)

  const total = carrinho.reduce((s, i) => s + i.produto.preco * i.quantidade, 0)

  function handleBusca(q: string) {
    setBusca(q)
    if (q.trim().length < 2) { setResultados([]); return }
    startTransition(async () => {
      const res = await buscarAlunoCantinaAction(q)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (res.data) setResultados(res.data as any as AlunoInfo[])
    })
  }

  function selecionarAluno(aluno: AlunoInfo) {
    setAlunoSelecionado(aluno)
    setResultados([])
    setBusca('')
    setCarrinho([])
    setErro(null)
  }

  function alterarQtd(produto: CantinaProduto, delta: number) {
    setCarrinho(prev => {
      const existe = prev.find(i => i.produto.id === produto.id)
      if (!existe && delta > 0) return [...prev, { produto, quantidade: 1 }]
      if (!existe) return prev
      const novaQtd = existe.quantidade + delta
      if (novaQtd <= 0) return prev.filter(i => i.produto.id !== produto.id)
      return prev.map(i => i.produto.id === produto.id ? { ...i, quantidade: novaQtd } : i)
    })
  }

  function getQtd(produtoId: string) {
    return carrinho.find(i => i.produto.id === produtoId)?.quantidade ?? 0
  }

  function isProdutoBloqueado(produto: CantinaProduto) {
    if (!alunoSelecionado) return false
    return alunoSelecionado.restricoes.some(r =>
      r.produto_id === produto.id || (r.categoria && r.categoria === produto.categoria)
    )
  }

  function handleConfirmar() {
    if (!alunoSelecionado || carrinho.length === 0) return
    setErro(null)

    // Validações client-side
    if (!alunoSelecionado.carteira.ativo) {
      setErro(`Carteira bloqueada: ${alunoSelecionado.carteira.bloqueio_motivo ?? 'sem motivo informado'}`)
      return
    }
    if (alunoSelecionado.carteira.saldo < total) {
      setErro(`Saldo insuficiente. Saldo atual: ${fmtMoeda(alunoSelecionado.carteira.saldo)}`)
      return
    }
    const limiteRestante = alunoSelecionado.carteira.limite_diario != null
      ? alunoSelecionado.carteira.limite_diario - alunoSelecionado.gastoHoje
      : Infinity
    if (total > limiteRestante) {
      setErro(`Limite diário atingido. Disponível hoje: ${fmtMoeda(limiteRestante)}`)
      return
    }

    startTransition(async () => {
      const res = await confirmarCompraCantinaAction(
        alunoSelecionado.id,
        carrinho.map(i => ({ produto_id: i.produto.id, quantidade: i.quantidade, preco_unitario: i.produto.preco })),
      )
      if (!res.success) {
        setErro(res.error ?? 'Erro ao confirmar compra.')
        return
      }
      setSucesso({ alunoNome: alunoSelecionado.nome, total, hora: fmtHora(), itens: [...carrinho] })
      setAlunoSelecionado(null)
      setCarrinho([])
    })
  }

  function resetar() {
    setSucesso(null)
    setAlunoSelecionado(null)
    setCarrinho([])
    setErro(null)
    setBusca('')
    setTimeout(() => buscaRef.current?.focus(), 100)
  }

  // ── Tela de sucesso ─────────────────────────────────────────
  if (sucesso) {
    return (
      <div style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center', animation: 'fade-up .3s ease both' }}>
        <div style={{
          background: '#f0fdf4', border: '2px solid #86efac',
          borderRadius: 'var(--r-xl)', padding: '32px 24px',
          boxShadow: '0 8px 32px rgba(16,185,129,.15)',
        }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#166534', marginBottom: 4 }}>
            Compra confirmada!
          </div>
          <div style={{ fontSize: 14, color: '#15803d', marginBottom: 20 }}>
            {sucesso.alunoNome} · {sucesso.hora}
          </div>
          <div style={{ margin: '16px 0', borderTop: '1px solid #bbf7d0', borderBottom: '1px solid #bbf7d0', padding: '12px 0' }}>
            {sucesso.itens.map(i => (
              <div key={i.produto.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: '#166534' }}>
                <span>{i.produto.icone} {i.produto.nome} × {i.quantidade}</span>
                <span style={{ fontWeight: 700 }}>{fmtMoeda(i.produto.preco * i.quantidade)}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#1e3a5f', margin: '12px 0' }}>
            {fmtMoeda(sucesso.total)}
          </div>
          <button onClick={resetar} style={{
            width: '100%', padding: '14px', borderRadius: 'var(--r-md)',
            background: '#1e3a5f', color: '#fff', border: 'none',
            fontSize: 15, fontWeight: 800, cursor: 'pointer',
          }}>
            Nova venda
          </button>
        </div>
      </div>
    )
  }

  const saldoPos = alunoSelecionado ? alunoSelecionado.carteira.saldo - total : 0
  const limiteRestanteHoje = alunoSelecionado?.carteira.limite_diario != null
    ? alunoSelecionado.carteira.limite_diario - alunoSelecionado.gastoHoje
    : null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 18, alignItems: 'start' }}>

      {/* Coluna esquerda — identificação do aluno */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{
          background: '#fff', border: '1.5px solid #e2e8f0',
          borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 6px 18px rgba(15,23,42,.03)',
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', background: '#fcfdfe' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1e3a5f' }}>Identificação do aluno</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>Busque pelo nome</div>
          </div>
          <div style={{ padding: '16px' }}>
            {/* Busca por nome */}
            <div style={{ position: 'relative' }}>
              <input
                ref={buscaRef}
                autoFocus
                type="text"
                placeholder="🔍 Digitar nome do aluno..."
                value={busca}
                onChange={e => handleBusca(e.target.value)}
                style={{
                  width: '100%', padding: '12px 14px',
                  borderRadius: 10, border: '1.5px solid #e2e8f0',
                  fontSize: 14, outline: 'none',
                }}
              />
              {resultados.length > 0 && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
                  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,.1)', overflow: 'hidden',
                }}>
                  {resultados.map(a => (
                    <button key={a.id} onClick={() => selecionarAluno(a)} style={{
                      width: '100%', padding: '12px 14px', textAlign: 'left',
                      background: 'none', border: 'none', borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer', fontSize: 13,
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      <div style={{ fontWeight: 700, color: '#1e3a5f' }}>{a.nome}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                        {a.serie} · Saldo: {fmtMoeda(a.carteira?.saldo ?? 0)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Card do aluno selecionado */}
            {alunoSelecionado && (
              <div style={{ marginTop: 14 }}>
                <div style={{
                  background: '#eff6ff', border: '1.5px solid #bfdbfe',
                  borderRadius: 14, padding: '14px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: '#1e3a5f', marginBottom: 2 }}>
                        {alunoSelecionado.nome}
                      </div>
                      <div style={{ fontSize: 12, color: '#1e40af' }}>
                        {alunoSelecionado.serie}
                        {!alunoSelecionado.carteira.ativo && (
                          <span style={{ color: '#ef4444', marginLeft: 8, fontWeight: 700 }}>
                            🔒 Bloqueada
                          </span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => { setAlunoSelecionado(null); setCarrinho([]) }} style={{
                      width: 28, height: 28, borderRadius: 8, fontSize: 14,
                      background: 'rgba(255,255,255,.8)', border: '1px solid #bfdbfe',
                      cursor: 'pointer', color: '#94a3b8',
                    }}>✕</button>
                  </div>
                  <div style={{ marginTop: 12, fontSize: 24, fontWeight: 800, color: '#1e3a5f' }}>
                    Saldo: {fmtMoeda(alunoSelecionado.carteira.saldo)}
                  </div>
                  {limiteRestanteHoje != null && (
                    <div style={{ fontSize: 12, color: '#1e40af', marginTop: 4 }}>
                      Limite restante hoje: {fmtMoeda(Math.max(0, limiteRestanteHoje))}
                    </div>
                  )}
                  {total > 0 && (
                    <div style={{ marginTop: 8, fontSize: 13, color: saldoPos >= 0 ? '#166534' : '#991b1b', fontWeight: 600 }}>
                      Saldo após compra: {fmtMoeda(saldoPos)}
                    </div>
                  )}
                </div>

                {alunoSelecionado.restricoes.length > 0 && (
                  <div style={{
                    marginTop: 10, background: '#fef3c7', border: '1px solid #fde68a',
                    borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#92400e',
                  }}>
                    ⚠️ Aluno tem restrições cadastradas pelo responsável.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Coluna direita — produtos + carrinho */}
      <div style={{
        background: '#fff', border: '1.5px solid #e2e8f0',
        borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 6px 18px rgba(15,23,42,.03)',
      }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', background: '#fcfdfe' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1e3a5f' }}>Montagem da compra</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>Selecione os itens</div>
        </div>
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Lista de produtos */}
          {produtos.filter(p => p.disponivel_presencial).map(p => {
            const bloqueado = isProdutoBloqueado(p)
            const qtd = getQtd(p.id)
            return (
              <div key={p.id} style={{
                background: bloqueado ? '#fef2f2' : '#f8fafc',
                border: `1px solid ${bloqueado ? '#fecaca' : '#e2e8f0'}`,
                borderRadius: 12, padding: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                opacity: bloqueado ? 0.7 : 1,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#334155' }}>
                    {p.icone} {p.nome}
                    {bloqueado && <span style={{ fontSize: 11, color: '#ef4444', marginLeft: 6 }}>⚠️ Restrito</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{p.categoria}</div>
                  {p.alergenos && p.alergenos.length > 0 && (
                    <div style={{ fontSize: 11, color: '#92400e', marginTop: 2 }}>⚠️ {p.alergenos.join(', ')}</div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => alterarQtd(p, -1)}
                    disabled={!alunoSelecionado || qtd === 0}
                    style={{
                      width: 32, height: 32, borderRadius: 8, fontSize: 18, fontWeight: 800,
                      border: '1.5px solid #e2e8f0', background: '#fff', cursor: 'pointer',
                      color: qtd === 0 ? '#cbd5e1' : '#1e3a5f',
                    }}
                  >−</button>
                  <span style={{ width: 28, textAlign: 'center', fontWeight: 800, fontSize: 15, color: '#1e3a5f' }}>{qtd}</span>
                  <button
                    onClick={() => !bloqueado && alterarQtd(p, 1)}
                    disabled={!alunoSelecionado || bloqueado}
                    style={{
                      width: 32, height: 32, borderRadius: 8, fontSize: 18, fontWeight: 800,
                      border: '1.5px solid #e2e8f0', background: !alunoSelecionado || bloqueado ? '#f1f5f9' : '#1e3a5f',
                      cursor: !alunoSelecionado || bloqueado ? 'not-allowed' : 'pointer',
                      color: !alunoSelecionado || bloqueado ? '#94a3b8' : '#fff',
                    }}
                  >+</button>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#1e3a5f', minWidth: 64, textAlign: 'right' }}>
                    {fmtMoeda(p.preco)}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Carrinho resumo */}
          {carrinho.length > 0 && (
            <>
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                {carrinho.map(i => (
                  <div key={i.produto.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13,
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#334155' }}>{i.produto.icone} {i.produto.nome}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{i.quantidade} × {fmtMoeda(i.produto.preco)}</div>
                    </div>
                    <div style={{ fontWeight: 800, color: '#1e3a5f' }}>{fmtMoeda(i.produto.preco * i.quantidade)}</div>
                  </div>
                ))}
              </div>

              <div style={{
                background: '#fff7ed', border: '1.5px solid #fed7aa',
                borderRadius: 14, padding: '14px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#9a3412', textTransform: 'uppercase', letterSpacing: '.07em' }}>
                  Total
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#1e3a5f' }}>
                  {fmtMoeda(total)}
                </div>
              </div>
            </>
          )}

          {erro && (
            <div style={{
              padding: '12px', borderRadius: 10,
              background: '#fee2e2', border: '1px solid #fca5a5',
              fontSize: 13, fontWeight: 600, color: '#991b1b',
            }}>
              ❌ {erro}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleConfirmar}
              disabled={pending || !alunoSelecionado || carrinho.length === 0}
              style={{
                flex: 1, padding: '14px',
                borderRadius: 10, border: 'none',
                background: (!alunoSelecionado || carrinho.length === 0) ? '#cbd5e1' : '#1e3a5f',
                color: '#fff', fontSize: 14, fontWeight: 800,
                cursor: (!alunoSelecionado || carrinho.length === 0) ? 'not-allowed' : 'pointer',
                transition: 'all .2s',
              }}
            >
              {pending ? 'Processando…' : `✅ Confirmar — ${fmtMoeda(total)}`}
            </button>
            {carrinho.length > 0 && (
              <button onClick={() => setCarrinho([])} style={{
                padding: '14px 18px', borderRadius: 10, border: '1.5px solid #e2e8f0',
                background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                Limpar
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .pdv-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
