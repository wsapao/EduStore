# Agente de QA exploratório — Loja virtual (EduStore)

**Data:** 2026-06-17
**Repo:** wsapao/EduStore (`Loja virtual/app`)
**Status:** Design aprovado nas decisões; aguardando revisão do spec.

## 1. Objetivo

Um agente que testa a Loja **como uma pessoa real faria**, de ponta a ponta, antes de
lançar para clientes. Ele percorre os fluxos nos três perfis (responsável, admin,
operador/PDV) num navegador de verdade, **gera dados como um usuário** (cria arquivo
aleatório e sobe, inventa CPF/nome/aluno, paga PIX em sandbox, tenta quebrar validações),
captura prints/traces e entrega um relatório com veredito **"pode lançar?"**.

Formato **híbrido**: além de caçar bugs explorando, ele **cristaliza os fluxos que
validou em testes Playwright duráveis** no repo, que viram regressão para o bug não voltar.

## 2. Decisões (travadas)

| Tema | Decisão |
|---|---|
| Sistema alvo (primeiro) | **Loja virtual**; generalizar depois p/ CRM, RH, Secretaria |
| Ambiente | **Preview/staging na Vercel** + Asaas **sandbox** + Resend p/ caixa de teste |
| Camada de dados | **Supabase Branch** (efêmero, isolado, casado com o preview da Vercel) |
| Driver de navegador | **Playwright / Chromium headless** apontando p/ `QA_BASE_URL` |
| Formato | **Híbrido** — exploração + specs de regressão duráveis |
| Gatilho | **Sob demanda** (`/qa-loja`); automatizar (CI/cron) depois |
| Topologia | **Orquestrador + exploradores paralelos por perfil + consolidação** |
| Relatório | **Markdown versionado** em `docs/qa-reports/AAAA-MM-DD-HHMM.md` |

### Restrições herdadas do projeto
- **Nunca subir dev server local** (trava a máquina do usuário) — o agente sempre aponta
  para uma **URL publicada** de staging.
- **Nunca rodar contra produção** — efeitos reais (cobrança Asaas, e-mail Resend, webhook).
- Push/deploy só quando o usuário pedir.

## 3. Arquitetura

```
Usuário: "/qa-loja"
   │
   ▼
[Orquestrador]  (sessão principal via comando /qa-loja)
   │   1. TRAVA DE SEGURANÇA: aborta se QA_BASE_URL não for o host de staging
   │      conhecido OU se ASAAS_ENVIRONMENT != 'sandbox'.
   │   2. Lê o Playbook (fluxos × perfis × critério de "certo").
   │   3. Despacha exploradores EM PARALELO (padrão dispatching-parallel-agents).
   │
   ├─▶ [qa-explorer: RESPONSÁVEL] ┐  cada um:
   ├─▶ [qa-explorer: ADMIN]       ├─ loga no perfil
   └─▶ [qa-explorer: OPERADOR]    ┘─ dirige Chromium (Playwright) contra QA_BASE_URL
                                     ─ gera dados realistas + casos-limite
                                     ─ captura screenshot/trace
                                     ─ devolve achados estruturados (JSON)
   │
   ▼
[Orquestrador consolida]
   ─ deduplica achados, atribui severidade (P0–P3)
   ─ escreve docs/qa-reports/AAAA-MM-DD-HHMM.md (+ veredito)
   ─ cristaliza fluxos verdes em tests/e2e/ (specs Playwright duráveis)
```

**Por que o orquestrador é a sessão principal (e não um agente que aninha agentes):**
o padrão confiável em Claude Code é a sessão principal despachar subagentes em paralelo
e consolidar. Evita aninhamento frágil de agente-dentro-de-agente.

## 4. Componentes (com caminhos)

Todos dentro de `Loja virtual/app/` (repo EduStore).

### 4.1 Harness Playwright
- `package.json` — adicionar `@playwright/test`; scripts `test:e2e`, `test:e2e:ui`.
- `playwright.config.ts` — `baseURL = process.env.QA_BASE_URL`; Chromium headless;
  `trace: 'on-first-retry'`, `screenshot: 'only-on-failure'`, `retries: 1`.
- `tests/e2e/` — specs de regressão **duráveis** (cristalizadas a partir de fluxos verdes).
- `tests/qa/fixtures/` — utilidades compartilhadas:
  - `auth.ts` — login por perfil (responsável/admin/operador). Preferir login
    programático via Supabase quando viável; senão, login pela UI.
  - `safety.ts` — **trava de segurança**: valida host de staging + `ASAAS_ENVIRONMENT=sandbox`
    antes de qualquer ação; lança erro e aborta caso contrário.
  - `data.ts` — toolkit "humano": CPF/CNPJ válido aleatório, nomes/e-mails (caixa de
    teste), telefone, e **gerador de arquivo aleatório na hora** (PNG/PDF) p/ provar uploads.
  - `cleanup.ts` — cria entidades de teste com prefixo `QA-<timestamp>` e remove no fim.

### 4.2 Agente explorador
- `.claude/agents/qa-explorer.md` — agente reutilizável. Recebe *perfil + lista de fluxos
  + URL*. Faz login, percorre cada fluxo (happy-path **e** caminho infeliz), gera dados,
  captura artefatos, devolve achados: `{fluxo, passo, esperado, obtido, severidade, repro, artefato}`.
  Tem licença para **exploração livre** além do playbook.

