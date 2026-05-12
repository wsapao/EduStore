import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/permissoes', () => ({
  requirePermission: vi.fn(),
  PermissionDeniedError: class extends Error {},
}))
vi.mock('@/lib/escola/getEscolaIdParaAdmin', () => ({ getEscolaIdParaAdmin: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/permissoes'
import { getEscolaIdParaAdmin } from '@/lib/escola/getEscolaIdParaAdmin'
import {
  atualizarIdentidadeAction,
  atualizarEnderecoAction,
  uploadAssetEscolaAction,
} from '@/app/actions/configuracoes/identidade'

function fd(obj: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(obj)) f.append(k, v)
  return f
}

function makeFile(name: string, type: string, size = 1024): File {
  const blob = new Blob([new Uint8Array(size)], { type })
  return new File([blob], name, { type })
}

describe('atualizarIdentidadeAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('chama requirePermission(configuracoes.editar_identidade)', async () => {
    ;(requirePermission as any).mockRejectedValue(new Error('denied'))
    const r = await atualizarIdentidadeAction(fd({ nome: 'X' }))
    expect(requirePermission).toHaveBeenCalledWith('configuracoes.editar_identidade')
    expect(r.error).toBeDefined()
  })

  it('rejeita nome com menos de 2 caracteres', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    ;(createClient as any).mockResolvedValue({ from: vi.fn() })
    const r = await atualizarIdentidadeAction(fd({ nome: 'A' }))
    expect(r.error).toMatch(/nome/i)
  })

  it('rejeita slogan com mais de 120 caracteres', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    ;(createClient as any).mockResolvedValue({ from: vi.fn() })
    const r = await atualizarIdentidadeAction(fd({ nome: 'Escola', slogan: 'x'.repeat(121) }))
    expect(r.error).toMatch(/slogan/i)
  })

  it('rejeita boas_vindas com mais de 500 caracteres', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    ;(createClient as any).mockResolvedValue({ from: vi.fn() })
    const r = await atualizarIdentidadeAction(fd({ nome: 'Escola', texto_boas_vindas: 'x'.repeat(501) }))
    expect(r.error).toMatch(/boas/i)
  })

  it('atualiza a tabela escolas no caminho feliz', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn(() => ({ eq }))
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    ;(createClient as any).mockResolvedValue({ from: vi.fn(() => ({ update })) })

    const r = await atualizarIdentidadeAction(fd({
      nome: 'Colégio X',
      razao_social: 'Colégio X LTDA',
      cnpj: '12345678000190',
      slogan: 'Aprender',
      texto_boas_vindas: 'Bem-vindo!',
      cor_primaria: '#ff8800',
    }))

    expect(r).toEqual({ success: true })
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      nome: 'Colégio X',
      razao_social: 'Colégio X LTDA',
      cnpj: '12345678000190',
      slogan: 'Aprender',
      texto_boas_vindas: 'Bem-vindo!',
      cor_primaria: '#ff8800',
    }))
    expect(eq).toHaveBeenCalledWith('id', 'esc-1')
  })

  it('retorna erro se update falhar', async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: 'boom' } })
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    ;(createClient as any).mockResolvedValue({ from: vi.fn(() => ({ update: () => ({ eq }) })) })

    const r = await atualizarIdentidadeAction(fd({ nome: 'Escola X' }))
    expect(r.error).toMatch(/salvar/i)
  })

  it('aceita cor_primaria vazia (sem alterar a existente)', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn(() => ({ eq }))
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    ;(createClient as any).mockResolvedValue({ from: vi.fn(() => ({ update })) })

    await atualizarIdentidadeAction(fd({ nome: 'Escola X' }))
    const payload = update.mock.calls[0][0]
    expect(payload).not.toHaveProperty('cor_primaria')
  })
})

