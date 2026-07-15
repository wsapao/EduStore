'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ratelimit } from '@/lib/ratelimit'
import { limparCPF, validarCPF } from '@/lib/validacao/cpf'
import { EMAIL_RE } from '@/lib/validacao/email'
import { getUserPermissions, podeAcessarAdmin } from '@/lib/permissoes'

async function getClientIp() {
  const h = await headers()
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    h.get('x-real-ip') ??
    'unknown'
  )
}

// ── LOGIN com CPF ou e-mail ──
// Responsáveis entram com CPF; membros de equipe convidados entram com e-mail
// (nem todo membro de equipe tem cadastro em responsaveis). '@' decide o caminho.
export async function loginAction(formData: FormData) {
  const supabase = await createClient()

  const identificador = ((formData.get('cpf') as string | null) ?? '').trim()
  const senha = formData.get('senha') as string

  if (!identificador || !senha) {
    return { error: 'Preencha todos os campos.' }
  }

  const isEmail = identificador.includes('@')
  const chave = isEmail
    ? `login:email:${identificador.toLowerCase()}`
    : `login:cpf:${limparCPF(identificador)}`

  // Rate limit: 5 tentativas por identificador/minuto + 20 por IP/minuto
  const ip = await getClientIp()
  const [byId, byIp] = await Promise.all([
    ratelimit.check(chave, 5, 60),
    ratelimit.check(`login:ip:${ip}`, 20, 60),
  ])

  if (!byId.allowed || !byIp.allowed) {
    const retry = Math.max(byId.retryAfter, byIp.retryAfter)
    return {
      error: `Muitas tentativas. Tente novamente em ${retry}s.`,
    }
  }

  let email: string
  if (isEmail) {
    email = identificador.toLowerCase()
    if (!EMAIL_RE.test(email)) {
      return { error: 'CPF/e-mail ou senha incorretos.' }
    }
  } else {
    // Busca email pelo CPF via RPC (service role: o EXECUTE foi revogado de anon
    // para impedir enumeração de e-mail por CPF via REST).
    const { data: emailPorCpf, error: rpcError } = await createAdminClient()
      .rpc('get_email_by_cpf', { p_cpf: limparCPF(identificador) })

    if (rpcError || !emailPorCpf) {
      // Mensagem genérica para não revelar quais CPFs possuem conta (enumeração).
      return { error: 'CPF/e-mail ou senha incorretos.' }
    }
    email = emailPorCpf
  }

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  })

  if (authError) {
    return { error: 'CPF/e-mail ou senha incorretos.' }
  }

  revalidatePath('/', 'layout')
  // Mesmo critério do guard de app/(admin)/layout.tsx: quem tem papel de
  // equipe (Admin, Financeiro, …) entra pelo admin, mesmo sendo também pai.
  const permissoes = await getUserPermissions(supabase)
  redirect(podeAcessarAdmin(permissoes) ? '/admin' : '/loja')
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

// ── RECUPERAR SENHA (por CPF ou e-mail) ──
export async function recuperarSenhaAction(formData: FormData) {
  const supabase = await createClient()
  const identificador = ((formData.get('cpf') as string | null) ?? '').trim()

  if (!identificador) return { error: 'Informe seu CPF ou e-mail.' }

  const isEmail = identificador.includes('@')
  const chave = isEmail
    ? `reset:email:${identificador.toLowerCase()}`
    : `reset:cpf:${limparCPF(identificador)}`

  // Rate limit: 3 pedidos de reset por identificador/hora + 10 por IP/hora
  const ip = await getClientIp()
  const [byId, byIp] = await Promise.all([
    ratelimit.check(chave, 3, 3600),
    ratelimit.check(`reset:ip:${ip}`, 10, 3600),
  ])
  if (!byId.allowed || !byIp.allowed) {
    // Mantém mensagem genérica de sucesso para não expor rate limit em enumeração
    return { success: true }
  }

  let email: string
  if (isEmail) {
    email = identificador.toLowerCase()
    if (!EMAIL_RE.test(email)) {
      // Genérico: não revela se o e-mail existe ou é válido
      return { success: true }
    }
  } else {
    const { data: emailPorCpf } = await createAdminClient()
      .rpc('get_email_by_cpf', { p_cpf: limparCPF(identificador) })

    if (!emailPorCpf) {
      // Retorna mensagem genérica para não expor quais CPFs existem
      return { success: true }
    }
    email = emailPorCpf
  }

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/nova-senha`,
  })

  return { success: true }
}
