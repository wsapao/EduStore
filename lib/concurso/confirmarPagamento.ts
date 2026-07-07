import { createAdminClient } from '@/lib/supabase/admin'
import { enviarEmailInscricaoConcurso } from '@/lib/email/send'
import { MODALIDADES } from './config'

interface InscricaoConfirmada {
  id: string; numero: string; aluno_nome: string; modalidade: string
  resp1_nome: string; resp1_email: string
}

/** Marca a inscrição como paga (idempotente) e dispara o e-mail de confirmação. */
export async function confirmarPagamentoConcurso(
  inscricaoId: string,
  netValue?: number,
): Promise<{ confirmado: boolean }> {
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
    .eq('status_pagamento', 'pendente') // idempotência
    .select('id, numero, aluno_nome, modalidade, resp1_nome, resp1_email')
    .single<InscricaoConfirmada>()

  if (error || !data) return { confirmado: false }

  const modalidadeNome = MODALIDADES.find(m => m.slug === data.modalidade)?.nome ?? data.modalidade
  void enviarEmailInscricaoConcurso(data.resp1_email, {
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
  await supabase
    .from('inscricoes_concurso')
    .update({ status_pagamento: 'expirado' })
    .eq('id', inscricaoId)
    .eq('status_pagamento', 'pendente')
    .select('id')
    .single()
}
