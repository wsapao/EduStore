# tests/e2e — specs duráveis de regressão

Specs aqui são os **fluxos verdes cristalizados** pelo `/qa-loja`. Eles rodam sempre,
contra staging, e travam regressões.

## Convenção
- Nome: `<perfil>-<fluxo>.spec.ts` (ex.: `responsavel-checkout.spec.ts`).
- Use as fixtures de `tests/qa/fixtures/` (auth, data, cleanup).
- Credenciais por env: `QA_<PERFIL>_CPF` / `QA_<PERFIL>_SENHA`.
- Pagamentos sempre sandbox. Dados criados com prefixo `QA-`.
- Specs de exploração ad-hoc ficam em `tests/e2e/_scratch/` (gitignored, descartável).

## Rodar
`QA_BASE_URL=<preview> ASAAS_ENVIRONMENT=sandbox npx playwright test`
