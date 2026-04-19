'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// ── Helpers ──
function limparCPF(cpf: string) {
  return cpf.replace(/[^0-9]/g, '')
}

function validarCPF(cpf: string): boolean {
  const c = limparCPF(cpf)
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false
  let soma = 0
  for (let i = 0; i < 9; i++) soma += parseInt(c[i]) * (10 - i)
  let resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(c[9])) return false
  soma = 0
  for (let i = 0; i < 10; i++) soma += parseInt(c[i]) * (11 - i)
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  return resto === parseInt(c[10])
}

// ── LOGIN com CPF ──
export async function loginAction(formData: FormData) {
  const supabase = await createClient()

  const cpfRaw  = formData.get('cpf') as string
  const senha   = formData.get('senha') as string

  if (!cpfRaw || !senha) {
    return { error: 'Preencha todos os campos.' }
  }

  // Busca email pelo CPF via RPC
  const { data: email, error: rpcError } = await supabase
    .rpc('get_email_by_cpf', { p_cpf: limparCPF(cpfRaw) })

  if (rpcError || !email) {
    return { error: 'CPF não encontrado. Verifique ou crie uma conta.' }
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
  const email     = (formData.get('email') as string)?.trim().toLowerCase()
  const senha     = formData.get('senha') as string

  // Validações
  if (!nomeFirst || !cpfRaw || !email || !senha) {
    return { error: 'Preencha todos os campos.' }
  }

  const cpf = limparCPF(cpfRaw)

  if (!validarCPF(cpf)) {
    return { error: 'CPF inválido. Verifique os números digitados.' }
  }

  if (senha.length < 8) {
    return { error: 'A senha deve ter pelo menos 8 caracteres.' }
  }

  // Verifica se CPF já existe
  const { data: existente } = await supabase
    .rpc('get_email_by_cpf', { p_cpf: cpf })

  if (existente) {
    return { error: 'Este CPF já possui uma conta. Faça login.' }
  }

  // Cria usuário no Supabase Auth
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password: senha,
    options: {
      data: { nome, cpf },
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

  const { data: email } = await supabase
    .rpc('get_email_by_cpf', { p_cpf: limparCPF(cpfRaw) })

  if (!email) {
    // Retorna mensagem genérica para não expor quais CPFs existem
    return { success: true }
  }

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/nova-senha`,
  })

  return { success: true }
}
