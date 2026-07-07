'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ratelimit } from '@/lib/ratelimit'
import { limparCPF, validarCPF } from '@/lib/validacao/cpf'

async function getClientIp() {
  const h = await headers()
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    h.get('x-real-ip') ??
    'unknown'
  )
}

// ── LOGIN com CPF ──
export async function loginAction(formData: FormData) {
  const supabase = await createClient()

  const cpfRaw  = formData.get('cpf') as string
  const senha   = formData.get('senha') as string

  if (!cpfRaw || !senha) {
    return { error: 'Preencha todos os campos.' }
  }

  const cpfLimpo = limparCPF(cpfRaw)

  // Rate limit: 5 tentativas por CPF/minuto + 20 por IP/minuto
  const ip = await getClientIp()
  const [byCpf, byIp] = await Promise.all([
    ratelimit.check(`login:cpf:${cpfLimpo}`, 5, 60),
    ratelimit.check(`login:ip:${ip}`, 20, 60),
  ])

  if (!byCpf.allowed || !byIp.allowed) {
    const retry = Math.max(byCpf.retryAfter, byIp.retryAfter)
    return {
      error: `Muitas tentativas. Tente novamente em ${retry}s.`,
    }
  }

  // Busca email pelo CPF via RPC (service role: o EXECUTE foi revogado de anon
  // para impedir enumeração de e-mail por CPF via REST).
  const { data: email, error: rpcError } = await createAdminClient()
    .rpc('get_email_by_cpf', { p_cpf: cpfLimpo })

  if (rpcError || !email) {
    // Mensagem genérica para não revelar quais CPFs possuem conta (enumeração).
    return { error: 'CPF ou senha incorretos.' }
  }

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  })

  if (authError) {
    return { error: 'CPF ou senha incorretos.' }
  }

  revalidatePath('/', 'layout')
  const isAdmin = authData.user?.app_metadata?.role === 'admin'
  redirect(isAdmin ? '/admin' : '/loja')
}

