# Design — Menu de Configurações da Loja Virtual (EduStore)

**Data:** 2026-05-11
**Status:** Aprovado para implementação
**Escopo:** 12 módulos de configuração entregues em 3 fases

---

## 1. Contexto e Objetivo

Hoje a EduStore não tem uma área central de **Configurações**. A sidebar do admin tem um grupo "Ajustes" com apenas duas entradas (Categorias, Vouchers), e ações sensíveis (criar admin, mudar role, ajustar credenciais) são feitas direto no SQL Editor do Supabase. Isso impede que a loja seja entregue a uma escola sem dependência do desenvolvedor.

**Objetivo:** criar `/admin/configuracoes` com 12 módulos cobrindo identidade, permissões, pagamento, comunicação e operação — tornando a escola autônoma e introduzindo um sistema de papéis customizáveis no lugar do `app_metadata.role`.

## 2. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Modelo de papéis | Presets de fábrica + papéis customizados via checkboxes | Flexibilidade sem complexidade de RBAC granular por usuário |
| Credenciais sensíveis | Híbrido: API keys em env, configs operacionais na UI | Segurança de chaves + autonomia operacional |
| Banner | Único (Fase 1), carousel não está em escopo | Entregar valor sem inflar Fase 1 |
| Templates de e-mail | Texto com variáveis `{{nome}}` | 90% das necessidades sem editor visual complexo |
| Estrutura | Sidebar com sub-rotas em `/admin/configuracoes/*` | Padrão Notion/Linear, escalável |

## 3. Arquitetura

### 3.1 Rotas

```
/admin/configuracoes
├── /loja              [F1] Identidade & personalização
├── /usuarios          [F1] Gerenciamento de usuários
├── /papeis            [F1] Papéis & permissões
├── /pagamentos        [F1] Configurações de pagamento
├── /conta             [F1] Minha conta
├── /emails            [F2] Notificações & templates
├── /cantina           [F2] Configurações da cantina
├── /checkout          [F2] Pedidos & checkout
├── /termos            [F2] Termos & LGPD
├── /integracoes       [F2] Integrações externas
├── /loja-online       [F2] Catálogo & vitrine
├── /auditoria         [F3] Logs de auditoria
└── /dados             [F3] Backup & exportação LGPD
```

### 3.2 Layout

- Sidebar de configurações à esquerda agrupando os módulos por área: **Loja** (Identidade, Loja Online), **Acesso** (Usuários, Papéis, Conta), **Operação** (Pagamentos, E-mails, Cantina, Checkout, Termos), **Avançado** (Integrações, Auditoria, Dados).
- Cada página é uma seção independente com formulário próprio e botão "Salvar alterações".
- Itens da sidebar a que o usuário não tem permissão são ocultos.

### 3.3 Padrões técnicos

- **Framework:** Next.js App Router (já em uso em `app/(admin)/admin`).
- **Server Actions:** novas actions em `app/actions/configuracoes/<modulo>.ts`.
- **Banco:** Supabase com RLS por `escola_id`.
- **Validação:** Zod em todo input antes da persistência.
- **Tipos:** estendidos em `types/database.ts`.
- **Storage:** bucket `escola-assets` para logo, banner, favicon.

### 3.4 Modelo de dados — novas tabelas

| Tabela | Função |
|---|---|
| `escola_configuracoes` | Configs operacionais (1:1 com `escolas`) |
| `papeis` | Papéis por escola (presets + customizados) |
| `papel_permissoes` | Lista de chaves de permissão de cada papel |
| `usuario_papel` | Associação `auth.users.id` ↔ `papeis.id` |
| `email_templates` | Templates editáveis (Fase 2) |
| `termos_versoes` | Versionamento de Termos/Política (Fase 2) |
| `auditoria_log` | Histórico de mudanças (Fase 3) |

A tabela `escolas` ganha colunas: `razao_social`, `banner_url`, `slogan`, `texto_boas_vindas`, `favicon_url`, `endereco_logradouro`, `endereco_numero`, `endereco_bairro`, `endereco_cidade`, `endereco_uf`, `endereco_cep`.

### 3.5 Sistema de permissões

