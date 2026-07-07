'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getGateway } from '@/lib/pagamentos/gateway'
import { limparCPF } from '@/lib/validacao/cpf'
import { validarInscricao, type InscricaoInput } from '@/lib/concurso/validacao'
import { CONCURSO, CONCURSO_REF_PREFIX, MODALIDADES, inscricoesAbertas } from '@/lib/concurso/config'
import { auditLog } from '@/lib/auditoria/log'
import type { ResultadoPix } from '@/lib/pagamentos/types'

export interface PixInfo {
  qr_code: string
  qr_code_imagem: string
  expiracao: string
}

export type CriarInscricaoResult =
  | { success: true; inscricao_id: string; numero: string; pix: PixInfo }
  | { success: false; error: string; inscricao_id?: string }

export async function criarInscricaoConcurso(input: InscricaoInput): Promise<CriarInscricaoResult> {
  if (!inscricoesAbertas()) {
    return { success: false, error: 'As inscrições estão encerradas ou ainda não abriram.' }
  }

  const validacao = validarInscricao(input)
  if (!validacao.ok) return { success: false, error: validacao.erros.join(' ') }

  const supabase = createAdminClient()
  const cpf = limparCPF(input.resp1_cpf)

  const { data: inscricao, error: insertErr } = await supabase
    .from('inscricoes_concurso')
    .insert({
      escola_id: CONCURSO.escolaId,
      aluno_nome: input.aluno_nome.trim(),
      aluno_nascimento: input.aluno_nascimento,
      turno: 'tarde',
      serie_2026: input.serie_2026,
      modalidade: input.modalidade,
      instituicao_atual: input.instituicao_atual.trim(),
      resp1_nome: input.resp1_nome.trim(),
      resp1_cpf: cpf,
      resp1_email: input.resp1_email.trim().toLowerCase(),
      resp1_telefone: input.resp1_telefone?.trim() || null,
      resp1_endereco: input.resp1_endereco?.trim() || null,
      resp1_profissao: input.resp1_profissao?.trim() || null,
      resp1_parentesco: input.resp1_parentesco?.trim() || null,
      resp2_nome: input.resp2_nome?.trim() || null,
      resp2_endereco: input.resp2_endereco?.trim() || null,
      resp2_telefone: input.resp2_telefone?.trim() || null,
      resp2_profissao: input.resp2_profissao?.trim() || null,
      resp2_parentesco: input.resp2_parentesco?.trim() || null,
      tem_irmaos: input.tem_irmaos ?? null,
      irmaos_series_2026: input.irmaos_series_2026?.trim() || null,
      consentimento_em: new Date().toISOString(),
      valor: CONCURSO.valorInscricao,
      status_pagamento: 'pendente',
    })
    .select('id, numero')
    .single()

  if (insertErr || !inscricao) {
    console.error('[concurso] Erro ao gravar inscrição:', insertErr?.message)
    await auditLog({
      modulo: 'concurso',
      acao: 'concurso_inscricao_erro',
      descricao: insertErr?.message ?? 'Erro ao gravar inscrição.',
      metadata: { modalidade: input.modalidade, code: insertErr?.code, message: insertErr?.message },
      escolaId: CONCURSO.escolaId,
    })
    return { success: false, error: 'Não foi possível registrar a inscrição. Tente novamente.' }
  }

  const modalidadeNome = MODALIDADES.find(m => m.slug === input.modalidade)?.nome ?? input.modalidade

  let pix: ResultadoPix
  try {
    const resultado = await getGateway().criarPagamento({
      metodo: 'pix',
      total: CONCURSO.valorInscricao,
      responsavel: { nome: input.resp1_nome.trim(), email: input.resp1_email.trim(), cpf },
      descricao: `Inscrição Concurso de Bolsas 2027 – ${modalidadeNome} – ${input.aluno_nome.trim()}`,
      referencia: `${CONCURSO_REF_PREFIX}${inscricao.id}`,
    })
    if (resultado.metodo !== 'pix') throw new Error('Gateway não retornou Pix.')
    pix = resultado
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[concurso] Erro ao criar cobrança Pix:', message)
    await auditLog({
      modulo: 'concurso',
      acao: 'concurso_pix_erro',
      descricao: message,
      metadata: { inscricaoId: inscricao.id, numero: inscricao.numero, message },
      escolaId: CONCURSO.escolaId,
    })
    return {
      success: false,
      error: 'Sua inscrição foi registrada, mas houve falha ao gerar o Pix. Tente novamente.',
      inscricao_id: inscricao.id,
    }
  }

  const { error: updateErr } = await supabase
    .from('inscricoes_concurso')
    .update({
      gateway_id: pix.gateway_id,
      pix_qr_code: pix.qr_code,
      pix_qr_code_imagem: pix.qr_code_imagem,
      pix_tx_id: pix.tx_id,
      pix_expiracao: pix.expiracao,
    })
    .eq('id', inscricao.id)

  if (updateErr) {
    // Não interrompe — a cobrança existe; o webhook reconcilia via concurso:<id>.
    console.error('[concurso] Falha ao persistir dados do Pix:', updateErr.message)
  }

  return {
    success: true,
    inscricao_id: inscricao.id,
    numero: inscricao.numero,
    pix: { qr_code: pix.qr_code, qr_code_imagem: pix.qr_code_imagem, expiracao: pix.expiracao },
  }
}

