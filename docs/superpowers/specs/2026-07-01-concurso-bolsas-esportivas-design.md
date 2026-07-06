# Concurso de Bolsas – Seletivas Esportivas 2027 — Documento de Design

**Data:** 2026-07-01
**Escola:** Educandário São Judas Tadeu (ESJT) — Camaragibe/PE
**`escola_id` (Loja / Supabase `rstsomdurwksoqxbypty`):** `5d4b0ca0-b55b-4c7b-a41f-08b83e3ec350`
**App:** Loja virtual (Next.js, deploy no Vercel) — repo `wsapao/EduStore`

---

## 1. Objetivo

Publicar uma **landing page pública** (sem login) com a identidade do site da ESJT, contendo as informações do Concurso de Bolsas Esportivas 2027 e um **formulário de inscrição**. Ao final, o responsável paga a **taxa de inscrição de R$ 25,00 via Pix**, gerada pela arquitetura de pagamento que já existe na Loja (Asaas), **sem criar cadastro na Loja**. Todos os dados do formulário ficam registrados para consulta em relatórios no admin.

## 2. Decisões acordadas (brainstorming)

1. **Pagamento** = taxa de inscrição fixa de **R$ 25,00** por candidato.
2. **Sem cadastro**: o responsável não cria conta na Loja. O Pix é gerado só com **CPF + nome** via `findOrCreateCustomer` do gateway Asaas.
3. **Uma modalidade por inscrição.** Para uma segunda modalidade, o responsável faz nova inscrição + novo Pix (conforme edital, item 2.2.e).
4. **Modalidades (5):** Futsal, Vôlei, Judô, Ginástica, Natação. *(O edital lista 8; a escola vai corrigir o edital para estas 5.)*
5. **Dados** gravados em **tabela nova** `inscricoes_concurso` — fonte dos relatórios.
6. **Relatórios/admin**: nova seção "Concurso de Bolsas" dentro do admin do Xkola/Loja, reaproveitando componentes existentes (lista, filtros, exportação). **A receita do concurso fica nesta seção** (não é injetada no relatório de Receita geral da Loja).
7. **Produto: NÃO será criado.** Como a receita é apurada na própria seção do concurso (lendo `inscricoes_concurso`), o produto seria um registro solto. O valor de R$ 25 vira **configuração do concurso**.
8. **Identidade visual** copiada do site real da ESJT (tokens extraídos do tema Elementor — ver §12).
9. **Sem servidor local** durante o desenvolvimento (trava a máquina do usuário): validação por testes/build. Publicação por commit + push (Vercel).

## 3. Escopo

**Dentro do escopo:**
- Landing page pública com a identidade da ESJT.
- Formulário de inscrição em etapas (18 campos do documento oficial + CPF + e-mail).
- Geração de cobrança Pix reaproveitando `getGateway()` / gateway Asaas.
- Confirmação automática do pagamento via webhook Asaas + polling na tela.
- E-mail de confirmação da inscrição.
- Seção de admin "Concurso de Bolsas": lista, filtros, detalhe, resumo financeiro, exportação.
- Edital em PDF disponível para download na página.

**Fora do escopo (agora):**
- Múltiplos concursos / multi-escola (o design deixa espaço, mas implementa 1 concurso p/ ESJT).
- Correção de `dominio`/`cnpj` placeholder do registro da escola (opcional, à parte).
- Avaliação/nota/resultado das etapas pedagógica e técnica (isto é gestão pós-inscrição; não faz parte).
- Cartão/boleto (só Pix nesta primeira versão).

## 4. Arquitetura geral

```
Pai (navegador, sem login)
        │
        ▼
Landing pública  ──►  Server Action `criarInscricaoConcurso`
/concurso-bolsas-2027       │  (roda no servidor, service role)
        ▲                   ├─ valida dados
        │  polling status   ├─ grava linha em `inscricoes_concurso` (status=pendente)
        │                   ├─ getGateway().criarPagamento({ metodo:'pix', referencia:`concurso:<id>` })
        │                   └─ grava dados do Pix (qr, copia-e-cola, expiração) na linha
        │
Tela Pix (QR + copia-e-cola)
        ▲
        │ confirma
Webhook Asaas  ──►  se externalReference começa com `concurso:` →
/api/webhook/asaas       marca inscrição `pago`, dispara e-mail

Admin (com login, papel admin)  ──►  /admin/concurso  (lista/filtros/detalhe/financeiro/export)
```