// ── CADASTRO ──
export async function cadastroAction(formData: FormData) {
  const supabase = await createClient()

  const nomeFirst = (formData.get('nome_first') as string)?.trim()
  const nomeLast  = (formData.get('nome_last')  as string)?.trim()
  const nome      = [nomeFirst, nomeLast].filter(Boolean).join(' ')
  const cpfRaw    = formData.get('cpf') as string
  const telefone  = formData.get('telefone') as string
  const email     = (formData.get('email') as string)?.trim().toLowerCase()
  const senha     = formData.get('senha') as string

  // Validações
  if (!nomeFirst || !cpfRaw || !email || !senha || !telefone) {
    return { error: 'Preencha todos os campos.' }
  }

  const cpf = limparCPF(cpfRaw)

  if (!validarCPF(cpf)) {
    return { error: 'CPF inválido. Verifique os números digitados.' }
  }

  if (senha.length < 8) {
    return { error: 'A senha deve ter pelo menos 8 caracteres.' }
  }

  // Rate limit por IP — impede enumeração em massa de CPFs via cadastro
  // (a mensagem de "CPF já existe" é útil p/ UX, mas não pode ser abusada em escala).
  const ip = await getClientIp()
  const { allowed, retryAfter } = await ratelimit.check(`cadastro:ip:${ip}`, 15, 3600)
  if (!allowed) {
    return { error: `Muitas tentativas de cadastro. Tente novamente em ${retryAfter}s.` }
  }

  // Verifica se CPF já existe (service role — EXECUTE revogado de anon/authenticated)
  const { data: existente } = await createAdminClient()
    .rpc('get_email_by_cpf', { p_cpf: cpf })

  if (existente) {
    return { error: 'Este CPF já possui uma conta. Faça login.' }
  }

  // Cria usuário no Supabase Auth
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password: senha,
    options: {
      data: { nome, cpf, telefone },
    },
  })

  if (signUpError) {
    if (signUpError.message.includes('already registered')) {
      return { error: 'Este e-mail já está cadastrado.' }
    }
    return { error: 'Erro ao criar conta. Tente novamente.' }
  }

  if (!authData.user) {
    return { error: 'Erro inesperado. Tente novamente.' }
  }

  // ==========================================
  // Onboarding: puxa os alunos do ActiveSoft e vincula ao responsável.
  // Escrita via service role (admin): `alunos` não tem policy de INSERT para
  // o usuário comum, e dedup é feito pela chave natural `activesoft_id`.
  // ==========================================
  try {
    const responsavelId = authData.user.id
    const admin = createAdminClient()

    // Import dinâmico para não quebrar outras funções se o token faltar
    const { activesoft } = await import('@/lib/activesoft')

    if (activesoft.isConfigured()) {
      const alunosSiga = await activesoft.findAlunosOnboardingByResponsavelCpf(cpf)

      if (alunosSiga.length > 0) {
        // escola_id é resolvido pelo trigger handle_new_user ao criar o perfil.
        const { data: resp } = await admin
          .from('responsaveis')
          .select('escola_id')
          .eq('id', responsavelId)
          .single()

        const escolaId = resp?.escola_id
        if (!escolaId) throw new Error('Responsável sem escola_id — vínculo abortado.')

        // Upsert por activesoft_id evita duplicar o aluno quando um segundo
        // responsável (ex.: a mãe) também se cadastra.
        const { data: alunosRows, error: alunosError } = await admin
          .from('alunos')
          .upsert(
            alunosSiga.map(s => ({
              activesoft_id: s.activesoft_id,
              nome: s.nome,
              serie: s.serie,
              turma: s.turma,
              escola_id: escolaId,
              ativo: true,
            })),
            { onConflict: 'activesoft_id' }
          )
          .select('id')

        if (alunosError) throw alunosError

        if (alunosRows && alunosRows.length > 0) {
          const { error: vinculoError } = await admin
            .from('responsavel_aluno')
            .upsert(
              alunosRows.map(a => ({
                responsavel_id: responsavelId,
                aluno_id: a.id,
                parentesco: 'Responsável',
              })),
              { onConflict: 'responsavel_id,aluno_id' }
            )
          if (vinculoError) throw vinculoError
        }
      }
    } else {
      console.warn('ACTIVESOFT_TOKEN não configurado na Loja. Onboarding ignorado.')
    }
  } catch (err) {
    console.error('Erro no onboarding ActiveSoft (cadastro segue sem vínculo):', err)
    // Não trava o cadastro se a integração falhar
  }

  // O perfil em responsaveis é criado automaticamente via trigger
  // handle_new_user() com os dados de raw_user_meta_data

  revalidatePath('/', 'layout')
  // Redireciona para onboarding de alunos após cadastro
  redirect('/perfil/alunos?onboarding=1')
}

// ── LOGOUT ──
export async function logoutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

// ── RECUPERAR SENHA ──
export async function recuperarSenhaAction(formData: FormData) {
  const supabase = await createClient()
  const cpfRaw = formData.get('cpf') as string

  if (!cpfRaw) return { error: 'Informe seu CPF.' }

  const cpfLimpo = limparCPF(cpfRaw)

  // Rate limit: 3 pedidos de reset por CPF/hora + 10 por IP/hora
  const ip = await getClientIp()
  const [byCpf, byIp] = await Promise.all([
    ratelimit.check(`reset:cpf:${cpfLimpo}`, 3, 3600),
    ratelimit.check(`reset:ip:${ip}`, 10, 3600),
  ])
  if (!byCpf.allowed || !byIp.allowed) {
    // Mantém mensagem genérica de sucesso para não expor rate limit em enumeração
    return { success: true }
  }

  const { data: email } = await createAdminClient()
    .rpc('get_email_by_cpf', { p_cpf: cpfLimpo })

  if (!email) {
    // Retorna mensagem genérica para não expor quais CPFs existem
    return { success: true }
  }

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/nova-senha`,
  })

  return { success: true }
}
