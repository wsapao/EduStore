import type { CSSProperties } from 'react'
import { getAdminButtonStyle } from '@/lib/admin-ui-tones'

export interface ProdutoAcaoUi {
  label: string
  toastSuccess: string
  style: CSSProperties
}

const ACTION_BUTTON_SIZE = { width: '100%', height: 42, borderRadius: 10 } as const

function withPendingCursor(style: CSSProperties, pending: boolean): CSSProperties {
  return pending ? { ...style, cursor: 'wait' } : style
}

export function getToggleAtivoUi({ isAtivo, pending }: { isAtivo: boolean; pending: boolean }): ProdutoAcaoUi {
  const style = getAdminButtonStyle(isAtivo ? 'danger' : 'success', 'soft', ACTION_BUTTON_SIZE)
  return {
    label: pending ? (isAtivo ? 'Desativando…' : 'Ativando…') : (isAtivo ? '⏸ Desativar' : '▶ Ativar'),
    toastSuccess: isAtivo ? 'Produto desativado.' : 'Produto ativado.',
    style: withPendingCursor(style, pending),
  }
}

export function getToggleEsgotadoUi({ isEsgotado, pending }: { isEsgotado: boolean; pending: boolean }): ProdutoAcaoUi {
  const style = getAdminButtonStyle(isEsgotado ? 'success' : 'warning', 'soft', ACTION_BUTTON_SIZE)
  return {
    label: pending ? (isEsgotado ? 'Reativando…' : 'Esgotando…') : (isEsgotado ? '↩ Reativar' : '🚫 Esgotar'),
    toastSuccess: isEsgotado ? 'Produto disponível novamente.' : 'Produto marcado como esgotado.',
    style: withPendingCursor(style, pending),
  }
}

export function getDuplicarUi({ pending }: { pending: boolean }): ProdutoAcaoUi {
  const style = getAdminButtonStyle('neutral', 'soft', ACTION_BUTTON_SIZE)
  return {
    label: pending ? 'Duplicando…' : '📋 Duplicar',
    toastSuccess: 'Produto duplicado — a cópia foi criada inativa.',
    style: withPendingCursor(style, pending),
  }
}
