import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/email/send', () => ({
  enviarEmailIngresso: vi.fn().mockResolvedValue(true),
  enviarEmailResetSenhaAdmin: vi.fn().mockResolvedValue(true),
  enviarEmailPedidoCancelado: vi.fn().mockResolvedValue(true),
}))
vi.mock('@/lib/email/resolver-template', () => ({
  resolverTemplatePedido: vi.fn().mockResolvedValue({ assunto: 'a', aberturaHtml: '' }),
}))
vi.mock('@/lib/email/resend', () => ({ SITE_URL: 'http://loja.test' }))
vi.mock('@/lib/pagamentos/gateway', () => ({
  getGateway: vi.fn(() => ({
    estornarPagamento: vi.fn().mockResolvedValue(undefined),
    cancelarPagamento: vi.fn().mockResolvedValue(undefined),
    estornarParcial: vi.fn().mockResolvedValue(undefined),
  })),
}))

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PERMISSION_KEYS, isValidPermissionKey } from '@/lib/permissoes/keys'
import * as adminActions from '@/app/actions/admin'

// ── Infra de mocks ────────────────────────────────────────────────────────────

type Row = Record<string, unknown>
type Tables = Record<string, Row | Row[] | null>
interface LogEntry { table: string; method: string; args: unknown[] }

const MUTACOES = ['insert', 'update', 'delete', 'upsert']
const TABELAS_GUARD = new Set(['usuario_papel', 'papel_permissoes'])

// Builder chainable e thenable: qualquer cadeia .select().eq()... resolve para
// as linhas configuradas em `tables`; single/maybeSingle devolvem a primeira.
function makeFrom(tables: Tables, log: LogEntry[]) {
  return vi.fn((table: string) => {
    const raw = tables[table]
    const arr: Row[] = raw == null ? [] : Array.isArray(raw) ? raw : [raw]
    const first = arr[0] ?? null
    const builder: any = new Proxy({}, {
      get(_t, prop: string) {
        if (prop === 'then') {
          return (resolve: (v: unknown) => void) =>
            resolve({ data: arr, error: null, count: arr.length })
        }
        if (prop === 'single' || prop === 'maybeSingle') {
          return () => {
            log.push({ table, method: prop, args: [] })
            return Promise.resolve({ data: first, error: null })
          }
        }
        return (...args: unknown[]) => {
          log.push({ table, method: prop, args })
          return builder
        }
      },
    })
    return builder
  })
}

function makeSession(opts: { role?: string; perms: string[]; log: LogEntry[]; tables?: Tables }) {
  const tables: Tables = {
    ...opts.tables,
    usuario_papel: opts.perms.length > 0 ? { papel_id: 'papel-1', suspenso: false } : null,
    papel_permissoes: opts.perms.map((chave) => ({ chave })),
  }
  const session = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'u-1', app_metadata: opts.role ? { role: opts.role } : {} } },
      }),
    },
    from: makeFrom(tables, opts.log),
    rpc: vi.fn().mockResolvedValue({ data: { ok: true, motivo: '' }, error: null }),
  }
  ;(createClient as any).mockResolvedValue(session)
  return session
}

function makeAdmin(tables: Tables, log: LogEntry[]) {
  const client = {
    from: makeFrom(tables, log),
    rpc: vi.fn().mockResolvedValue({ data: { ok: true, saldo_apos: 0 }, error: null }),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: null, error: { message: 'skip' } }),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'http://img' } })),
      })),
    },
    auth: {
      admin: {
        generateLink: vi.fn().mockResolvedValue({
          data: { properties: { action_link: 'http://link' } },
          error: null,
        }),
        updateUserById: vi.fn().mockResolvedValue({ error: null }),
      },
    },
  }
  ;(createAdminClient as any).mockReturnValue(client)
  return client
}

function fd(obj: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(obj)) f.append(k, v)
  return f
}

function mutou(log: LogEntry[], table: string, method: string) {
  return log.some((c) => c.table === table && c.method === method)
}

function mutacoesFora(log: LogEntry[]) {
  return log.filter((c) => MUTACOES.includes(c.method) && !TABELAS_GUARD.has(c.table))
}

// ── Especificação: cada action e sua(s) chave(s) de permissão ────────────────

type SessionMock = ReturnType<typeof makeSession>
type AdminMock = ReturnType<typeof makeAdmin>
interface ExecCtx { result: any; log: LogEntry[]; session: SessionMock; adminClient: AdminMock }