Cada módulo expõe **chaves de permissão** no formato `<modulo>.<acao>`. Lista canônica:

| Módulo | Permissões |
|---|---|
| produtos | ver, criar, editar, excluir |
| categorias | ver, gerenciar |
| pedidos | ver, estornar, cancelar |
| pagamentos | ver, estornar |
| vouchers | ver, gerenciar |
| alunos | ver, editar |
| responsaveis | ver, editar |
| checkin | usar |
| pdv | usar |
| cantina | ver, operar, gerenciar |
| relatorios | ver |
| receita | ver |
| configuracoes | ver, editar_identidade, editar_pagamentos, gerenciar_usuarios, gerenciar_papeis |

**Verificação:** helper `requirePermission(key)` chamado no início de toda Server Action sensível e em layouts/páginas. UI esconde botões/links sem permissão.

**Presets de fábrica** (não deletáveis, editáveis com aviso):
- **Admin:** todas as permissões.
- **Gerente:** todas exceto `configuracoes.gerenciar_usuarios` e `configuracoes.gerenciar_papeis`.
- **Financeiro:** todas as `.ver` + `pedidos.estornar` + `pagamentos.estornar` + `relatorios.ver` + `receita.ver`.
- **Cantineiro:** `cantina.*` + `alunos.ver` + `pdv.usar`.
- **Operador:** `pdv.usar` + `checkin.usar` + `pedidos.ver`.
- **Visualizador:** todas as `.ver`, nada mais.

**Migração do modelo antigo:** seed inicial cria os 6 presets em cada escola, e converte cada `auth.users.raw_app_meta_data.role` existente para uma linha em `usuario_papel` (`admin` → preset Admin, `operador` → preset Operador). O check `user.app_metadata.role === 'admin'` nos layouts é substituído por uma verificação que consulta `usuario_papel` + `papel_permissoes`.

---

## 4. Fase 1 — Essencial

### 4.1 Identidade & Personalização — `/admin/configuracoes/loja`

**Campos:**
- Nome fantasia, razão social, CNPJ
- Logo (upload, max 2MB, PNG/JPG/SVG)
- Banner principal (upload, recomendado 1920×600, max 2MB)
- Cor primária (color picker — campo `cor_primaria` já existe)
- Slogan (texto ≤ 120 caracteres)
- Texto de boas-vindas (textarea ≤ 500 caracteres)
- Favicon (upload, ICO/PNG ≤ 256KB)
- Domínio customizado (campo `dominio` já existe)
- Endereço fiscal (logradouro, número, bairro, cidade, UF, CEP)

**Comportamento:** banner aparece no topo de `/loja`. Slogan e boas-vindas no hero. Logo no header e em e-mails. Cor primária já é injetada via `escolaThemeStyle`.

**Permissão:** `configuracoes.editar_identidade`.

### 4.2 Usuários — `/admin/configuracoes/usuarios`

**Funcionalidades:**
- Listagem (nome, e-mail, papel, último acesso, status ativo/suspenso)
- Convite por e-mail via Supabase Invite — destinatário define a senha
- Alterar papel de um usuário (dropdown com papéis disponíveis)
- Suspender / reativar acesso
- Remover usuário (soft delete — registra em `auditoria_log` na Fase 3)

**Regras:**
- Não permite remover o último usuário com permissão `configuracoes.gerenciar_usuarios`.
- Mudança de papel exige confirmação por senha do admin atuante.

**Permissão:** `configuracoes.gerenciar_usuarios`.

### 4.3 Papéis & Permissões — `/admin/configuracoes/papeis`

**Tela de listagem:**
- 6 presets de fábrica + papéis customizados criados pela escola.
- Para cada papel: nome, descrição, contagem de usuários, badge "Preset" / "Customizado".
- Botões: "Novo papel", "Duplicar", "Editar", "Excluir" (somente customizados sem usuários).

**Editor de papel:**
- Nome, descrição.
- Lista de checkboxes agrupada por módulo (ver tabela de permissões em 3.5).
- Atalhos: "Marcar todas do módulo", "Marcar só as `.ver`".
- Aviso ao editar preset: "Este é um papel padrão. Alterações afetam X usuários."

**Permissão:** `configuracoes.gerenciar_papeis`.

