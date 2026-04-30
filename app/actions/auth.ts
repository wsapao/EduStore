'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { ratelimit } from '@/lib/ratelimit'

async function getClientIp() {
  const h = await headers()
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    h.get('x-real-ip') ??
    'unknown'
  )
}

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
  console.time('loginAction Total')
  console.time('createClient')
  const supabase = await createClient()
  console.timeEnd('createClient')

  const cpfRaw  = formData.get('cpf') as string
  const senha   = formData.get('senha') as string

  if (!cpfRaw || !senha) {
    return { error: 'Preencha todos os campos.' }
  }

  const cpfLimpo = limparCPF(cpfRaw)

  // Rate limit: 5 tentativas por CPF/minuto + 20 por IP/minuto
  console.time('rateLimit')
  const ip = await getClientIp()
  const [byCpf, byIp] = await Promise.all([
    ratelimit.check(`login:cpf:${cpfLimpo}`, 5, 60),
    ratelimit.check(`login:ip:${ip}`, 20, 60),
  ])
  console.timeEnd('rateLimit')

  if (!byCpf.allowed || !byIp.allowed) {
    const retry = Math.max(byCpf.retryAfter, byIp.retryAfter)
    return {
      error: `Muitas tentativas. Tente novamente em ${retry}s.`,
    }
  }

  // Busca email pelo CPF via RPC
  console.time('rpc get_email_by_cpf')
  const { data: email, error: rpcError } = await supabase
    .rpc('get_email_by_cpf', { p_cpf: cpfLimpo })
  console.timeEnd('rpc get_email_by_cpf')

  if (rpcError || !email) {
    return { error: 'CPF não encontrado. Verifique ou crie uma conta.' }
  }

  console.time('signInWithPassword')
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  })
  console.timeEnd('signInWithPassword')

  if (authError) {
    return { error: 'CPF ou senha incorretos.' }
  }

  console.time('revalidatePath')
  revalidatePath('/', 'layout')
  console.timeEnd('revalidatePath')
  
  const isAdmin = authData.user?.app_metadata?.role === 'admin'
  console.timeEnd('loginAction Total')
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
  // [INTEGRAÇÃO ONDA 3] Onboarding Mágico (Direto ActiveSoft)
  // ==========================================
  try {
    const responsavelId = authData.user.id

    // Import dinâmico para não quebrar outras funções se o token faltar
    const { activesoft } = await import('@/lib/activesoft')
    
    if (activesoft.isConfigured()) {
      const alunosSiga = await activesoft.findAlunosByResponsavelCpf(cpf)
      
      if (alunosSiga && alunosSiga.length > 0) {
        // Insere alunos com os mesmos IDs do ERP
        const { error: alunosError } = await supabase.from('alunos').upsert(
          alunosSiga.map((s: any) => ({
            id: s.id.toString(), // Mantém o ID original do ERP
            nome: s.nome,
            serie: 'SigaWeb', // Podemos melhorar buscando a série exata depois
            escola_id: null,
            ativo: true
          }))
        )

        if (!alunosError) {
          // Vincula os alunos ao responsável recém-criado
          await supabase.from('responsavel_aluno').upsert(
            alunosSiga.map((s: any) => ({
              responsavel_id: responsavelId,
              aluno_id: s.id.toString(),
              parentesco: 'Responsável'
            }))
          )
        }
      }
    } else {
      console.warn('ACTIVESOFT_TOKEN não configurado na Loja. Onboarding Mágico ignorado.')
    }
  } catch (err) {
    console.error('Erro no onboarding mágico direto com ActiveSoft:', err)
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

  const { data: email } = await supabase
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