interface Spec {
  nome: string
  chaves: string[]           // qualquer uma concede acesso; vazio = somente admin
  somenteAdmin?: boolean
  negaEstilo?: 'result'      // default: a action lança 'Acesso negado.'
  tables?: Tables
  invoke: () => Promise<any>
  verificaExec: (ctx: ExecCtx) => void
}

const FD_PRODUTO = { nome: 'Produto Teste', preco: '10,00', categoria: 'uniforme', max_parcelas: '1' }

const specs: Spec[] = [
  {
    nome: 'confirmarPagamentoAction',
    chaves: ['pagamentos.confirmar'],
    tables: { pedidos: [{ id: 'ped-1' }], itens_pedido: [], ingressos: [] },
    invoke: () => adminActions.confirmarPagamentoAction('ped-1'),
    verificaExec: ({ result, log }) => {
      expect(result).toEqual({ success: true })
      expect(mutou(log, 'pedidos', 'update')).toBe(true)
    },
  },
  {
    nome: 'cancelarPedidoAction',
    chaves: ['pedidos.cancelar'],
    tables: {
      pedidos: [{ id: 'ped-1', numero: 42, total: 99, escola_id: null, responsavel: null }],
      itens_pedido: [],
      pagamentos: [{ status: 'pendente' }],
    },
    invoke: () => adminActions.cancelarPedidoAction('ped-1'),
    verificaExec: ({ result, log }) => {
      expect(result).toEqual({ success: true })
      expect(mutou(log, 'pedidos', 'update')).toBe(true)
    },
  },
  {
    nome: 'validarIngressoAction',
    chaves: ['checkin.usar'],
    invoke: () => adminActions.validarIngressoAction('tok-1', 'Operadora'),
    verificaExec: ({ result, session }) => {
      expect(session.rpc).toHaveBeenCalledWith('validar_ingresso', {
        p_token: 'tok-1',
        p_validado_por: 'Operadora',
      })
      expect(result).toEqual({ ok: true, motivo: '' })
    },
  },
  {
    nome: 'toggleProdutoAtivoAction',
    chaves: ['produtos.editar'],
    tables: { produtos: [{ id: 'prod-1' }] },
    invoke: () => adminActions.toggleProdutoAtivoAction('prod-1', true),
    verificaExec: ({ result, log }) => {
      expect(result).toEqual({ success: true })
      expect(mutou(log, 'produtos', 'update')).toBe(true)
    },
  },
  {
    nome: 'criarProdutoAction',
    chaves: ['produtos.criar'],
    tables: { responsaveis: { escola_id: 'esc-1' }, produtos: [{ id: 'prod-novo' }] },
    invoke: () => adminActions.criarProdutoAction(fd(FD_PRODUTO)),
    verificaExec: ({ result, log }) => {
      expect(result).toEqual({ success: true, id: 'prod-novo' })
      expect(mutou(log, 'produtos', 'insert')).toBe(true)
    },
  },
  {
    nome: 'editarProdutoAction',
    chaves: ['produtos.editar'],
    tables: { produtos: [{ id: 'prod-1' }] },
    invoke: () => adminActions.editarProdutoAction('prod-1', fd(FD_PRODUTO)),
    verificaExec: ({ result, log }) => {
      expect(result).toEqual({ success: true })
      expect(mutou(log, 'produtos', 'update')).toBe(true)
    },
  },
  {
    nome: 'duplicarProdutoAction',
    chaves: ['produtos.criar'],
    tables: { produtos: [{ id: 'prod-1', nome: 'Camisa', created_at: '2026-01-01' }] },
    invoke: () => adminActions.duplicarProdutoAction('prod-1'),
    verificaExec: ({ result, log }) => {
      expect(result).toEqual({ success: true, id: 'prod-1' })
      expect(mutou(log, 'produtos', 'insert')).toBe(true)
    },
  },
  {
    nome: 'toggleEsgotadoAction',
    chaves: ['produtos.editar'],
    tables: { produtos: [{ id: 'prod-1' }] },
    invoke: () => adminActions.toggleEsgotadoAction('prod-1', false),
    verificaExec: ({ result, log }) => {
      expect(result).toEqual({ success: true })
      expect(mutou(log, 'produtos', 'update')).toBe(true)
    },
  },
  {
    nome: 'excluirProdutoAction',
    chaves: ['produtos.excluir'],
    tables: { itens_pedido: [], produto_variantes: [], produtos: [{ id: 'prod-1' }] },
    invoke: () => adminActions.excluirProdutoAction('prod-1'),
    verificaExec: ({ result, log }) => {
      expect(result).toEqual({ success: true })
      expect(mutou(log, 'produtos', 'delete')).toBe(true)
    },
  },
  {
    nome: 'vincularAlunoResponsavelAction',
    chaves: ['alunos.editar', 'responsaveis.editar'],
    tables: {
      responsaveis: { id: 'r1', escola_id: 'e1' },
      alunos: { id: 'a1', escola_id: 'e1' },
      responsavel_aluno: null,
    },
    invoke: () => adminActions.vincularAlunoResponsavelAction(fd({ responsavel_id: 'r1', aluno_id: 'a1' })),
    verificaExec: ({ log }) => {
      expect(mutou(log, 'responsavel_aluno', 'insert')).toBe(true)
    },
  },
  {
    nome: 'desvincularAlunoResponsavelAction',
    chaves: ['alunos.editar', 'responsaveis.editar'],
    tables: { responsavel_aluno: null },
    invoke: () => adminActions.desvincularAlunoResponsavelAction(fd({ responsavel_id: 'r1', aluno_id: 'a1' })),
    verificaExec: ({ log }) => {
      expect(mutou(log, 'responsavel_aluno', 'delete')).toBe(true)
    },
  },
  {
    nome: 'resetSenhaResponsavelAction',
    chaves: [],
    somenteAdmin: true,
    negaEstilo: 'result',
    tables: { responsaveis: { id: 'r1', nome: 'Tatiana', email: 't@x.com' } },
    invoke: () => adminActions.resetSenhaResponsavelAction(fd({ responsavel_id: 'r1' })),
    verificaExec: ({ result, adminClient }) => {
      expect(result).toEqual({ success: true, link: 'http://link', emailSent: true, email: 't@x.com' })
      expect(adminClient.auth.admin.generateLink).toHaveBeenCalled()
    },
  },
  {
    nome: 'definirSenhaResponsavelAction',
    chaves: [],
    somenteAdmin: true,
    negaEstilo: 'result',
    tables: { responsaveis: { id: 'r1', email: 't@x.com' } },
    invoke: () => adminActions.definirSenhaResponsavelAction(fd({ responsavel_id: 'r1', senha: 'supersegura' })),
    verificaExec: ({ result, adminClient }) => {
      expect(result).toEqual({ success: true, email: 't@x.com' })
      expect(adminClient.auth.admin.updateUserById).toHaveBeenCalledWith('r1', {
        password: 'supersegura',
        email_confirm: true,
      })
    },
  },
  {
    nome: 'criarCategoriaAction',
    chaves: ['categorias.gerenciar'],
    tables: {
      responsaveis: { escola_id: 'esc-1' },
      categorias_produto: [{ id: 'cat-1', escola_id: 'esc-1', nome: 'Categoria X' }],
    },
    invoke: () => adminActions.criarCategoriaAction(fd({ nome: 'Categoria X', icone: '🏷️' })),
    verificaExec: ({ result, log }) => {
      expect(result).toMatchObject({ success: true })
      expect(mutou(log, 'categorias_produto', 'insert')).toBe(true)
    },
  },
  {
    nome: 'toggleCategoriaAction',
    chaves: ['categorias.gerenciar'],
    tables: { categorias_produto: [{ id: 'cat-1' }] },
    invoke: () => adminActions.toggleCategoriaAction('cat-1', true),
    verificaExec: ({ result, log }) => {
      expect(result).toEqual({ success: true })
      expect(mutou(log, 'categorias_produto', 'update')).toBe(true)
    },
  },
  {
    nome: 'excluirCategoriaAction',
    chaves: ['categorias.gerenciar'],
    tables: { categorias_produto: [{ id: 'cat-1' }] },
    invoke: () => adminActions.excluirCategoriaAction('cat-1'),
    verificaExec: ({ result, log }) => {
      expect(result).toEqual({ success: true })
      expect(mutou(log, 'categorias_produto', 'delete')).toBe(true)
    },
  },
  {
    nome: 'criarVoucherAction',
    chaves: ['vouchers.gerenciar'],
    tables: { responsaveis: { escola_id: 'esc-1' }, vouchers: [] },
    invoke: () => adminActions.criarVoucherAction(fd({ codigo: 'DESC10', tipo_desconto: 'fixo', valor: '10,00' })),
    verificaExec: ({ result, log }) => {
      expect(result).toEqual({ success: true })
      expect(mutou(log, 'vouchers', 'insert')).toBe(true)
    },
  },
  {
    nome: 'toggleVoucherAction',
    chaves: ['vouchers.gerenciar'],
    tables: { vouchers: [{ id: 'v-1' }] },
    invoke: () => adminActions.toggleVoucherAction('v-1', true),
    verificaExec: ({ result, log }) => {
      expect(result).toEqual({ success: true })
      expect(mutou(log, 'vouchers', 'update')).toBe(true)
    },
  },
  {
    nome: 'excluirVoucherAction',
    chaves: ['vouchers.gerenciar'],
    tables: { vouchers: [{ id: 'v-1' }] },
    invoke: () => adminActions.excluirVoucherAction('v-1'),
    verificaExec: ({ result, log }) => {
      expect(result).toEqual({ success: true })
      expect(mutou(log, 'vouchers', 'delete')).toBe(true)
    },
  },
  {
    nome: 'excluirVouchersLoteAction',
    chaves: ['vouchers.gerenciar'],
    tables: { vouchers: [{ id: 'v-1' }, { id: 'v-2' }] },
    invoke: () => adminActions.excluirVouchersLoteAction(['v-1', 'v-2']),
    verificaExec: ({ result, log }) => {
      expect(result).toEqual({ success: true })
      expect(mutou(log, 'vouchers', 'delete')).toBe(true)
    },
  },
  {
    nome: 'estornarRecargaAdminAction',
    chaves: ['cantina.gerenciar'],
    tables: {
      cantina_recargas: { id: 'rec-1', status: 'confirmada', metodo: 'pix', gateway_id: 'gw-1', valor: 50 },
    },
    invoke: () => adminActions.estornarRecargaAdminAction('rec-1'),
    verificaExec: ({ result, adminClient }) => {
      expect(result).toEqual({ success: true, saldoApos: 0 })
      expect(adminClient.rpc).toHaveBeenCalledWith('estornar_recarga', expect.objectContaining({ p_recarga_id: 'rec-1' }))
    },
  },
  {
    nome: 'cancelarRecargaAdminAction',
    chaves: ['cantina.gerenciar'],
    tables: { cantina_recargas: { id: 'rec-1', status: 'aguardando', gateway_id: null } },
    invoke: () => adminActions.cancelarRecargaAdminAction('rec-1'),
    verificaExec: ({ result, adminClient }) => {
      expect(result).toEqual({ success: true })
      expect(adminClient.rpc).toHaveBeenCalledWith('cancelar_recarga', { p_recarga_id: 'rec-1' })
    },
  },
  {
    nome: 'aprovarEstornoAction',
    chaves: ['cantina.gerenciar'],
    tables: {
      cantina_solicitacoes_estorno: {
        id: 'sol-1', status: 'pendente',
        recarga: { id: 'rec-1', gateway_id: 'gw-1', metodo: 'pix' },
      },
    },
    invoke: () => adminActions.aprovarEstornoAction('sol-1'),
    verificaExec: ({ result, adminClient }) => {
      expect(result).toEqual({ success: true })
      expect(adminClient.rpc).toHaveBeenCalledWith('aprovar_estorno', expect.objectContaining({ p_solicitacao_id: 'sol-1' }))
    },
  },
  {
    nome: 'negarEstornoAction',
    chaves: ['cantina.gerenciar'],
    invoke: () => adminActions.negarEstornoAction('sol-1', 'sem saldo'),
    verificaExec: ({ result, adminClient }) => {
      expect(result).toEqual({ success: true })
      expect(adminClient.rpc).toHaveBeenCalledWith('negar_estorno', expect.objectContaining({ p_solicitacao_id: 'sol-1' }))
    },
  },
  {
    nome: 'aprovarEstornoParcialAction',
    chaves: ['pedidos.estornar'],
    tables: {
      pedido_estornos: {
        id: 'est-1', pedido_id: 'ped-1', status: 'pendente', valor_total: 30,
        itens: [], pedido: { pagamento: { gateway_id: 'gw-1', metodo: 'pix' } },
      },
      itens_pedido: [],
      pedidos: [{ id: 'ped-1' }],
    },
    invoke: () => adminActions.aprovarEstornoParcialAction('est-1'),
    verificaExec: ({ result, log }) => {
      expect(result).toEqual({ success: true })
      expect(mutou(log, 'pedido_estornos', 'update')).toBe(true)
    },
  },
  {
    nome: 'negarEstornoParcialAction',
    chaves: ['pedidos.estornar'],
    tables: { pedido_estornos: [{ id: 'est-1' }] },
    invoke: () => adminActions.negarEstornoParcialAction('est-1', 'fora do prazo'),
    verificaExec: ({ result, log }) => {
      expect(result).toEqual({ success: true })
      expect(mutou(log, 'pedido_estornos', 'update')).toBe(true)
    },
  },
]

