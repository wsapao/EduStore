import { describe, expect, it } from 'vitest'

import { getAdminButtonStyle } from '@/lib/admin-ui-tones'
import {
  getDuplicarUi,
  getToggleAtivoUi,
  getToggleEsgotadoUi,
} from '@/app/(admin)/admin/produtos/produtoAcoesUi'

describe('getToggleAtivoUi', () => {
  it('produto ativo → botão de desativar em tom danger', () => {
    const ui = getToggleAtivoUi({ isAtivo: true, pending: false })

    expect(ui.label).toBe('⏸ Desativar')
    expect(ui.toastSuccess).toBe('Produto desativado.')
    expect(ui.style).toMatchObject(
      getAdminButtonStyle('danger', 'soft', { width: '100%', height: 42, borderRadius: 10 }),
    )
  })

  it('produto inativo → botão de ativar em tom success', () => {
    const ui = getToggleAtivoUi({ isAtivo: false, pending: false })

    expect(ui.label).toBe('▶ Ativar')
    expect(ui.toastSuccess).toBe('Produto ativado.')
    expect(ui.style).toMatchObject(
      getAdminButtonStyle('success', 'soft', { width: '100%', height: 42, borderRadius: 10 }),
    )
  })

  it('pendente → label de progresso e cursor de espera', () => {
    const desativando = getToggleAtivoUi({ isAtivo: true, pending: true })
    const ativando = getToggleAtivoUi({ isAtivo: false, pending: true })

    expect(desativando.label).toBe('Desativando…')
    expect(ativando.label).toBe('Ativando…')
    expect(desativando.style.cursor).toBe('wait')
  })
})

describe('getToggleEsgotadoUi', () => {
  it('produto disponível → botão de esgotar em tom warning', () => {
    const ui = getToggleEsgotadoUi({ isEsgotado: false, pending: false })

    expect(ui.label).toBe('🚫 Esgotar')
    expect(ui.toastSuccess).toBe('Produto marcado como esgotado.')
    expect(ui.style).toMatchObject(
      getAdminButtonStyle('warning', 'soft', { width: '100%', height: 42, borderRadius: 10 }),
    )
  })

  it('produto esgotado → botão de reativar em tom success', () => {
    const ui = getToggleEsgotadoUi({ isEsgotado: true, pending: false })

    expect(ui.label).toBe('↩ Reativar')
    expect(ui.toastSuccess).toBe('Produto disponível novamente.')
    expect(ui.style).toMatchObject(
      getAdminButtonStyle('success', 'soft', { width: '100%', height: 42, borderRadius: 10 }),
    )
  })

  it('pendente → label de progresso e cursor de espera', () => {
    const esgotando = getToggleEsgotadoUi({ isEsgotado: false, pending: true })
    const reativando = getToggleEsgotadoUi({ isEsgotado: true, pending: true })

    expect(esgotando.label).toBe('Esgotando…')
    expect(reativando.label).toBe('Reativando…')
    expect(esgotando.style.cursor).toBe('wait')
  })
})

describe('getDuplicarUi', () => {
  it('estado normal → botão neutro de duplicar', () => {
    const ui = getDuplicarUi({ pending: false })

    expect(ui.label).toBe('📋 Duplicar')
    expect(ui.toastSuccess).toBe('Produto duplicado — a cópia foi criada inativa.')
    expect(ui.style).toMatchObject(
      getAdminButtonStyle('neutral', 'soft', { width: '100%', height: 42, borderRadius: 10 }),
    )
  })

  it('pendente → label de progresso e cursor de espera', () => {
    const ui = getDuplicarUi({ pending: true })

    expect(ui.label).toBe('Duplicando…')
    expect(ui.style.cursor).toBe('wait')
  })
})
