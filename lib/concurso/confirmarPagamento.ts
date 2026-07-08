import { createAdminClient } from '@/lib/supabase/admin'
import { enviarEmailInscricaoConcurso } from '@/lib/email/send'
import { MODALIDADES } from './config'

interface InscricaoConfirmada {
  id: string; numero: string; aluno_nome: string; modalidade: string
  resp1_nome: string; resp1_email: string
}

/** PostgREST: `.single()` sem linhas afetadas retorna este código (no-op esperado). */
const PGRST_NO_ROWS = 'PGRST116'

/**
 * Marca a inscrição como paga (idempotente) e envia o e-mail de confirmação
 * antes de retornar (aguardado — em serverless um fire-and-forget pode ser
 * abortado junto com a resposta; o envio nunca lança, é try/catch interno).
 *
 * Aceita inscrições 'pendente' OU 'expirado' — se o PAYMENT_OVERDUE chegou
 * antes e o pagamento caiu depois, a família ainda é confirmada. A transição
 * atômica para 'pago' garante e-mail no máximo uma vez.
 *
 * Retorna `erro: true` apenas em falha real de banco (não em 0 linhas), para
 * o webhook responder 500 e o Asaas reenviar.
 */
export async function confirmarPagamentoConcurso(
  inscricaoId: string,
  netValue?: number,
): Promise<{ confirmado: boolean; erro?: boolean }> {
  const supabase = createAdminClient()
  const updateData: Record<string, unknown> = {
    status_pagamento: 'pago',
    pago_em: new Date().toISOString(),
  }
  if (netValue !== undefined && netValue > 0) updateData.valor_liquido = netValue

  const { data, error } = await supabase
    .from('inscricoes_concurso')
    .update(updateData)
    .eq('id', inscricaoId)
    .in('status_pagamento', ['pendente', 'expirado']) // idempotência + pagamento tardio
    .select('id, numero, aluno_nome, modalidade, resp1_nome, resp1_email')
    .single<InscricaoConfirmada>()

  if (error && error.code !== PGRST_NO_ROWS) {
    console.error('[concurso] Erro ao confirmar inscrição', inscricaoId, error.message)
    return { confirmado: false, erro: true }
  }
  if (!data) return { confirmado: false } // já estava paga — no-op idempotente

  const modalidadeNome = MODALIDADES.find(m => m.slug === data.modalidade)?.nome ?? data.modalidade
  await enviarEmailInscricaoConcurso(data.resp1_email, {
    responsavelNome: data.resp1_nome,
    alunoNome: data.aluno_nome,
    numero: data.numero,
    modalidade: modalidadeNome,
  })
  return { confirmado: true }
}

/** Marca a inscrição como expirada (apenas se ainda pendente). */
export async function expirarPagamentoConcurso(inscricaoId: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('inscricoes_concurso')
    .update({ status_pagamento: 'expirado' })
    .eq('id', inscricaoId)
    .eq('status_pagamento', 'pendente')
    .select('id')
    .single()

  if (error && error.code !== PGRST_NO_ROWS) {
    console.warn('[concurso] Erro ao expirar inscrição', inscricaoId, error.message)
  }
}
