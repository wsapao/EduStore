import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // Preview de tema (dev-only): libera as rotas protegidas para renderizar
  // com dados mockados. Inerte em produção (exige NODE_ENV=development).
  if (process.env.NODE_ENV === 'development' && process.env.PREVIEW_TEMA_ADMIN === '1') {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Lista de rotas protegidas
  const protectedPaths = ['/loja', '/pedidos', '/perfil', '/admin']
  const isProtected = protectedPaths.some(p => request.nextUrl.pathname.startsWith(p))
  const isLogin = request.nextUrl.pathname === '/login'

  // Só faz a chamada pesada (rede) para o Supabase se for uma rota que precise
  if (isProtected || isLogin) {
    const { data: { user } } = await supabase.auth.getUser()

    if (isProtected && !user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    if (isLogin && user) {
      const url = request.nextUrl.clone()
      url.pathname = '/loja'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