// ── Testes por action ─────────────────────────────────────────────────────────

beforeEach(() => vi.clearAllMocks())

it('pagamentos.confirmar existe como chave de permissão válida', () => {
  expect(isValidPermissionKey('pagamentos.confirmar')).toBe(true)
})

describe.each(specs)('$nome', (spec) => {
  const negar = async () => {
    if (spec.negaEstilo === 'result') {
      const result = await spec.invoke()
      expect(result).toEqual({ success: false, error: 'Acesso negado.' })
    } else {
      await expect(spec.invoke()).rejects.toThrow('Acesso negado.')
    }
  }

  it('nega usuário com todas as permissões exceto as exigidas', async () => {
    const log: LogEntry[] = []
    const outras = PERMISSION_KEYS.filter((k) => !spec.chaves.includes(k))
    const session = makeSession({ role: 'staff', perms: outras, log, tables: spec.tables })
    const adminClient = makeAdmin(spec.tables ?? {}, log)

    await negar()

    expect(mutacoesFora(log)).toEqual([])
    expect(session.rpc).not.toHaveBeenCalled()
    expect(adminClient.rpc).not.toHaveBeenCalled()
    expect(adminClient.auth.admin.generateLink).not.toHaveBeenCalled()
    expect(adminClient.auth.admin.updateUserById).not.toHaveBeenCalled()
  })

  if (spec.somenteAdmin) {
    it('nega até usuário com TODAS as permissões de papel (somente admin)', async () => {
      const log: LogEntry[] = []
      makeSession({ role: 'staff', perms: [...PERMISSION_KEYS], log, tables: spec.tables })
      makeAdmin(spec.tables ?? {}, log)

      await negar()
      expect(mutacoesFora(log)).toEqual([])
    })
  }

  for (const chave of spec.chaves) {
    it(`permite usuário que tem apenas ${chave}`, async () => {
      const log: LogEntry[] = []
      const session = makeSession({ role: 'staff', perms: [chave], log, tables: spec.tables })
      const adminClient = makeAdmin(spec.tables ?? {}, log)

      const result = await spec.invoke()
      spec.verificaExec({ result, log, session, adminClient })
    })
  }

  it('permite admin (app_metadata.role=admin) mesmo sem permissões de papel', async () => {
    const log: LogEntry[] = []
    const session = makeSession({ role: 'admin', perms: [], log, tables: spec.tables })
    const adminClient = makeAdmin(spec.tables ?? {}, log)

    const result = await spec.invoke()
    spec.verificaExec({ result, log, session, adminClient })
  })
})

