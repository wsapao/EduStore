import { ConfirmClient } from './ConfirmClient'

// Destino dos links de convite/recuperação enviados por e-mail
// (templates apontam para /confirm?token_hash=...&type=...&next=/nova-senha).
// A verificação só acontece após clique do usuário, para que scanners de
// e-mail que pré-abrem links não consumam o token de uso único.
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null

  return (
    <ConfirmClient
      tokenHash={first(params.token_hash)}
      type={first(params.type)}
      code={first(params.code)}
      next={first(params.next)}
    />
  )
}
