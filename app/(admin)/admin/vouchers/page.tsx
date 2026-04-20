import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { VoucherManager } from './VoucherManager'

export default async function VouchersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') redirect('/loja')

  const { data: vouchers } = await supabase
    .from('vouchers')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Link href="/admin" style={{
          width: 36, height: 36, borderRadius: 8, background: '#f1f5f9', border: '1.5px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', textDecoration: 'none'
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-.02em' }}>
            Vouchers e Descontos
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '2px 0 0' }}>
            Crie cupons promocionais para engajar vendas e oferecer descontos aos responsáveis
          </p>
        </div>
      </div>

      <VoucherManager vouchers={vouchers ?? []} />
    </div>
  )
}
