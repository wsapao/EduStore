import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Expira inscrições do concurso:
 * 1) pendentes com Pix vencido (pix_expiracao < agora);
 * 2) órfãs — pendentes SEM gateway_id (falha na criação da cobrança) com mais de 1h,
 *    para não reter dados pessoais indefinidamente (LGPD).
 */
export async function expirarPixInscricoesConcurso(limite = 200) {
  const supabase = createAdminClient()
  const now = new Date()
  const nowIso = now.toISOString()
  const umaHoraAtrasIso = new Date(now.getTime() - 60 * 60 * 1000).toISOString()

  const { data: vencidas, error: errVencidas } = await supabase
    .from('inscricoes_concurso')
    .select('id')
    .eq('status_pagamento', 'pendente')
    .lt('pix_expiracao', nowIso)
    .limit(limite)

  if (errVencidas) throw new Error(`Erro ao buscar inscrições com Pix expirado: ${errVencidas.message}`)

  const { data: orfas, error: errOrfas } = await supabase
    .from('inscricoes_concurso')
    .select('id')
    .eq('status_pagamento', 'pendente')
    .is('gateway_id', null)
    .lt('created_at', umaHoraAtrasIso)
    .limit(limite)

  if (errOrfas) throw new Error(`Erro ao buscar inscrições órfãs: ${errOrfas.message}`)

  async function expirar(ids: { id: string }[]): Promise<number> {
    let n = 0
    for (const row of ids) {
      const { data: updated } = await supabase
        .from('inscricoes_concurso')
        .update({ status_pagamento: 'expirado' })
        .eq('id', row.id)
        .eq('status_pagamento', 'pendente')
        .select('id')
        .single()
      if (updated) n += 1
    }
    return n
  }

  const expiradas = await expirar(vencidas ?? [])
  const orfasExpiradas = await expirar(orfas ?? [])

  return {
    expiradas,
    orfasExpiradas,
    encontradas: (vencidas?.length ?? 0) + (orfas?.length ?? 0),
  }
}
