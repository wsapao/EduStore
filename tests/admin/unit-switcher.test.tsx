// @vitest-environment jsdom
//
// Único arquivo de teste do repo que roda em jsdom (via docblock acima) —
// o resto da suíte roda em 'node' (vitest.config.ts). Mantém o ambiente
// pesado isolado a este componente cliente.
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const trocarUnidadeMock = vi.hoisted(() => vi.fn())
const refreshMock = vi.hoisted(() => vi.fn())

vi.mock('@/app/actions/trocar-unidade', () => ({
  trocarUnidade: trocarUnidadeMock,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

import { UnitSwitcher } from '@/app/(admin)/UnitSwitcher'

const HORIZONTE = { id: 'esc-horizonte', nome: 'Colégio Horizonte' }
const SAO_JUDAS = { id: 'esc-sao-judas', nome: 'São Judas I' }

describe('UnitSwitcher', () => {
  beforeEach(() => {
    trocarUnidadeMock.mockReset()
    refreshMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('com 1 única escola mostra só o nome, sem botão nem menu', () => {
    render(<UnitSwitcher escolas={[HORIZONTE]} escolaAtivaId={HORIZONTE.id} />)

    expect(screen.getByText('Colégio Horizonte')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('com 0 escolas não quebra e não renderiza interatividade', () => {
    render(<UnitSwitcher escolas={[]} escolaAtivaId={null} />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('com 2+ escolas mostra botão com a unidade ativa, fechado por padrão', () => {
    render(<UnitSwitcher escolas={[HORIZONTE, SAO_JUDAS]} escolaAtivaId={HORIZONTE.id} />)

    const trigger = screen.getByRole('button', { name: /Trocar unidade — atual: Colégio Horizonte/ })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('clicar no botão abre o menu listando as outras unidades e marca a ativa', () => {
    render(<UnitSwitcher escolas={[HORIZONTE, SAO_JUDAS]} escolaAtivaId={HORIZONTE.id} />)

    fireEvent.click(screen.getByRole('button', { name: /Trocar unidade/ }))

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('menuitemradio', { name: 'São Judas I' })).toBeInTheDocument()
    expect(screen.getByRole('menuitemradio', { name: 'Colégio Horizonte' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('menuitemradio', { name: 'São Judas I' })).toHaveAttribute('aria-checked', 'false')
  })

  it('selecionar outra unidade chama trocarUnidade com o id dela e depois router.refresh()', async () => {
    trocarUnidadeMock.mockResolvedValue({ ok: true })

    render(<UnitSwitcher escolas={[HORIZONTE, SAO_JUDAS]} escolaAtivaId={HORIZONTE.id} />)

    fireEvent.click(screen.getByRole('button', { name: /Trocar unidade/ }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'São Judas I' }))

    // Fecha o menu de imediato, sem esperar a action resolver.
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    await waitFor(() => {
      expect(trocarUnidadeMock).toHaveBeenCalledWith(SAO_JUDAS.id)
    })
    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalledTimes(1)
    })
  })

  it('clicar na própria unidade ativa não chama trocarUnidade', () => {
    render(<UnitSwitcher escolas={[HORIZONTE, SAO_JUDAS]} escolaAtivaId={HORIZONTE.id} />)

    fireEvent.click(screen.getByRole('button', { name: /Trocar unidade/ }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Colégio Horizonte' }))

    expect(trocarUnidadeMock).not.toHaveBeenCalled()
    expect(refreshMock).not.toHaveBeenCalled()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('Escape fecha o menu', () => {
    render(<UnitSwitcher escolas={[HORIZONTE, SAO_JUDAS]} escolaAtivaId={HORIZONTE.id} />)

    fireEvent.click(screen.getByRole('button', { name: /Trocar unidade/ }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('clique fora fecha o menu', () => {
    render(
      <div>
        <div data-testid="outside">fora</div>
        <UnitSwitcher escolas={[HORIZONTE, SAO_JUDAS]} escolaAtivaId={HORIZONTE.id} />
      </div>
    )

    fireEvent.click(screen.getByRole('button', { name: /Trocar unidade/ }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByTestId('outside'))

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
