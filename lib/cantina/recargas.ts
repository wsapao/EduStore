import type { AdminUiTone } from '@/lib/admin-ui-tones'

type RecargaStatusMeta = {
  label: string
  tone: AdminUiTone
}

type RecargaMetodoMeta = {
  label: string
  icon: string
  tone: AdminUiTone
}

type RecargaEventMetaInput = {
  status: string
  created_at: string
  confirmada_em: string | null
  cancelada_em: string | null
  estornada_em: string | null
}

const STATUS_META: Record<string, RecargaStatusMeta> = {
  aguardando: { label: 'Aguardando', tone: 'warning' },
  confirmada: { label: 'Confirmada', tone: 'success' },
  expirada: { label: 'Expirada', tone: 'muted' },
  cancelada: { label: 'Cancelada', tone: 'neutral' },
  estornada: { label: 'Estornada', tone: 'violet' },
  estorno_aprovado: { label: 'Estorno em andamento', tone: 'warning' },
  falhou: { label: 'Falhou', tone: 'danger' },
}

const METODO_META: Record<string, RecargaMetodoMeta> = {
  pix: { label: 'PIX', icon: '⚡', tone: 'warning' },
  cartao: { label: 'Cartão', icon: '💳', tone: 'info' },
}

export function getRecargaStatusMeta(status: string) {
  return STATUS_META[status] ?? STATUS_META.falhou
}

export function getRecargaMetodoMeta(metodo: string) {
  return METODO_META[metodo] ?? { label: 'Método não informado', icon: '•', tone: 'muted' as const }
}

export function getRecargaPrimaryEvent(recarga: RecargaEventMetaInput) {
  if (recarga.status === 'estornada' && recarga.estornada_em) {
    return { label: 'Estornada em', value: recarga.estornada_em }
  }

  if (recarga.status === 'cancelada' && recarga.cancelada_em) {
    return { label: 'Cancelada em', value: recarga.cancelada_em }
  }

  if (recarga.status === 'confirmada' && recarga.confirmada_em) {
    return { label: 'Confirmada em', value: recarga.confirmada_em }
  }

  return { label: 'Solicitada em', value: recarga.created_at }
}

export function formatGatewayId(gatewayId: string | null) {
  if (!gatewayId?.trim()) {
    return 'Não informado'
  }

  if (gatewayId.length <= 13) {
    return gatewayId
  }

  return `${gatewayId.slice(0, 8)}...${gatewayId.slice(-4)}`
}
