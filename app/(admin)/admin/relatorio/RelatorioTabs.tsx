'use client'

import Link from 'next/link'

const TABS = [
  { key: 'presenca', label: '🎟️ Presença', href: '/admin/relatorio' },
  { key: 'compras', label: '🛒 Compras', href: '/admin/relatorio?tab=compras' },
] as const

export function RelatorioTabs({ tab }: { tab: 'presenca' | 'compras' }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
      {TABS.map(t => {
        const ativo = t.key === tab
        return (
          <Link
            key={t.key}
            href={t.href}
            style={{
              padding: '8px 18px', borderRadius: 999, fontSize: 13, fontWeight: 700,
              textDecoration: 'none',
              background: ativo ? 'var(--brand)' : 'var(--surface-2)',
              color: ativo ? '#fff' : 'var(--text-2)',
              border: ativo ? '1px solid transparent' : '1px solid var(--border)',
            }}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