export async function consultarStatusInscricao(id: string): Promise<{ status: string } | { error: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('inscricoes_concurso')
    .select('status_pagamento')
    .eq('id', id)
    .maybeSingle<{ status_pagamento: string }>()
  if (error || !data) return { error: 'Inscrição não encontrada.' }
  return { status: data.status_pagamento }
}

export type NovoPixResult = { success: true; pix: PixInfo } | { success: false; error: string }

export async function gerarNovoPixInscricao(id: string): Promise<NovoPixResult> {
  const supabase = createAdminClient()
  const { data: insc, error } = await supabase
    .from('inscricoes_concurso')
    .select('id, aluno_nome, modalidade, resp1_nome, resp1_email, resp1_cpf, status_pagamento, valor, pix_expiracao')
    .eq('id', id)
    .maybeSingle<{ id: string; aluno_nome: string; modalidade: string; resp1_nome: string;
      resp1_email: string; resp1_cpf: string; status_pagamento: string; valor: number;
      pix_expiracao: string | null }>()

  if (error || !insc) return { success: false, error: 'Inscrição não encontrada.' }
  if (insc.status_pagamento === 'pago') return { success: false, error: 'Esta inscrição já está paga.' }
  if (new Date() > CONCURSO.pagamentoLimite) {
    return { success: false, error: 'O prazo de pagamento da inscrição já encerrou.' }
  }
  // pix_expiracao NULL (linha órfã: gateway falhou na criação) passa — é o caminho de retry.
  if (insc.pix_expiracao && new Date(insc.pix_expiracao) > new Date()) {
    return { success: false, error: 'O Pix atual ainda está válido. Use o QR Code exibido.' }
  }

  const modalidadeNome = MODALIDADES.find(m => m.slug === insc.modalidade)?.nome ?? insc.modalidade

  let pix: ResultadoPix
  try {
    const resultado = await getGateway().criarPagamento({
      metodo: 'pix',
      total: Number(insc.valor),
      responsavel: { nome: insc.resp1_nome, email: insc.resp1_email, cpf: insc.resp1_cpf },
      descricao: `Inscrição Concurso de Bolsas 2027 – ${modalidadeNome} – ${insc.aluno_nome}`,
      referencia: `${CONCURSO_REF_PREFIX}${insc.id}`,
    })
    if (resultado.metodo !== 'pix') throw new Error('Gateway não retornou Pix.')
    pix = resultado
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[concurso] Erro ao gerar novo Pix:', message)
    await auditLog({
      modulo: 'concurso',
      acao: 'concurso_pix_erro',
      descricao: message,
      metadata: { inscricaoId: insc.id, message },
      escolaId: CONCURSO.escolaId,
    })
    return { success: false, error: 'Falha ao gerar novo Pix. Tente novamente.' }
  }

  const { error: updateErr } = await supabase
    .from('inscricoes_concurso')
    .update({
      status_pagamento: 'pendente',
      gateway_id: pix.gateway_id,
      pix_qr_code: pix.qr_code,
      pix_qr_code_imagem: pix.qr_code_imagem,
      pix_tx_id: pix.tx_id,
      pix_expiracao: pix.expiracao,
    })
    .eq('id', insc.id)

  if (updateErr) {
    // Não interrompe — a cobrança existe e o usuário precisa conseguir pagar;
    // o webhook reconcilia via concurso:<id>.
    console.error('[concurso] Falha ao persistir novo Pix:', updateErr.message)
  }

  return { success: true, pix: { qr_code: pix.qr_code, qr_code_imagem: pix.qr_code_imagem, expiracao: pix.expiracao } }
}