Tudo dentro do app da Loja. A rota pública passa pelo `middleware.ts` (`updateSession`), que apenas atualiza cookies de sessão e **não força login** — páginas públicas que não chamam `requireAuth` renderizam para anônimos (como `/termos`, `/privacidade`).

## 5. Rota pública e páginas

- Rota: `app/concurso-bolsas-2027/` (pública). *Alternativa futura: `app/concurso/[slug]/` para multi-concurso — fora do escopo.*
- Páginas/estados:
  - **Landing** (`page.tsx`): seções descritas em §12.
  - **Formulário** (wizard em 3 passos): Passo 1 Aluno · Passo 2 Responsáveis · Passo 3 Revisão + Pagamento.
  - **Pagamento Pix**: QR Code, copia-e-cola, contador de expiração, status "aguardando" com **polling** que vira ✅ ao confirmar (reaproveita o padrão de `AguardandoClient.tsx` da cantina).
- A `escola_id` da ESJT é uma **constante de configuração** (não vem de subdomínio nesta versão).

## 6. Modelo de dados — `inscricoes_concurso`

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `escola_id` | uuid FK `escolas` | ESJT |
| `numero` | text | Amigável, ex. `CB2027-0001`, gerado por **sequence** `inscricoes_concurso_numero_seq` (não usar `max()` em trigger sob RLS — ver [[project_trigger_rls_numero_pedido]]) |
| `aluno_nome` | text NOT NULL | Q1 |
| `aluno_nascimento` | date NOT NULL | Q2 |
| `turno` | text NOT NULL default `'tarde'` | Q3 (fixo tarde) |
| `serie_2026` | text NOT NULL | Q4 |
| `modalidade` | text NOT NULL | Q5 — check: `futsal, volei, judo, ginastica, natacao` |
| `instituicao_atual` | text NOT NULL | Q6 |
| `resp1_nome` | text NOT NULL | Q7 |
| `resp1_endereco` | text | Q8 |
| `resp1_telefone` | text | Q9 |
| `resp1_profissao` | text | Q10 |
| `resp1_parentesco` | text | Q11 |
| `resp1_cpf` | text NOT NULL | **necessário p/ Pix** |
| `resp1_email` | text NOT NULL | **p/ comprovante** |
| `resp2_nome` | text | Q12 |
| `resp2_endereco` | text | Q13 |
| `resp2_telefone` | text | Q14 |
| `resp2_profissao` | text | Q15 |
| `resp2_parentesco` | text | Q16 |
| `tem_irmaos` | boolean | Q17 |
| `irmaos_series_2026` | text | Q18 (comentário/série do irmão) |
| `valor` | numeric | Snapshot do valor pago (25.00) |
| `status_pagamento` | text NOT NULL default `'pendente'` | `pendente, pago, expirado, cancelado` |
| `gateway_id` | text | ID da cobrança no Asaas |
| `pix_qr_code` | text | copia-e-cola |
| `pix_qr_code_imagem` | text | base64 data URL |
| `pix_tx_id` | text | |
| `pix_expiracao` | timestamptz | |
| `pago_em` | timestamptz | preenchido pelo webhook |
| `created_at` | timestamptz default now() | |

**Índices:** `escola_id`, `status_pagamento`, `modalidade`, `gateway_id`.

## 7. Fluxo de inscrição + pagamento

Server Action `criarInscricaoConcurso(input)` (em `app/actions/concurso.ts`), usando `createAdminClient()` (service role):

