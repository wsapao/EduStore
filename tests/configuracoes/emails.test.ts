import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auditoria/log', () => ({ auditLog: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/permissoes', () => ({
  requirePermission: vi.fn(),
  PermissionDeniedError: class extends Error {},
}))
vi.mock('@/lib/escola/getEscolaIdParaAdmin', () => ({ getEscolaIdParaAdmin: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/email/resend', () => ({
  getResend: vi.fn(),
  EMAIL_FROM: 'Loja Escolar <noreply@test>',
}))

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/permissoes'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import { getResend } from '@/lib/email/resend'
import { auditLog } from '@/lib/auditoria/log'
import {
  listarTemplatesEmailAction,
  salvarTemplateEmailAction,
  restaurarPadraoTemplateAction,
  enviarTesteEmailAction,
} from '@/app/actions/configuracoes/emails'
import { EMAIL_TEMPLATE_TYPES } from '@/lib/email/templates-config'

function setupAuthAndEscola(opts: { userId?: string | null; userEmail?: string | null; escolaId?: string | null } = {}) {
  const userId = opts.userId === undefined ? 'user-1' : opts.userId
  const userEmail = opts.userEmail === undefined ? 'admin@escola.com' : opts.userEmail
  const escolaId = opts.escolaId === undefined ? 'esc-1' : opts.escolaId
  ;(getEscolaIdParaAdmin as any).mockResolvedValue(escolaId)
  return { userId, userEmail, escolaId }
}

describe('listarTemplatesEmailAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exige permissão configuracoes.editar_identidade', async () => {
    ;(requirePermission as any).mockRejectedValue(new Error('denied'))
    const r = await listarTemplatesEmailAction()
    expect(requirePermission).toHaveBeenCalledWith('configuracoes.editar_identidade')
    expect((r as any).error).toBeDefined()
  })

  it('retorna 8 entries com customizado=false quando o banco está vazio', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    setupAuthAndEscola()

    const eqEscola = vi.fn().mockResolvedValue({ data: [], error: null })
    const select = vi.fn(() => ({ eq: eqEscola }))
    ;(createClient as any).mockResolvedValue({
      from: vi.fn(() => ({ select })),
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    })

    const r = await listarTemplatesEmailAction()
    expect('templates' in r).toBe(true)
    if (!('templates' in r)) return
    expect(r.templates).toHaveLength(8)
    for (let i = 0; i < EMAIL_TEMPLATE_TYPES.length; i++) {
      expect(r.templates[i].tipo).toBe(EMAIL_TEMPLATE_TYPES[i])
      expect(r.templates[i].customizado).toBe(false)
      expect(r.templates[i].updated_at).toBeNull()
      expect(r.templates[i].updated_by_email).toBeNull()
      expect(r.templates[i].assunto).toBeTruthy()
      expect(r.templates[i].corpo).toBeTruthy()
    }
  })

  it('marca customizado=true e enriquece updated_by_email quando há row no banco', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    setupAuthAndEscola()

    const dataRows = [
      {
        tipo: 'pedido_pago',
        assunto: 'Custom assunto',
        corpo: 'Custom corpo bem maior que dez chars',
        updated_at: '2026-05-14T10:00:00Z',
        updated_by: 'user-A',
      },
    ]
    const eqEscola = vi.fn().mockResolvedValue({ data: dataRows, error: null })
    const select = vi.fn(() => ({ eq: eqEscola }))
    ;(createClient as any).mockResolvedValue({
      from: vi.fn(() => ({ select })),
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    })

    const getUserById = vi.fn().mockResolvedValue({
      data: { user: { email: 'admin-A@escola.com' } },
      error: null,
    })
    ;(createAdminClient as any).mockReturnValue({
      auth: { admin: { getUserById } },
    })

    const r = await listarTemplatesEmailAction()
    if (!('templates' in r)) throw new Error('expected templates')

    const pago = r.templates.find((t) => t.tipo === 'pedido_pago')!
    expect(pago.customizado).toBe(true)
    expect(pago.assunto).toBe('Custom assunto')
    expect(pago.updated_by_email).toBe('admin-A@escola.com')
    expect(getUserById).toHaveBeenCalledWith('user-A')

    // outros continuam padrão
    const outros = r.templates.filter((t) => t.tipo !== 'pedido_pago')
    expect(outros.every((t) => t.customizado === false)).toBe(true)
  })
})

describe('salvarTemplateEmailAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejeita tipo inválido', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    const r = await salvarTemplateEmailAction({
      tipo: 'invalido' as any,
      assunto: 'OK assunto',
      corpo: 'corpo bem grande para passar',
    })
    expect((r as any).error).toMatch(/tipo/i)
  })

  it('rejeita assunto vazio', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    const r = await salvarTemplateEmailAction({
      tipo: 'pedido_pago',
      assunto: '  ',
      corpo: 'corpo razoavelmente grande',
    })
    expect((r as any).error).toMatch(/assunto/i)
  })

  it('rejeita corpo curto (< 10 chars)', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    const r = await salvarTemplateEmailAction({
      tipo: 'pedido_pago',
      assunto: 'Assunto válido',
      corpo: 'curto',
    })
    expect((r as any).error).toMatch(/corpo/i)
  })

  it('happy path: chama upsert com onConflict correto', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    setupAuthAndEscola()

    const upsert = vi.fn().mockResolvedValue({ error: null })
    ;(createClient as any).mockResolvedValue({
      from: vi.fn(() => ({ upsert })),
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    })

    const r = await salvarTemplateEmailAction({
      tipo: 'pedido_pago',
      assunto: 'Pedido pago aqui',
      corpo: 'Olá responsável, seu pedido foi pago.',
    })
    expect(r).toEqual({ success: true })

    expect(upsert).toHaveBeenCalledTimes(1)
    const [payload, opts] = (upsert.mock.calls[0] as any[])
    expect(payload).toMatchObject({
      escola_id: 'esc-1',
      tipo: 'pedido_pago',
      assunto: 'Pedido pago aqui',
      corpo: 'Olá responsável, seu pedido foi pago.',
      updated_by: 'user-1',
    })
    expect(opts).toEqual({ onConflict: 'escola_id,tipo' })
    expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({
      modulo: 'emails',
      acao: 'salvou_template',
      metadata: expect.objectContaining({ tipo: 'pedido_pago' }),
    }))
  })
})

describe('restaurarPadraoTemplateAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('chama delete filtrado por escola_id e tipo', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    setupAuthAndEscola()

    const eqTipo = vi.fn().mockResolvedValue({ error: null })
    const eqEscola = vi.fn(() => ({ eq: eqTipo }))
    const del = vi.fn(() => ({ eq: eqEscola }))
    ;(createClient as any).mockResolvedValue({
      from: vi.fn(() => ({ delete: del })),
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    })

    const r = await restaurarPadraoTemplateAction({ tipo: 'pedido_pago' })
    expect(r).toEqual({ success: true })
    expect(del).toHaveBeenCalled()
    expect(eqEscola).toHaveBeenCalledWith('escola_id', 'esc-1')
    expect(eqTipo).toHaveBeenCalledWith('tipo', 'pedido_pago')
    expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({
      modulo: 'emails',
      acao: 'restaurou_padrao',
    }))
  })
})

describe('enviarTesteEmailAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna erro se Resend não configurado', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    setupAuthAndEscola()
    ;(getResend as any).mockReturnValue(null)
    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1', email: 'admin@escola.com' } } }) },
      from: vi.fn(),
    })

    const r = await enviarTesteEmailAction({ tipo: 'pedido_pago' })
    expect((r as any).error).toMatch(/RESEND_API_KEY/i)
  })

  it('happy path: envia e-mail com texto renderizado e retorna destinatario', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    setupAuthAndEscola()

    const send = vi.fn().mockResolvedValue({ data: { id: 'msg-1' }, error: null })
    ;(getResend as any).mockReturnValue({ emails: { send } })

    // Mock createClient: dois usos — auth.getUser e from('email_templates') (vindo de getTemplateEmail)
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const eqTipo = vi.fn(() => ({ maybeSingle }))
    const eqEscola = vi.fn(() => ({ eq: eqTipo }))
    const select = vi.fn(() => ({ eq: eqEscola }))
    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1', email: 'admin@escola.com' } } }) },
      from: vi.fn(() => ({ select })),
    })

    const r = await enviarTesteEmailAction({ tipo: 'pedido_pago' })
    expect(r).toEqual({ success: true, destinatario: 'admin@escola.com' })

    expect(send).toHaveBeenCalledTimes(1)
    const payload = send.mock.calls[0][0] as any
    expect(payload.to).toBe('admin@escola.com')
    expect(payload.from).toBeTruthy()
    expect(payload.subject).toMatch(/\[TESTE\]/)
    expect(payload.text).toBeTruthy()
    // garantir que o texto não contém placeholders {{...}} (todos foram preenchidos)
    expect(payload.text).not.toMatch(/\{\{[^}]+\}\}/)

    expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({
      modulo: 'emails',
      acao: 'enviou_teste',
      metadata: expect.objectContaining({ tipo: 'pedido_pago', destinatario: 'admin@escola.com' }),
    }))
  })

  // Guarda anti-injeção: o corpo renderizado por renderEmailTemplate NÃO é
  // HTML-escapado, então ele só pode ser enviado como `text` (text/plain).
  // Se este teste quebrar porque o envio passou a usar `html`, é obrigatório
  // escapar os valores substituídos (escapeHtml em lib/email/templates.ts)
  // antes — template do banco + nomes de responsável/aluno viram vetor de
  // injeção de HTML no cliente de e-mail.
  it('envia como text/plain (nunca html), mesmo com template do banco contendo HTML', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    setupAuthAndEscola()

    const send = vi.fn().mockResolvedValue({ data: { id: 'msg-1' }, error: null })
    ;(getResend as any).mockReturnValue({ emails: { send } })

    // Template customizado no banco com HTML malicioso no corpo
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        assunto: 'Pedido {{numero_pedido}}',
        corpo: '<script>alert(1)</script> Olá {{nome_responsavel}}',
        ativo: true,
      },
      error: null,
    })
    const eqTipo = vi.fn(() => ({ maybeSingle }))
    const eqEscola = vi.fn(() => ({ eq: eqTipo }))
    const select = vi.fn(() => ({ eq: eqEscola }))
    ;(createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1', email: 'admin@escola.com' } } }) },
      from: vi.fn(() => ({ select })),
    })

    const r = await enviarTesteEmailAction({ tipo: 'pedido_pago' })
    expect(r).toEqual({ success: true, destinatario: 'admin@escola.com' })

    expect(send).toHaveBeenCalledTimes(1)
    const payload = send.mock.calls[0][0] as any
    // O payload NÃO pode ter parte HTML — texto puro é o que torna o
    // conteúdo não-escapado inofensivo.
    expect(payload.html).toBeUndefined()
    expect(payload.react).toBeUndefined()
    expect(payload.text).toContain('<script>alert(1)</script> Olá Maria Silva')
  })
})
