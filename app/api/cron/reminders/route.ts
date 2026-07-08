import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron/reminders] CRON_SECRET não configurado.')
    return new NextResponse('Internal Server Error', { status: 500 })
  }
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  if (process.env.LOJA_LIVE !== 'true') {
    return NextResponse.json({ success: true, skipped: 'LOJA_LIVE!=true' })
  }

  try {
    const adminClient = createAdminClient()
    // 1. Target Date = Hoje + 2 dias
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + 2)
    const targetDateStr = targetDate.toISOString().split('T')[0]

    // Busca produtos ativos, não esgotados
    const { data: produtos } = await adminClient
      .from('produtos')
      .select('id, nome, esgotado, prazo_compra, series')
      .eq('ativo', true)
      .eq('esgotado', false)

    if (!produtos || produtos.length === 0) {
      return NextResponse.json({ success: true, message: 'Nenhum produto ativo.' })
    }

    // Filtra produtos vencendo em 48h
    const produtosAlvo = produtos.filter(p => p.prazo_compra?.startsWith(targetDateStr))

    if (produtosAlvo.length === 0) {
      return NextResponse.json({ success: true, message: 'Nenhum produto vencendo em 48h.' })
    }

    let enviados = 0
    const educrmUrl = process.env.EDUCRM_API_URL
    const educrmKey = process.env.EDUCRM_API_KEY

    if (!educrmUrl || !educrmKey) {
      console.warn('Variáveis do EduCRM não configuradas.')
      return NextResponse.json({ success: true, message: 'Webhook EduCRM não configurado.' })
    }

    // Processa envios delegando para o EduCRM
    for (const produto of produtosAlvo) {
      // 2. Verifica quem já comprou. Tabela correta é `itens_pedido` (a antiga
      // `item_pedido` não existe → query falhava em silêncio e comprou_ids vinha
      // vazio, disparando lembrete para todas as famílias, inclusive quem já comprou).
      const { data: itensComprados, error: itensErr } = await adminClient
        .from('itens_pedido')
        .select('aluno_id')
        .eq('produto_id', produto.id)

      if (itensErr) {
        // Não podemos assumir "ninguém comprou" (mandaria lembrete para todos):
        // registra e pula este produto neste ciclo.
        console.error('[cron/reminders] falha ao buscar compradores do produto', {
          produtoId: produto.id,
          message: itensErr.message,
        })
        continue
      }

      const compradoresIds = (itensComprados || []).map(i => i.aluno_id)

      // 3. Dispara Webhook para o EduCRM
      try {
        const res = await fetch(`${educrmUrl}/api/webhooks/loja/reminders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-secret': educrmKey
          },
          body: JSON.stringify({
            produto: produto.nome,
            series: produto.series || [],
            link: `${process.env.NEXT_PUBLIC_SITE_URL}/loja/produto/${produto.id}`,
            comprou_ids: compradoresIds
          })
        })

        if (res.ok) {
          const data = await res.json()
          enviados += data.messages_sent || 0
        }
      } catch (err) {
        console.error('Erro enviando gatilho de lembrete para EduCRM', err)
      }
    }

    return NextResponse.json({ success: true, enviados })

  } catch (error) {
    console.error('Erro Cron Lembretes:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
