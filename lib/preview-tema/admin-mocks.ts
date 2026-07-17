// Mocks do dashboard admin para a rota de preview de tema (dev-only).
// Ativado apenas com NODE_ENV=development E PREVIEW_TEMA_ADMIN=1 —
// inerte em produção mesmo que a flag exista.

export function isPreviewTemaAdmin() {
  return process.env.NODE_ENV === 'development' && process.env.PREVIEW_TEMA_ADMIN === '1'
}

export const PREVIEW_ESCOLA_NOME = 'Colégio São Judas Tadeu'

export const PREVIEW_PERMISSOES = [
  'pedidos.ver', 'produtos.ver', 'concurso.ver', 'responsaveis.ver', 'alunos.ver',
  'checkin.usar', 'relatorios.ver', 'receita.ver', 'cantina.ver', 'pdv.usar',
  'categorias.ver', 'vouchers.ver', 'configuracoes.ver',
]

// Gerador determinístico — mesma seed, mesmo dashboard a cada render.
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DIA = 86_400_000

const NOMES = [
  'Ana Paula Ribeiro', 'Carlos Eduardo Lima', 'Fernanda Souza', 'João Pedro Alves',
  'Mariana Castro', 'Rafael Monteiro', 'Juliana Ferreira', 'Bruno Cardoso',
  'Patrícia Nunes', 'Diego Barbosa', 'Camila Rocha', 'Thiago Martins',
]

const PRODUTOS = [
  { id: 'pv-p1', nome: 'Passeio ao Museu do Ipiranga', categoria: 'passeios', ativo: true, esgotado: false, capacidade: 40, prazo: 9, evento: 12, preco: 120 },
  { id: 'pv-p2', nome: 'Festa Junina 2026 — Ingresso Família', categoria: 'eventos', ativo: true, esgotado: false, capacidade: 300, prazo: 18, evento: 20, preco: 35 },
  { id: 'pv-p3', nome: 'Camiseta Polo do Uniforme', categoria: 'uniforme', ativo: true, esgotado: false, capacidade: null, prazo: null, evento: null, preco: 89.9 },
  { id: 'pv-p4', nome: 'Agasalho de Inverno', categoria: 'uniforme', ativo: true, esgotado: false, capacidade: null, prazo: null, evento: null, preco: 129.9 },
  { id: 'pv-p5', nome: 'Kit Material de Artes', categoria: 'materiais', ativo: true, esgotado: false, capacidade: null, prazo: 9, evento: null, preco: 75 },
  { id: 'pv-p6', nome: 'Apostila 2º Semestre', categoria: 'materiais', ativo: true, esgotado: false, capacidade: null, prazo: null, evento: null, preco: 210 },
  { id: 'pv-p7', nome: 'Formatura EF2 — Convite Extra', categoria: 'eventos', ativo: true, esgotado: true, capacidade: 180, prazo: null, evento: 30, preco: 60 },
  { id: 'pv-p8', nome: 'Segunda Chamada — Matemática', categoria: 'segunda_chamada', ativo: true, esgotado: false, capacidade: null, prazo: 11, evento: null, preco: 50 },
  { id: 'pv-p9', nome: 'Caneca da Copa Tadeu', categoria: 'outros', ativo: true, esgotado: false, capacidade: null, prazo: null, evento: null, preco: 28 },
  { id: 'pv-p10', nome: 'Estudo do Meio — Fazenda', categoria: 'passeios', ativo: true, esgotado: false, capacidade: 80, prazo: 22, evento: 28, preco: 185 },
]

