import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ProdutoForm } from '../../ProdutoForm'
import { normalizarProduto, normalizarVariantes } from '@/lib/produtos/normalizers'
import type { Produto, ProdutoVariante } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditarProdutoPage({ params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') redirect('/loja')

  const { data } = await supabase
    .from('produtos')
    .select('*, variantes_rel:produto_variantes(*)')
    .eq('id', id)
    .single()

  const { data: categorias } = await supabase
    .from('categorias_produto')
    .select('*')
    .eq('ativo', true)
    .order('nome')

  if (!data) notFound()

  const produto = normalizarProduto(data as Produto & { variantes_rel?: ProdutoVariante[] | null })
  const variantesDetalhadas = normalizarVariantes(data as Produto & { variantes_rel?: ProdutoVariante[] | null })

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 80 }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28,
      }}>
        <Link href="/admin/produtos" style={{
          width: 36, height: 36, borderRadius: 8,
          background: '#f1f5f9', border: '1.5px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#64748b', textDecoration: 'none', flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-.02em' }}>
            Editar produto
          </h1>
          <p style={{
            fontSize: 13, color: '#64748b', margin: '2px 0 0',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {produto.icon && <>{produto.icon} </>}{produto.nome}
          </p>
        </div>

        {/* Badge de status */}
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
          background: produto.ativo ? '#dcfce7' : '#fee2e2',
          color: produto.ativo ? '#166534' : '#991b1b',
          flexShrink: 0,
        }}>
          {produto.ativo ? 'ATIVO' : 'INATIVO'}
        </span>
      </div>

      <ProdutoForm produto={produto} variantesDetalhadas={variantesDetalhadas} categorias={categorias ?? []} />
    </div>
  )
}
