'use client'

import React, { Suspense } from 'react'

import { BottomNavigation } from '@/components/loja/BottomNavigation'
import { CartBar } from '@/components/loja/CartBar'
import { CartDrawer } from '@/components/loja/CartDrawer'
import { CartProvider } from '@/components/loja/CartProvider'
import { CategoryFilter } from '@/components/loja/CategoryFilter'
import { ProductCard } from '@/components/loja/ProductCard'
import { StoreHero } from '@/components/loja/StoreHero'
import { StoreSearch } from '@/components/loja/StoreSearch'
import type { Aluno, Escola, Produto, Responsavel } from '@/types/database'

const DIA = 86_400_000

const escola = {
  id: 'preview-escola',
  nome: 'Colégio São Judas Tadeu',
  slogan: 'Educando com amor e excelência',
} as unknown as Escola

const responsavel = {
  id: 'preview-resp',
  nome: 'Webert Santos',
} as unknown as Responsavel

const alunos = [
  {
    id: 'preview-aluno-1',
    nome: 'Maria Clara Santos',
    serie: '3º Ano',
    turma: 'B',
    cor: '#5e5ce6',
    ativo: true,
  },
  {
    id: 'preview-aluno-2',
    nome: 'Pedro Santos',
    serie: '7º Ano',
    turma: 'A',
    cor: '#30b0c7',
    ativo: true,
  },
] as unknown as Aluno[]

function produto(p: Record<string, unknown>): Produto {
  return {
    descricao: null,
    icon: null,
    imagem_url: null,
    esgotado: false,
    variantes: null,
    prazo_compra: null,
    data_evento: null,
    estoque: null,
    capacidade: null,
    preco_promocional: null,
    ...p,
  } as unknown as Produto
}

const produtos: Record<string, Produto[]> = {
  uniforme: [
    produto({
      id: 'pv-uni-1', categoria: 'uniforme', nome: 'Camiseta Polo do Uniforme',
      descricao: 'Malha piquet com brasão bordado. Tamanhos do P ao GG.',
      preco: 89.9, icon: '👕', variantes: [{ id: 'p', nome: 'P' }, { id: 'm', nome: 'M' }],
    }),
    produto({
      id: 'pv-uni-2', categoria: 'uniforme', nome: 'Agasalho de Inverno',
      descricao: 'Moletom flanelado com zíper, oficial da escola.',
      preco: 149.9, preco_promocional: 129.9, icon: '🧥', estoque: 3,
    }),
  ],
  passeios: [
    produto({
      id: 'pv-pas-1', categoria: 'passeios', nome: 'Passeio ao Museu do Ipiranga',
      descricao: 'Transporte, lanche e entrada inclusos. Acompanhamento dos professores.',
      preco: 120, icon: '🏛️',
      prazo_compra: new Date(Date.now() + 1 * DIA).toISOString(),
      data_evento: new Date(Date.now() + 12 * DIA).toISOString().slice(0, 10),
      capacidade: 40,
    }),
  ],
  eventos: [
    produto({
      id: 'pv-eve-1', categoria: 'eventos', nome: 'Festa Junina 2026 — Ingresso Família',
      descricao: 'Vale 1 família (até 5 pessoas). Barracas, quadrilha e fogueira.',
      preco: 35, icon: '🎪',
      data_evento: new Date(Date.now() + 20 * DIA).toISOString().slice(0, 10),
    }),
    produto({
      id: 'pv-eve-2', categoria: 'eventos', nome: 'Formatura EF2 — Convite Extra',
      descricao: 'Convite adicional para a cerimônia no teatro.',
      preco: 60, icon: '🎓', esgotado: true,
    }),
  ],
  materiais: [
    produto({
      id: 'pv-mat-1', categoria: 'materiais', nome: 'Kit Material de Artes',
      descricao: 'Tintas, pincéis e bloco A3 para as aulas do 2º semestre.',
      preco: 75, icon: '🎨',
    }),
  ],
  segunda_chamada: [
    produto({
      id: 'pv-sc-1', categoria: 'segunda_chamada', nome: 'Segunda Chamada — Matemática',
      descricao: 'Prova de recuperação do 2º bimestre.',
      preco: 50, icon: '📝',
    }),
  ],
}

const CAT_LABELS: Record<string, { label: string; icon: string }> = {
  uniforme: { label: 'Uniforme', icon: '👕' },
  passeios: { label: 'Passeios', icon: '🚌' },
  eventos: { label: 'Eventos', icon: '🎉' },
  materiais: { label: 'Materiais', icon: '📚' },
  segunda_chamada: { label: 'Segunda chamada', icon: '📝' },
}

export function PreviewTemaClient() {
  const selectedAluno = alunos[0]
  const entries = Object.entries(produtos)
  const totalProdutos = entries.reduce((sum, [, lista]) => sum + lista.length, 0)

  const counts: Partial<Record<string, number>> = { todas: totalProdutos }
  for (const [cat, lista] of entries) counts[cat] = lista.length

  const tabs = entries.map(([key]) => ({ key, ...CAT_LABELS[key] }))

  return (
    <CartProvider previewMode>
      <div className="pb-[100px]" style={{ maxWidth: 560, margin: '0 auto' }}>
        <StoreHero
          responsavel={responsavel}
          escola={escola}
          selectedAluno={selectedAluno}
          alunos={alunos}
        />

        <Suspense>
          <StoreSearch initialQuery="" resultCount={totalProdutos} />
        </Suspense>

        <Suspense>
          <CategoryFilter counts={counts} tabs={tabs} />
        </Suspense>

        <section style={{ padding: '14px 18px 0' }}>
          <div style={{ display: 'grid', gap: 28 }}>
            {entries.map(([cat, lista]) => (
              <section key={cat} data-cat-key={cat} style={{ display: 'grid', gap: 12, scrollMarginTop: 120 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 18 }}>{CAT_LABELS[cat].icon}</span>
                  <h2 style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.02em', color: 'var(--text-1)', margin: 0 }}>
                    {CAT_LABELS[cat].label}
                  </h2>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>
                    {lista.length}
                  </span>
                </div>
                <div style={{ display: 'grid', gap: 12 }}>
                  {lista.map((p, index) => (
                    <ProductCard
                      key={p.id}
                      produto={p}
                      aluno={selectedAluno}
                      index={index}
                      vagasRestantes={p.id === 'pv-pas-1' ? 8 : null}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      </div>

      <CartDrawer />
      <CartBar />
      <BottomNavigation previewPathname="/loja" />
    </CartProvider>
  )
}