### 4.4 Pagamentos — `/admin/configuracoes/pagamentos`

**Editáveis na UI:**
- Métodos aceitos por padrão (PIX, Cartão, Boleto — checkboxes).
- Máximo de parcelas (1–12).
- Tempo de expiração do PIX (15min / 30min / 1h / 24h).
- Taxa de cartão repassada ao cliente (sim/não, % se sim).
- Webhook secret Asaas.
- Chave PIX recebedora (texto exibido em comprovantes).

**Não editáveis (em env vars):**
- `ASAAS_API_KEY` — exibe apenas badge "✓ configurado" / "✗ não configurado" e instruções de como ajustar no Vercel.

**Permissão:** `configuracoes.editar_pagamentos`.

### 4.5 Minha Conta — `/admin/configuracoes/conta`

- Trocar senha (senha atual + nova + confirmação).
- Habilitar/desabilitar MFA (TOTP via Supabase Auth).
- Editar nome e e-mail do usuário logado.
- Listar sessões ativas + botão "encerrar todas exceto esta".

**Permissão:** disponível para qualquer usuário autenticado (afeta apenas a própria conta).

---

## 5. Fase 2 — Operação completa

### 5.1 Notificações & E-mail — `/admin/configuracoes/emails`

- **Remetente:** nome de exibição + e-mail (usa provedor já configurado em `lib/email`).
- **Logo no e-mail** (upload separado).
- **Templates editáveis** (texto + variáveis `{{var}}`):
  - Confirmação de pedido (PIX/Cartão/Boleto)
  - Pedido pago
  - Pedido cancelado / expirado
  - Ingresso emitido
  - Recarga de cantina aprovada
  - Convite de novo usuário admin
- **Variáveis disponíveis:** painel lateral com chips clicáveis que inserem a variável no cursor. Variáveis padrão: `{{nome_responsavel}}`, `{{numero_pedido}}`, `{{total}}`, `{{nome_aluno}}`, `{{link_pedido}}`, `{{nome_escola}}`.
- **Preview** com dados de exemplo + botão "enviar teste pra mim".
- Botão **"Restaurar template padrão"** por template.
- Render dos templates é **server-side** (sem `eval` — apenas substituição de variáveis whitelisted).

### 5.2 Cantina — `/admin/configuracoes/cantina`

- Valor mínimo / máximo de recarga.
- Métodos aceitos para recarga.
- Exigir PIN para resgate? (sim/não) + tamanho do PIN (4–6 dígitos).
- Permite saldo negativo? (sim/não).
- Restrições alimentares (lista editável).
- Horário de funcionamento (dias da semana + janelas de horário).

A `lib/cantina/*` lê dessa configuração em vez de constantes hard-coded.

### 5.3 Pedidos & Checkout — `/admin/configuracoes/checkout`

- Termo padrão de compra (textarea — aplicado a produtos sem termo próprio).
- Permite múltiplos alunos no mesmo pedido? (sim/não).
- Mensagem de pós-compra (mostrada em `/pedido/sucesso`).
- Tempo de expiração do carrinho (sem checkout).
- Exigir CPF do responsável no cadastro? (sim/não).

### 5.4 Termos & LGPD — `/admin/configuracoes/termos`

- Editor de **Termos de Uso** (markdown ou rich-text simples).
- Editor de **Política de Privacidade**.
- Versionamento: ao salvar, cria nova versão na tabela `termos_versoes`.
- E-mail do DPO/Encarregado.
- Relatório de quem aceitou qual versão (cruzando com `responsaveis`).
- Botão para forçar re-aceite quando publica nova versão.

### 5.5 Integrações — `/admin/configuracoes/integracoes`

Cards habilitar/desabilitar:
- **Activesoft** — habilitar + URL + token.
- **CRM** — habilitar + endpoint + token.
- **Asaas Webhook** — exibe status (ativo/`interrupted`), botão "reativar" (resolve o problema documentado em memória).
- **Google Analytics** — campo GA4 ID.
- **Meta Pixel** — campo Pixel ID.

Cada card mostra: status (✓/✗), data do último teste, botão "testar conexão".

### 5.6 Loja Online — `/admin/configuracoes/loja-online`