// ── Matriz do papel Financeiro (usuário real: lucasbentoata@gmail.com) ────────

const PERMS_FINANCEIRO = [
  'pedidos.ver', 'pedidos.estornar', 'pagamentos.ver',
  'vouchers.ver', 'vouchers.gerenciar',
  'alunos.ver', 'responsaveis.ver', 'produtos.ver', 'categorias.ver',
  'configuracoes.ver', 'receita.ver', 'relatorios.ver', 'concurso.ver',
  'checkin.usar',
]

describe('papel Financeiro (permissões reais de prod)', () => {
  it.each(specs.map((s) => [s.nome, s] as const))('%s', async (_nome, spec) => {
    const log: LogEntry[] = []
    const session = makeSession({ role: 'financeiro', perms: PERMS_FINANCEIRO, log, tables: spec.tables })
    const adminClient = makeAdmin(spec.tables ?? {}, log)

    const permitido = spec.chaves.some((c) => PERMS_FINANCEIRO.includes(c))
    if (permitido) {
      const result = await spec.invoke()
      spec.verificaExec({ result, log, session, adminClient })
    } else if (spec.negaEstilo === 'result') {
      const result = await spec.invoke()
      expect(result).toEqual({ success: false, error: 'Acesso negado.' })
      expect(mutacoesFora(log)).toEqual([])
    } else {
      await expect(spec.invoke()).rejects.toThrow('Acesso negado.')
      expect(mutacoesFora(log)).toEqual([])
    }
  })
})