describe('atualizarEnderecoAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exige permissão configuracoes.editar_identidade', async () => {
    ;(requirePermission as any).mockRejectedValue(new Error('denied'))
    const r = await atualizarEnderecoAction(fd({}))
    expect(requirePermission).toHaveBeenCalledWith('configuracoes.editar_identidade')
    expect(r.error).toBeDefined()
  })

  it('rejeita CEP com formato inválido', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    ;(createClient as any).mockResolvedValue({ from: vi.fn() })
    const r = await atualizarEnderecoAction(fd({ endereco_cep: '123' }))
    expect(r.error).toMatch(/cep/i)
  })

  it('rejeita UF com mais de 2 caracteres', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    ;(createClient as any).mockResolvedValue({ from: vi.fn() })
    const r = await atualizarEnderecoAction(fd({ endereco_uf: 'SPP' }))
    expect(r.error).toMatch(/uf/i)
  })

  it('salva endereço completo com CEP e UF normalizados', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn(() => ({ eq }))
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    ;(createClient as any).mockResolvedValue({ from: vi.fn(() => ({ update })) })

    const r = await atualizarEnderecoAction(fd({
      endereco_logradouro: 'Rua das Flores',
      endereco_numero: '123',
      endereco_bairro: 'Centro',
      endereco_cidade: 'Recife',
      endereco_uf: 'pe',
      endereco_cep: '50000-000',
    }))

    expect(r).toEqual({ success: true })
    expect(update).toHaveBeenCalledWith({
      endereco_logradouro: 'Rua das Flores',
      endereco_numero: '123',
      endereco_bairro: 'Centro',
      endereco_cidade: 'Recife',
      endereco_uf: 'PE',
      endereco_cep: '50000000',
    })
  })

  it('aceita endereço parcial (campos vazios viram null)', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn(() => ({ eq }))
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    ;(createClient as any).mockResolvedValue({ from: vi.fn(() => ({ update })) })

    await atualizarEnderecoAction(fd({ endereco_cidade: 'Recife' }))
    expect(update).toHaveBeenCalledWith({
      endereco_logradouro: null,
      endereco_numero: null,
      endereco_bairro: null,
      endereco_cidade: 'Recife',
      endereco_uf: null,
      endereco_cep: null,
    })
  })
})

describe('uploadAssetEscolaAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejeita kind inválido', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    const r = await uploadAssetEscolaAction('invalido' as any, makeFile('a.png', 'image/png'))
    expect(r.error).toMatch(/tipo/i)
  })

  it('rejeita arquivo vazio', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    const r = await uploadAssetEscolaAction('logo', makeFile('a.png', 'image/png', 0))
    expect(r.error).toMatch(/arquivo/i)
  })

  it('rejeita MIME inválido', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    const r = await uploadAssetEscolaAction('logo', makeFile('a.exe', 'application/octet-stream'))
    expect(r.error).toMatch(/imagem|formato/i)
  })

  it('rejeita arquivo maior que 2MB', async () => {
    ;(requirePermission as any).mockResolvedValue(undefined)
    const r = await uploadAssetEscolaAction('banner', makeFile('big.jpg', 'image/jpeg', 3 * 1024 * 1024))
    expect(r.error).toMatch(/2/)
  })

  it('faz upload no bucket escola-assets e atualiza coluna correspondente', async () => {
    const upload = vi.fn().mockResolvedValue({ data: { path: 'esc-1/logo-123.png' }, error: null })
    const getPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://supabase/.../logo-123.png' } })
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn(() => ({ eq }))

    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    ;(createClient as any).mockResolvedValue({
      storage: { from: vi.fn(() => ({ upload, getPublicUrl })) },
      from: vi.fn(() => ({ update })),
    })

    const r = await uploadAssetEscolaAction('logo', makeFile('logo.png', 'image/png'))
    expect(r).toEqual({ success: true, url: 'https://supabase/.../logo-123.png' })
    expect(upload).toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith({ logo_url: 'https://supabase/.../logo-123.png' })
  })

  it('atualiza banner_url quando kind=banner', async () => {
    const upload = vi.fn().mockResolvedValue({ data: { path: 'esc-1/banner.jpg' }, error: null })
    const getPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://x/banner.jpg' } })
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn(() => ({ eq }))

    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    ;(createClient as any).mockResolvedValue({
      storage: { from: vi.fn(() => ({ upload, getPublicUrl })) },
      from: vi.fn(() => ({ update })),
    })

    await uploadAssetEscolaAction('banner', makeFile('banner.jpg', 'image/jpeg'))
    expect(update).toHaveBeenCalledWith({ banner_url: 'https://x/banner.jpg' })
  })

  it('retorna erro se upload falhar', async () => {
    const upload = vi.fn().mockResolvedValue({ data: null, error: { message: 'storage err' } })
    ;(requirePermission as any).mockResolvedValue(undefined)
    ;(getEscolaIdParaAdmin as any).mockResolvedValue('esc-1')
    ;(createClient as any).mockResolvedValue({
      storage: { from: vi.fn(() => ({ upload, getPublicUrl: vi.fn() })) },
      from: vi.fn(),
    })

    const r = await uploadAssetEscolaAction('logo', makeFile('logo.png', 'image/png'))
    expect(r.error).toMatch(/upload|falha/i)
  })
})
