'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type ConfigLink = {
  href: string
  label: string
  perm: string
  fase: 1 | 2 | 3
}

const GROUPS: { titulo: string; links: ConfigLink[] }[] = [
  {
    titulo: 'Loja',
    links: [
      { href: '/admin/configuracoes/loja',         label: 'Identidade & Personalização', perm: 'configuracoes.editar_identidade', fase: 1 },
      { href: '/admin/configuracoes/loja-online',  label: 'Loja Online',                  perm: 'configuracoes.editar_identidade', fase: 2 },
    ],
  },
  {
    titulo: 'Acesso',
    links: [
      { href: '/admin/configuracoes/usuarios', label: 'Usuários', perm: 'configuracoes.gerenciar_usuarios', fase: 1 },
      { href: '/admin/configuracoes/papeis',   label: 'Papéis & Permissões', perm: 'configuracoes.gerenciar_papeis', fase: 1 },
      { href: '/admin/configuracoes/conta',    label: 'Minha Conta', perm: 'configuracoes.ver', fase: 1 },
    ],
  },
  {
    titulo: 'Operação',
    links: [
      { href: '/admin/configuracoes/pagamentos', label: 'Pagamentos', perm: 'configuracoes.editar_pagamentos', fase: 1 },
      { href: '/admin/configuracoes/emails',     label: 'E-mails', perm: 'configuracoes.editar_identidade', fase: 2 },
      { href: '/admin/configuracoes/cantina',    label: 'Cantina', perm: 'configuracoes.editar_identidade', fase: 2 },
      { href: '/admin/configuracoes/checkout',   label: 'Checkout', perm: 'configuracoes.editar_identidade', fase: 2 },
      { href: '/admin/configuracoes/termos',     label: 'Termos & LGPD', perm: 'configuracoes.editar_identidade', fase: 2 },
    ],
  },
  {
    titulo: 'Avançado',
    links: [
      { href: '/admin/configuracoes/integracoes', label: 'Integrações', perm: 'configuracoes.editar_identidade', fase: 2 },
      { href: '/admin/configuracoes/auditoria',   label: 'Auditoria',   perm: 'configuracoes.ver', fase: 3 },
      { href: '/admin/configuracoes/dados',       label: 'Dados & LGPD', perm: 'configuracoes.ver', fase: 3 },
    ],
  },
]

export function ConfigSidebar({ permissoes }: { permissoes: string[] }) {
  const pathname = usePathname()
  const allowed = (p: string) => permissoes.includes(p)

  return (
    <aside style={{
      width: 260, padding: '24px 12px',
      background: 'rgba(0,0,0,0.15)',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      minHeight: 'calc(100dvh - 48px)',
    }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc', padding: '0 12px 16px' }}>
        Configurações
      </h2>
      {GROUPS.map(group => {
        const visible = group.links.filter(l => allowed(l.perm))
        if (visible.length === 0) return null
        return (
          <div key={group.titulo} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 6, paddingLeft: 12 }}>
              {group.titulo}
            </div>
            {visible.map(l => {
              const active = pathname === l.href
              return (
                <Link key={l.href} href={l.href} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 10,
                  fontSize: 13, fontWeight: active ? 800 : 600,
                  color: active ? '#fff' : '#cbd5e1',
                  background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                  textDecoration: 'none',
                }}>
                  <span>{l.label}</span>
                  {l.fase > 1 && (
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: 'rgba(245,158,11,.15)', color: '#f59e0b', fontWeight: 700 }}>
                      F{l.fase}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        )
      })}
    </aside>
  )
}