1. Validação server-side de todos os campos obrigatórios (nome, nascimento, série, modalidade, instituição, resp1 nome/CPF/e-mail) + CPF válido.
2. Verifica janela de inscrição (06/07 a 23/08/2026) — configurável; fora da janela retorna erro amigável.
3. Insere linha em `inscricoes_concurso` com `status_pagamento='pendente'` (obtém `id` e `numero`).
4. Chama `getGateway().criarPagamento({ metodo:'pix', total: 25.00, responsavel:{nome:resp1_nome, email:resp1_email, cpf:resp1_cpf}, descricao:'Inscrição Concurso de Bolsas 2027 – <modalidade> – <aluno>', referencia:'concurso:'+id })`.
5. Persiste `gateway_id`, `pix_qr_code`, `pix_qr_code_imagem`, `pix_tx_id`, `pix_expiracao` na linha.
6. Retorna `{ inscricao_id, numero, pix }` para a tela exibir o QR.

> `referencia` vira o `externalReference` no Asaas — o prefixo `concurso:` é o que o webhook usa para rotear.

## 8. Webhook (extensão de `app/api/webhook/asaas/route.ts`)

Hoje o handler trata `payment.externalReference` como `pedido_id`. Extensão:

- Ao receber `PAYMENT_RECEIVED` / `PAYMENT_CONFIRMED`: se `externalReference` começa com `concurso:` → chamar novo `confirmarPagamentoConcurso(inscricaoId, netValue)`:
  - `update inscricoes_concurso set status_pagamento='pago', pago_em=now() where id=... and status_pagamento='pendente'` (idempotente).
  - Disparar e-mail de confirmação (§10).
- `PAYMENT_OVERDUE` com prefixo `concurso:` → `status_pagamento='expirado'`.
- Caso contrário, mantém o comportamento atual (pedidos da loja).

## 9. Expiração do Pix

Reaproveitar o mecanismo existente (`lib/pagamentos/expirePixJob.ts` / `app/api/cron/expire-pix`). Cobranças com `pix_expiracao` vencida e ainda `pendente` passam a `expirado`. A tela do Pix mostra o contador; expirado, oferece "gerar novo Pix" (cria nova cobrança para a mesma inscrição).

## 10. E-mail de confirmação

Reaproveitar `lib/email/send`. Novo template `enviarEmailInscricaoConcurso({ para: resp1_email, numero, aluno_nome, modalidade })`: confirma inscrição + pagamento, resume datas das etapas e lembra dos documentos exigidos no dia (declaração de saúde apta à prática esportiva + boletim escolar).

## 11. Admin — seção "Concurso de Bolsas"

Rota `app/(admin)/admin/concurso/`, protegida por papel admin (padrão atual do admin).

- **Lista** de inscrições: nº, aluno, série, modalidade, responsável, status (pago/pendente/expirado), data. Reaproveita os componentes de tabela/badge do admin (padrão `STATUS_TONE`).
- **Filtros:** status de pagamento, modalidade, série; busca por nome/CPF.
- **Detalhe** da inscrição: todos os 18 campos + dados do pagamento.
- **Financeiro (aba):** total arrecadado (pagos), nº de inscrições por status, nº por modalidade, taxa do Asaas — mesma pegada visual do relatório de Receita atual.
- **Exportação:** CSV/XLSX de todas as inscrições (com filtros aplicados), reaproveitando o padrão de export existente.

## 12. Identidade visual (tokens reais extraídos do site)

- **Fontes:** títulos **Roboto Slab**; texto **Roboto**.
- **Cores:** primária navy **`#34436B`**; secundária/CTA vermelho **`#C1161A`**; fundos azul-claro **`#EDF3FF`** / `#C0CEEA` / `#D7DFEC`; cinza texto `#6E7A98`; destaque amarelo `#FFC402`.
- **Botões:** cantos ~6px, CTA vermelho no estilo "Matricule-se".
- **Logo/banner:** o site tem proteção anti-hotlink; na versão final, hospedar o logo e um banner esportivo no próprio app (`/public`) — solicitar os arquivos à escola ou reutilizar `logo_url`/`banner_url` do registro da escola.
- **Seções da landing (ordem):** faixa superior (telefone/social) → header (logo + menu + botão "Inscreva-se") → hero (banner + selo "Seletivas Esportivas 2027" + CTA R$ 25 + "Baixar edital") → faixa de destaques (até 100% · 5 modalidades · R$ 25) → "O Concurso" → Modalidades → Como funciona (4 etapas com datas) → Tabela de bolsas (100/50/30/8%) → faixa de CTA vermelha → rodapé navy com endereço/contato.