export function getPreviewAdminData(_interval?: unknown) {
  const rand = mulberry32(20260717)
  const agora = Date.now()

  const produtos = PRODUTOS.map((p) => ({
    id: p.id, nome: p.nome, categoria: p.categoria, ativo: p.ativo, esgotado: p.esgotado,
    capacidade: p.capacidade,
    prazo_compra: p.prazo === null ? null : new Date(agora + p.prazo * DIA).toISOString(),
    data_evento: p.evento === null ? null : new Date(agora + p.evento * DIA).toISOString().slice(0, 10),
  }))

  const statuses = ['pago', 'pago', 'pago', 'pago', 'pago', 'pago', 'pendente', 'cancelado'] as const
  const metodos = ['pix', 'pix', 'pix', 'cartao', 'cartao', 'boleto'] as const

  const pedidos = Array.from({ length: 52 }, (_, i) => {
    const diasAtras = Math.floor(rand() * 30)
    const criado = new Date(agora - diasAtras * DIA - Math.floor(rand() * 12) * 3_600_000)
    const status = i === 0 ? 'pendente' : statuses[Math.floor(rand() * statuses.length)]
    const produto = PRODUTOS[Math.floor(rand() * PRODUTOS.length)]
    const qtd = 1 + Math.floor(rand() * 2)
    return {
      id: `pv-ped-${i}`,
      numero: String(1040 + i),
      status,
      total: Number((produto.preco * qtd).toFixed(2)),
      metodo_pagamento: metodos[Math.floor(rand() * metodos.length)],
      data_criacao: criado.toISOString(),
      data_pagamento: status === 'pago' ? new Date(criado.getTime() + 3_600_000).toISOString() : null,
      created_at: criado.toISOString(),
      _produto: produto,
    }
  }).sort((a, b) => b.created_at.localeCompare(a.created_at))

  const pedidosRecentes = pedidos.slice(0, 8).map((p, i) => ({
    ...p,
    responsavel: { nome: NOMES[i % NOMES.length] },
    itens: [{ id: `pv-it-r${i}`, produto: { nome: p._produto.nome } }],
  }))

  const itens = pedidos
    .filter((p) => p.status === 'pago')
    .flatMap((p, i) => {
      const linhas = 1 + Math.floor(rand() * 2)
      return Array.from({ length: linhas }, (_, j) => {
        const produto = j === 0 ? p._produto : PRODUTOS[Math.floor(rand() * PRODUTOS.length)]
        return {
          id: `pv-it-${i}-${j}`,
          pedido_id: p.id,
          produto_id: produto.id,
          preco_unitario: produto.preco,
          aluno_id: `pv-al-${Math.floor(rand() * 180)}`,
          produto: { nome: produto.nome, categoria: produto.categoria },
        }
      })
    })

  const ingressos = [
    ...Array.from({ length: 31 }, (_, i) => ({ produto_id: 'pv-p1', status: i < 4 ? 'usado' : 'emitido' })),
    ...Array.from({ length: 212 }, () => ({ produto_id: 'pv-p2', status: 'emitido' })),
    ...Array.from({ length: 148 }, () => ({ produto_id: 'pv-p7', status: 'emitido' })),
    ...Array.from({ length: 23 }, () => ({ produto_id: 'pv-p10', status: 'emitido' })),
  ]

  const carteiras = Array.from({ length: 86 }, () => ({ saldo: Number((rand() * 120).toFixed(2)) }))

  const pixPendentes = pedidos
    .filter((p) => p.status === 'pendente' && agora - new Date(p.created_at).getTime() < DIA)
    .slice(0, 3)
    .map((p, i) => ({
      id: p.id, numero: p.numero, total: p.total, created_at: p.created_at,
      responsavel: { nome: NOMES[(i + 4) % NOMES.length], telefone: `(11) 9 9000-000${i + 1}` },
    }))

  const limpar = ({ _produto, ...resto }: (typeof pedidos)[number]) => resto

  return [
    { data: pedidos.map(limpar) },
    { data: pedidosRecentes.map(({ _produto, ...resto }) => resto) },
    { data: produtos },
    { count: 412 },
    { count: 371 },
    { data: pixPendentes },
    { data: carteiras },
    { data: itens },
    { data: ingressos },
  ]
}
