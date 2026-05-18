import Link from 'next/link'
import { currentPermissions } from '@/lib/permissoes'

const CARDS = [
  { href: '/admin/configuracoes/loja',       titulo: 'Identidade & Personalização', descricao: 'Logo, banner, cores, dados fiscais', perm: 'configuracoes.editar_identidade' },
  { href: '/admin/configuracoes/loja-online', titulo: 'Loja Online',                descricao: 'Manutenção, horário, layout e destaque da home', perm: 'configuracoes.editar_identidade' },
  { href: '/admin/configuracoes/usuarios',   titulo: 'Usuários',                     descricao: 'Convidar, suspender, mudar papéis', perm: 'configuracoes.gerenciar_usuarios' },
  { href: '/admin/configuracoes/papeis',     titulo: 'Papéis & Permissões',          descricao: 'Customize quem acessa o quê', perm: 'configuracoes.gerenciar_papeis' },
  { href: '/admin/configuracoes/pagamentos', titulo: 'Pagamentos',                   descricao: 'Métodos, parcelas, PIX, webhook', perm: 'configuracoes.editar_pagamentos' },
  { href: '/admin/configuracoes/conta',      titulo: 'Minha Conta',                  descricao: 'Senha, MFA, sessões', perm: 'configuracoes.ver' },
]

export default async function ConfiguracoesIndexPage() {
  const perms = await currentPermissions()
  const visiveis = CARDS.filter(c => perms.includes(c.perm))

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-1)', marginBottom: 8 }}>
        Configurações
      </h1>
      <p style={{ color: 'var(--text-3)', marginBottom: 32 }}>
        Personalize sua loja, gerencie acessos e ajuste a operação.
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 16,
      }}>
        {visiveis.map(c => (
          <Link key={c.href} href={c.href} style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: 20,
            textDecoration: 'none',
            color: 'var(--text-1)',
            transition: 'all .2s',
          }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>{c.titulo}</div>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{c.descricao}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