- Modo manutenção (loja fechada com mensagem customizável).
- Horário de funcionamento da loja online (fora dele, mostra aviso).
- Categorias visíveis na home (drag-and-drop pra reordenar).
- Produtos em destaque (até 6 produtos selecionáveis).
- Layout da home: grid / lista.
- Mostrar contador de estoque baixo? (sim/não).
- Texto do rodapé (informações de contato).

---

## 6. Fase 3 — Avançado

### 6.1 Auditoria & Logs — `/admin/configuracoes/auditoria`

- Tabela `auditoria_log`: usuário, ação, módulo, valor antes, valor depois, timestamp, IP.
- **Eventos rastreados:** alterações em qualquer tela de configurações, criação/remoção de usuários, mudança de papel, estorno de pedido, edição de produto, exclusão de aluno.
- Tela com filtros: usuário, módulo, tipo de evento, intervalo de datas.
- Exportação CSV.
- Retenção: 12 meses (cron de limpeza diário).

**Implementação:** helper `auditLog()` chamado dentro das Server Actions sensíveis.

### 6.2 Backup & Dados — `/admin/configuracoes/dados`

- Exportar pedidos (CSV/Excel, com filtros de período).
- Exportar alunos (CSV — confirmação dupla por LGPD).
- Exportar responsáveis (CSV — confirmação dupla).
- **LGPD — exclusão:** input de CPF → preview do que será apagado → confirmação por senha → soft delete + log.
- **LGPD — portabilidade:** input de CPF → gera ZIP com todos os dados que a escola tem do CPF.

---

## 7. Segurança transversal

Aplica em todas as fases:

- **RLS:** todas as novas tabelas têm RLS por `escola_id`. Política só permite acesso a registros da escola do usuário autenticado.
- **Server Actions:** sempre chamam `requirePermission(key)` antes de qualquer mutação. Falha lança 403.
- **Rate limit:** ações sensíveis (convite, mudança de papel, estorno) usam `lib/ratelimit.ts`.
- **Validação Zod:** todo input passa por schema Zod antes de chegar ao banco.
- **Uploads:** logo/banner/favicon validam tipo MIME e limite de tamanho. Nome do arquivo é sanitizado e prefixado por `escola_id`.
- **Logs:** segredos (Asaas key, webhook secret) nunca aparecem em logs do servidor nem em respostas da API.
- **Confirmação por senha:** mudança de papel, remoção do último admin, exclusão LGPD exigem reentrada de senha.

## 8. Testes

Para cada Server Action de configuração:

- **Permissão:** usuário sem a chave correta recebe 403.
- **Validação:** input inválido é rejeitado e a mutação não acontece.
- **Happy path:** mutação persiste corretamente e retorna dados esperados.
- **RLS:** usuário da escola A não consegue ler/escrever dados da escola B.

Para o sistema de papéis:
- Migração do modelo antigo (`app_metadata.role`) gera as linhas corretas em `usuario_papel`.
- Não permite remover o último usuário com `configuracoes.gerenciar_usuarios`.
- Editar preset não permite alterar a chave interna (apenas nome e checkboxes).

## 9. Plano de fases

**Fase 1 (essencial — sem isso a loja não roda autônoma):**
4.1 Identidade · 4.2 Usuários · 4.3 Papéis · 4.4 Pagamentos · 4.5 Minha Conta + sistema de permissões.

**Fase 2 (operação completa):**
5.1 E-mails · 5.2 Cantina · 5.3 Checkout · 5.4 Termos · 5.5 Integrações · 5.6 Loja Online.

**Fase 3 (avançado):**
6.1 Auditoria · 6.2 Backup & LGPD.

Cada fase recebe seu próprio plano de implementação e pode ser entregue/deploy independentemente.

## 10. Fora de escopo

- App mobile nativo de configurações.
- Editor visual rich-text de e-mail (decidido: texto + variáveis).
- Carousel de banners (decidido: banner único).
- Campos de configuração granular por usuário individual (RBAC fino) — papéis bastam.
- Migração das credenciais Asaas para banco — ficam em env (decidido).
- Configuração de gateways alternativos (Stripe, Mercado Pago) — só Asaas por ora.
