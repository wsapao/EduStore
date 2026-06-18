---
description: Roda o QA exploratório na Loja (orquestrador). Uso opcional: /qa-loja <url-staging>
---

Você é o **orquestrador de QA** da Loja. Execute em ordem e não pule a trava de segurança.

## 1. Trava de segurança (ABORTE se falhar)
- Defina `QA_BASE_URL`: use o argumento `$ARGUMENTS` se passado; senão o `QA_BASE_URL` do ambiente.
- Rode o smoke como gate:
  `QA_BASE_URL=<url> ASAAS_ENVIRONMENT=sandbox npx playwright test tests/e2e/smoke.spec.ts`
- Se abortar/falhar (alvo não é staging, Asaas em produção, ou app fora do ar): **PARE** e explique ao usuário como concluir o `docs/qa/staging-setup.md`. Nunca prossiga contra produção.

## 2. Plano de sessão
- Leia `docs/qa/playbook-loja.md`.
- Divida os fluxos em 3 lotes por perfil: responsável, admin, operador.

## 3. Fan-out (paralelo)
- Use o skill `superpowers:dispatching-parallel-agents`.
- Dispare 3 subagentes `qa-explorer` em paralelo (subagent_type "qa-explorer"), um por perfil, passando: o perfil, a lista de fluxos do playbook e a `QA_BASE_URL`. Inclua as credenciais de teste do perfil (do ambiente).

## 4. Consolidação
- Junte os JSON dos exploradores. Deduplique achados iguais. Confirme severidades (P0–P3).
- Conte verdes e achados por severidade.

## 5. Relatório
- Escreva `docs/qa-reports/<AAAA-MM-DD-HHMM>.md` com este formato:

```markdown
# Relatório de QA — Loja — <data/hora>
**Alvo:** <QA_BASE_URL>  ·  **Asaas:** sandbox  ·  **Perfis:** responsável, admin, operador

## Veredito
<✅ PODE LANÇAR  |  ⛔ NÃO LANÇAR — N bloqueador(es) P0>

## Resumo
| Severidade | Qtd |
|---|---|
| P0 | _ |
| P1 | _ |
| P2 | _ |
| P3 | _ |
| Fluxos verdes | _ |

## Achados
### [P0] <fluxo> — <título>
- **Passo:** ...
- **Esperado:** ... · **Obtido:** ...
- **Reproduzir:** 1)... 2)...
- **Artefato:** test-results/...
<repetir por achado, ordenado por severidade>

## Fluxos verdes (candidatos a regressão durável)
- ...
```

- Veredito = ⛔ se houver qualquer P0; senão ✅ com ressalvas listando P1+.

## 6. Cristalização (Fase 2)
- Para cada fluxo verde ainda sem spec durável, crie/atualize um spec em `tests/e2e/` seguindo `tests/e2e/README.md` (mova do `_scratch`, dê nome estável, mantenha as asserções). Rode `npx playwright test` para confirmar verde. Remova o `_scratch`.

## 7. Fechamento
- Responda ao usuário: caminho do relatório, o veredito e quantos specs duráveis foram criados/atualizados. NÃO faça push (só se o usuário pedir).
