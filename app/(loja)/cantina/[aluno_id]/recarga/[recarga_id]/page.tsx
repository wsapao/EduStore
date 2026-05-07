import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { AguardandoClient } from './AguardandoClient'

export default async function AguardandoRecargaPage({
  params,
}: {
  params: Promise<{ aluno_id: string; recarga_id: string }>
}) {
  const { aluno_id, recarga_id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RLS já filtra recargas do usuário; validamos explicitamente por segurança
  const { data: recarga } = await supabase
    .from('cantina_recargas' as any)
    .select('id, valor, status, metodo, pix_qr_code, pix_qr_code_imagem, pix_expiracao, responsavel_id, carteira_id')
    .eq('id', recarga_id)
    .single()

  if (!recarga || recarga.responsavel_id !== user.id) notFound()

  const { data: carteira } = await supabase
    .from('cantina_carteiras' as any)
    .select('aluno_id')
    .eq('id', recarga.carteira_id)
    .single()

  if (!carteira || carteira.aluno_id !== aluno_id) notFound()

  const { data: aluno } = await supabase
    .from('alunos')
    .select('nome, serie')
    .eq('id', aluno_id)
    .single()

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px 16px 100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link
          href={`/cantina/${aluno_id}/recarga`}
          style={{
            width: 36, height: 36, borderRadius: 'var(--r-md)',
            background: 'var(--surface)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, textDecoration: 'none', color: 'var(--text-1)',
            boxShadow: 'var(--shadow-xs)',
          }}
        >←</Link>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>
            Aguardando pagamento
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
            {aluno?.nome} · Recarga PIX
          </div>
        </div>
      </div>

      <AguardandoClient
        recargaId={recarga.id}
        alunoId={aluno_id}
        alunoNome={aluno?.nome ?? ''}
        valor={recarga.valor as number}
        metodo={(recarga.metodo ?? 'pix') as 'pix' | 'cartao'}
        pixQrCode={(recarga.pix_qr_code ?? '') as string}
        pixQrCodeImagem={(recarga.pix_qr_code_imagem ?? '') as string}
        pixExpiracao={(recarga.pix_expiracao ?? '') as string}
        statusInicial={recarga.status as 'aguardando' | 'confirmada' | 'expirada' | 'falhou'}
      />
    </div>
  )
}