**Conteúdo factual (do edital):** inscrições 06/07–23/08/2026; pagamento até 26/08; prova pedagógica 30/08 (domingo) 08h30–11h30 na sede da ESJT; seletiva técnica 09–19/09 (divulgada 31/08); resultados 22–30/09; matrícula até 03/10. Tabela de desconto: média 10 → 100%; 9,0–9,9 → 50%; 8,0–8,9 → 30%; 7,0–7,9 → 8%. Público: 2º ano EF à 3ª série EM, turno tarde.

## 13. Configuração do concurso

Na v1, **constantes em um módulo de código** (`lib/concurso/config.ts`) — simples e suficiente para 1 concurso. (Config editável via banco/admin fica como melhoria futura; editar datas na v1 exige um pequeno deploy.)
- `escola_id` = `5d4b0ca0-...`
- `valor_inscricao` = 25.00
- `inscricoes_abertura` / `inscricoes_encerramento` / `pagamento_limite`
- `modalidades` = [futsal, volei, judo, ginastica, natacao]
- `edital_pdf_url` (PDF hospedado em `/public` ou storage)

## 14. Segurança e RLS

- `inscricoes_concurso` **sem acesso público direto**. Escrita apenas via server action com **service role**. `REVOKE ... FROM PUBLIC` + `GRANT` ao `service_role` (ver [[project_loja_rpc_execute_hardening]]).
- O navegador anônimo nunca lê/escreve a tabela diretamente → nenhuma inscrição de terceiros é exposta.
- Leitura no admin via políticas/consultas já usadas para o papel admin.
- Webhook mantém a verificação de autenticidade já existente (token no header).
- Rate limiting básico na server action de criação (evitar flood de cobranças).

## 15. Testes (Vitest)

- `criarInscricaoConcurso`: valida obrigatórios, rejeita CPF inválido, respeita janela de inscrição, grava linha + chama gateway (mock) e persiste dados do Pix.
- Webhook: `externalReference='concurso:<id>'` marca `pago` (idempotente — não repete se já pago) e dispara e-mail; `OVERDUE` marca `expirado`; `externalReference` de pedido comum **não** toca `inscricoes_concurso`.
- Numeração via sequence (formato `CB2027-000N`, sem colisão).
- Financeiro do admin: soma apenas pagos.
- **Sem dev server local** (ver [[feedback_no_local_dev_server_rh]]); provar por `vitest` + `tsc`/build.

## 16. Publicação

Branch dedicada (ex. `feat/concurso-bolsas-esportivas`). Migração aplicada no Supabase da Loja. Ao concluir: commit + push → deploy automático no Vercel (ver [[feedback_deploy_after_fix]]). Configurar o webhook do Asaas (se ainda não cobre o evento) e checar `interrupted` se parar de chegar (ver [[project_asaas_webhook_interrupted]]).

## 17. Itens em aberto

- Fornecer **logo + banner esportivo** para hospedar no app (ou confirmar uso de `logo_url`/`banner_url` da escola).
- Fornecer o **PDF do edital** já corrigido (5 modalidades) para download.
- Confirmar o **texto de LGPD/consentimento** de uso de dados no formulário (o edital já prevê uso de imagem; incluir aceite).

## 18. Critérios de aceite

1. Página pública abre sem login, com a identidade visual da ESJT.
2. Formulário coleta os 18 campos + CPF + e-mail e valida obrigatórios.
3. Ao enviar, é gerada uma cobrança Pix real (Asaas) de R$ 25,00 sem cadastro.
4. Pagando o Pix, a inscrição vira "pago" automaticamente (webhook) e a tela confirma; e-mail enviado.
5. No admin, a inscrição aparece com todos os dados, filtrável e exportável; o financeiro soma os pagos.
6. Nenhum dado de inscrição fica acessível a usuários anônimos.
7. Testes passam; sem necessidade de subir servidor local.