### 4.3 Orquestrador (comando)
- `.claude/commands/qa-loja.md` — o `/qa-loja`. Faz a trava de segurança, lê o playbook,
  despacha exploradores, consolida, escreve relatório e cristaliza specs.

### 4.4 Playbook (o "cérebro vivo")
- `docs/qa/playbook-loja.md` — enumera **todos os fluxos por perfil** e o critério de
  "comportamento correto". Editável pelo usuário ("teste também isto"). Cobertura inicial:
  - **Auth:** cadastro, login, recuperação de senha, troca de senha.
  - **Responsável (loja):** navegar loja, ver produto, carrinho, **checkout** (PIX sandbox
    + cartão sandbox recusado/aprovado), pedidos, ingresso/[token], perfil, alunos,
    privacidade.
  - **Cantina:** cartão, **recarga** (gera PIX sandbox → confirma → saldo atualiza →
    e-mail p/ caixa de teste), extrato, configurar, recarga/[recarga_id].
  - **Admin:** alunos, responsáveis (+export), pedidos, cantina (recargas/carteiras/produtos),
    relatório, vouchers, check-in, receita, **produtos** (novo/editar/categorias, **upload de
    imagem**), **PDV**, configurações (papéis, cantina, pagamentos, e-mails, loja-online,
    checkout, termos, usuários, integrações, dados, auditoria).
  - **Operador:** fluxo do operador/PDV.
  - **Casos-limite transversais:** campo vazio, CPF inválido, arquivo gigante/tipo errado,
    texto com caracteres especiais/tentativa de XSS, valores negativos, sessão expirada,
    permissão de papel (RLS) — perfil sem acesso não consegue ações de admin.

### 4.5 Relatório
- `docs/qa-reports/AAAA-MM-DD-HHMM.md` — por achado: severidade, fluxo, passos p/
  reproduzir, esperado vs. obtido, link do artefato (print/trace). Fecha com **veredito**:
  ✅ pode lançar / ⛔ bloqueadores (lista de P0).

## 5. Fluxo de dados de uma rodada

1. Usuário roda `/qa-loja` (opcionalmente passando a URL de staging).
2. Orquestrador valida segurança → lê playbook → fan-out de exploradores (1 por perfil).
3. Cada explorador loga, percorre fluxos via Playwright, gera dados `QA-<ts>`, captura
   artefatos, retorna achados JSON; limpa os dados que criou.
4. Orquestrador deduplica/classifica, escreve o relatório com veredito.
5. Para fluxos verdes, atualiza/cria specs duráveis em `tests/e2e/`.
6. Responde ao usuário com o caminho do relatório e o veredito.

## 6. Segurança e robustez

- **Trava inegociável:** recusa rodar fora do host de staging conhecido ou sem
  `ASAAS_ENVIRONMENT=sandbox`. Nunca produção.
- **Dados descartáveis e rotulados:** prefixo `QA-<timestamp>`; cada explorador limpa o
  que criou — staging (branch Supabase) não acumula lixo.
- **Bug vs. flaky:** retry 1× em falha de rede; o que persistir é achado real, o resto é
  marcado "instável".
- **Isolamento:** exploradores não compartilham estado mutável; cada um cria sua própria
  conta/aluno de teste.
- **Severidade:** P0 (bloqueia lançamento) · P1 (grave) · P2 (menor) · P3 (cosmético).

## 7. Pré-requisitos de infraestrutura (dependem do usuário)

Não são provisionáveis só por código — exigem segredos/console:

1. **Deploy de staging na Vercel** com env:
   - `ASAAS_ENVIRONMENT=sandbox` + `ASAAS_API_KEY`/`ASAAS_CANTINA_API_KEY` sandbox.
   - Resend apontando p/ caixa de teste (domínio/endereço de teste).
   - `QA_BASE_URL` = URL do preview.
2. **Supabase Branch** do projeto `rstsomdurwksoqxbypty` (pode ser criado via MCP),
   com seed mínimo (1 escola de teste + papéis). O preview da Vercel aponta p/ a branch.

## 8. Fases de implementação

- **Fase 0 — Fundação:** Playwright + config + fixtures (auth, safety, data, cleanup) +
  smoke test (loga e abre a loja contra staging).
- **Fase 1 — O agente:** `qa-explorer` + comando `/qa-loja` + playbook da Loja + relatório.
- **Fase 2 — Regressão:** cristalizar fluxos verdes em `tests/e2e/`.
- **Futuro:** generalizar a casca p/ CRM, RH, Secretaria (mesmo agente, outro playbook +
  fixtures de auth específicas).

## 9. Critérios de sucesso

- `/qa-loja` roda contra staging sem tocar em produção e sem efeito externo real.
- Encontra e reporta pelo menos os bugs plantados num teste de mesa (validação ausente,
  upload quebrado) com passos reproduzíveis e artefato.
- Gera relatório com veredito claro de lançamento.
- Fluxos verdes viram specs duráveis que rodam com `npm run test:e2e`.

## 10. Fora de escopo (por ora)

- Automação por CI/cron (Fase futura).
- Abrir issues no GitHub automaticamente (escolhido relatório markdown).
- CRM/RH/Secretaria (generalização posterior).
- Testes de carga/performance e segurança ofensiva (só checagens leves de RLS/validação).
