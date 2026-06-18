# Staging para QA — runbook

O agente de QA só roda contra um **staging seguro**. Passos (executar com o usuário):

## 1. Supabase Branch (dados isolados)
- Criar uma branch do projeto `rstsomdurwksoqxbypty` (Supabase Branching / MCP `create_branch`).
- Seed mínimo: 1 escola de teste + papéis (admin, operador) + 1 responsável de teste com CPF/senha conhecidos.

## 2. Deploy de preview na Vercel
Variáveis de ambiente do preview:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` → da branch Supabase.
- `ASAAS_ENVIRONMENT=sandbox` + `ASAAS_API_KEY` / `ASAAS_CANTINA_API_KEY` sandbox.
- `RESEND_API_KEY` apontando p/ caixa de teste (ou ausente p/ ignorar e-mails).
- `NEXT_PUBLIC_SITE_URL` = URL do preview.

## 3. Variáveis locais do QA (`.env.local` ou export no shell)
- `QA_BASE_URL` = URL do preview.
- `QA_STAGING_HOST` (se usar domínio custom).
- Credenciais de teste por perfil (ver playbook).

## Verificação
`QA_BASE_URL=<preview> ASAAS_ENVIRONMENT=sandbox npx playwright test tests/e2e/smoke.spec.ts`
Deve passar. Sem `QA_BASE_URL`, o comando aborta pela trava de segurança (esperado).
