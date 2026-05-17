'use client'

/**
 * Badge flutuante que mostra o estado de conectividade do PDV e o
 * último horário de sincronização. Inclui botão "sincronizar" pra
 * forçar pull manual quando online.
 *
 * Refresca o `last_sync_at` a cada 5s pra refletir pulls disparados
 * pelo loop em background (`startBackgroundSync`).
 */
import { useEffect, useState } from 'react'
import { useOnlineStatus } from '@/lib/pdv-offline/network'
import { getLastSyncAt, pullSnapshot } from '@/lib/pdv-offline/sync'

function formatTimeSince(iso: string | null): string {
  if (!iso) return 'nunca'
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 5) return 'agora'
  if (s < 60) return `há ${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `há ${m}min`
  const h = Math.floor(m / 60)
  return `há ${h}h`
}

export function SyncStatusBadge() {
  const { online } = useOnlineStatus()
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [sincronizando, setSincronizando] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function refresh() {
      const v = await getLastSyncAt()
      if (!cancelled) setLastSync(v)
    }
    void refresh()
    const id = setInterval(refresh, 5000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  async function handleSyncNow() {
    if (sincronizando) return
    setSincronizando(true)
    await pullSnapshot()
    const v = await getLastSyncAt()
    setLastSync(v)
    setSincronizando(false)
  }

  const cor = sincronizando ? '#3b82f6' : online ? '#16a34a' : '#dc2626'
  const icon = sincronizando ? '🔄' : online ? '🟢' : '🔴'
  const label = sincronizando ? 'Sincronizando…' : online ? 'Online' : 'Offline'

  return (
    <div style={{
      position: 'fixed', top: 12, right: 12, zIndex: 100,
      background: 'white', border: `1.5px solid ${cor}`,
      borderRadius: 999, padding: '6px 12px',
      fontSize: 12, fontWeight: 600, color: cor,
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span>{icon}</span>
      <span>{label}</span>
      <span style={{ color: '#64748b', fontWeight: 400 }}>· sync {formatTimeSince(lastSync)}</span>
      {online && !sincronizando && (
        <button
          onClick={handleSyncNow}
          style={{
            background: 'transparent', border: 'none', color: cor,
            cursor: 'pointer', fontSize: 12, padding: 0, fontWeight: 600,
            textDecoration: 'underline',
          }}
        >
          sincronizar
        </button>
      )}
    </div>
  )
}
