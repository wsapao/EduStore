import { executarExpiracaoPixJob } from '@/lib/pagamentos/expirePixJob'
import { expirarPixInscricoesConcurso } from '@/lib/concurso/expirePix'

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

    let concurso: Awaited<ReturnType<typeof expirarPixInscricoesConcurso>> | { erro: string }
    try {
      concurso = await expirarPixInscricoesConcurso()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro inesperado.'
      console.error('[cron/expire-pix] Falha no job do concurso:', message)
      concurso = { erro: message }
    }

    return Response.json({ ok: true, ...resultado, concurso })
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
