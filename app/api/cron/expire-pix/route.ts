import { executarExpiracaoPixJob } from '@/lib/pagamentos/expirePixJob'

export const runtime = 'nodejs'

function autorizado(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    throw new Error('CRON_SECRET não configurado.')
  }

  const authHeader = request.headers.get('authorization')
  return authHeader === `Bearer ${secret}`
}

async function handle(request: Request) {
  try {
    if (!autorizado(request)) {
      return Response.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const resultado = await executarExpiracaoPixJob()
    return Response.json({ ok: true, ...resultado })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado.'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return handle(request)
}

export async function POST(request: Request) {
  return handle(request)
}
