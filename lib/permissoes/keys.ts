export interface PermissionDef {
  chave: string
  rotulo: string
}

export interface PermissionGroup {
  modulo: string
  rotulo: string
  permissoes: PermissionDef[]
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    modulo: 'produtos', rotulo: 'Produtos',
    permissoes: [
      { chave: 'produtos.ver',     rotulo: 'Ver produtos' },
      { chave: 'produtos.criar',   rotulo: 'Criar produtos' },
      { chave: 'produtos.editar',  rotulo: 'Editar produtos' },
      { chave: 'produtos.excluir', rotulo: 'Excluir produtos' },
    ],
  },
  {
    modulo: 'categorias', rotulo: 'Categorias',
    permissoes: [
      { chave: 'categorias.ver',       rotulo: 'Ver categorias' },
      { chave: 'categorias.gerenciar', rotulo: 'Gerenciar categorias' },
    ],
  },
  {
    modulo: 'pedidos', rotulo: 'Pedidos',
    permissoes: [
      { chave: 'pedidos.ver',       rotulo: 'Ver pedidos' },
      { chave: 'pedidos.estornar',  rotulo: 'Estornar pedidos' },
      { chave: 'pedidos.cancelar',  rotulo: 'Cancelar pedidos' },
    ],
  },
  {
    modulo: 'pagamentos', rotulo: 'Pagamentos',
    permissoes: [
      { chave: 'pagamentos.ver',       rotulo: 'Ver pagamentos' },
      { chave: 'pagamentos.estornar',  rotulo: 'Estornar pagamentos' },
      // Não faz parte do seed original (seed_papeis_presets): papéis existentes
      // só a recebem via UI de papéis. Admins passam pelo fallback role=admin.
      { chave: 'pagamentos.confirmar', rotulo: 'Confirmar pagamentos manualmente' },
    ],
  },
  {
    modulo: 'vouchers', rotulo: 'Vouchers',
    permissoes: [
      { chave: 'vouchers.ver',       rotulo: 'Ver vouchers' },
      { chave: 'vouchers.gerenciar', rotulo: 'Gerenciar vouchers' },
    ],
  },
  {
    modulo: 'alunos', rotulo: 'Alunos',
    permissoes: [
      { chave: 'alunos.ver',    rotulo: 'Ver alunos' },
      { chave: 'alunos.editar', rotulo: 'Editar alunos' },
    ],
  },
  {
    modulo: 'responsaveis', rotulo: 'Responsáveis',
    permissoes: [
      { chave: 'responsaveis.ver',    rotulo: 'Ver responsáveis' },
      { chave: 'responsaveis.editar', rotulo: 'Editar responsáveis' },
    ],
  },
  {
    modulo: 'checkin', rotulo: 'Check-in',
    permissoes: [
      { chave: 'checkin.usar', rotulo: 'Usar check-in' },
    ],
  },
  {
    modulo: 'pdv', rotulo: 'PDV Balcão',
    permissoes: [
      { chave: 'pdv.usar', rotulo: 'Usar PDV' },
    ],
  },
  {
    modulo: 'cantina', rotulo: 'Cantina',
    permissoes: [
      { chave: 'cantina.ver',       rotulo: 'Ver cantina' },
      { chave: 'cantina.operar',    rotulo: 'Operar cantina' },
      { chave: 'cantina.gerenciar', rotulo: 'Gerenciar cantina' },
    ],
  },
  {
    modulo: 'relatorios', rotulo: 'Relatórios',
    permissoes: [
      { chave: 'relatorios.ver', rotulo: 'Ver relatórios' },
    ],
  },
  {
    modulo: 'receita', rotulo: 'Receita',
    permissoes: [
      { chave: 'receita.ver', rotulo: 'Ver receita líquida' },
    ],
  },
  {
    modulo: 'configuracoes', rotulo: 'Configurações',
    permissoes: [
      { chave: 'configuracoes.ver',                   rotulo: 'Ver configurações' },
      { chave: 'configuracoes.editar_identidade',     rotulo: 'Editar identidade da loja' },
      { chave: 'configuracoes.editar_pagamentos',     rotulo: 'Editar configurações de pagamento' },
      { chave: 'configuracoes.gerenciar_usuarios',    rotulo: 'Gerenciar usuários' },
      { chave: 'configuracoes.gerenciar_papeis',      rotulo: 'Gerenciar papéis' },
    ],
  },
  {
    // Política deliberada: concedida aos mesmos papéis que possuem pedidos.ver
    // (migration 20260707_concurso_permissao). Se o significado de pedidos.ver
    // mudar, revisar os grants de concurso.ver — o acoplamento é de política,
    // não incidental.
    modulo: 'concurso', rotulo: 'Concurso de Bolsas',
    permissoes: [
      { chave: 'concurso.ver', rotulo: 'Ver inscrições do concurso' },
    ],
  },
]

export const PERMISSION_KEYS: string[] = PERMISSION_GROUPS.flatMap(
  g => g.permissoes.map(p => p.chave),
)

const KEY_SET = new Set(PERMISSION_KEYS)

export function isValidPermissionKey(k: string): boolean {
  return KEY_SET.has(k)
}

export type PermissionKey = (typeof PERMISSION_KEYS)[number]
