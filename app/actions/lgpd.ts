'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Exporta todos os dados pessoais do responsável autenticado em JSON.
 * Atende ao direito de portabilidade previsto na LGPD (art. 18, V).
 *
 * Retorna um objeto com os dados — o client converte em arquivo .json para download.
 */
export async function exportarMeusDadosAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const [
    { data: responsavel },
    { data: alunos },
    { data: pedidos },
    { data: ingressos },
    { data: carteirasCantina },
  ] = await Promise.all([
    supabase.from('responsaveis').select('*').eq('id', user.id).single(),
    supabase.from('responsavel_aluno').select('aluno:alunos(*)').eq('responsavel_id', user.id),
    supabase.from('pedidos').select('*, itens:itens_pedido(*)').eq('responsavel_id', user.id),
    supabase.from('ingressos').select('*').eq('responsavel_id', user.id),
    supabase.from('cantina_carteiras').select('*, movimentacoes:cantina_movimentacoes(*)'),
  ])

  const payload = {
    exportado_em: new Date().toISOString(),
    lgpd: {
      lei: 'Lei Geral de Proteção de Dados (Lei 13.709/2018)',
      direito_exercido: 'art. 18, V — portabilidade dos dados',
    },
    responsavel,
    alunos,
    pedidos,
    ingressos,
    carteiras_cantina: carteirasCantina,
  }

  return { success: true, payload }
}

/**
 * Exclui (ou anonimiza) a conta do responsável autenticado.
 * Atende ao direito de eliminação previsto na LGPD (art. 18, VI).
 *
 * Estratégia:
 * - Dados operacionais (pedidos, ingressos, movimentações de cantina) são preservados
 *   pelo prazo fiscal/contábil obrigatório — mas o vínculo com a identidade é rompido:
 *   o responsável é marcado como inativo e seus dados pessoais são anonimizados.
 * - O usuário do Auth é removido (auth.users).
 *
 * Obs: a implementação completa de anonimização via SQL deve ser feita por uma função
 * server-side com SERVICE_ROLE. Aqui fazemos o mínimo: desativar e limpar PII.
 */
export async function excluirMinhaContaAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const confirmacao = (formData.get('confirmacao') as string | null)?.trim().toUpperCase()
  if (confirmacao !== 'EXCLUIR') {
    return { error: 'Digite EXCLUIR para confirmar a remoção da sua conta.' }
  }

  // Admin não pode se auto-excluir pelo fluxo público — proteção básica
  if (user.app_metadata?.role === 'admin') {
    return { error: 'Contas administrativas devem ser removidas pelo suporte.' }
  }

  const admin = createAdminClient()

  // 1) Anonimiza os campos identificadores da tabela responsaveis
  const anonEmail = `anon+${user.id}@lgpd.local`
  const anonNome = 'Usuário removido'
  const anonCpf = `ANON-${user.id.slice(0, 8)}`

  const { error: updErr } = await admin
    .from('responsaveis')
    .update({
      nome: anonNome,
      email: anonEmail,
      cpf: anonCpf,
      telefone: null,
      ativo: false,
      excluido_em: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (updErr) {
    return {
      error:
        'Não foi possível concluir a exclusão agora. Entre em contato com a secretaria.',
    }
  }

  // 2) Remove o usuário do Auth — invalida todas as sessões
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id)
  if (delErr) {
    return {
      error:
        'Dados anonimizados, mas o encerramento da sessão falhou. Faça logout manualmente.',
    }
  }

  revalidatePath('/', 'layout')
  redirect('/login?conta_excluida=1')
}
