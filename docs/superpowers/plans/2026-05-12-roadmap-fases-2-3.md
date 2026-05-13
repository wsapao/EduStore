# Roadmap — Fases 2 e 3 do Menu de Configurações

**Status:** Fase 1 completa em produção (PRs #1–#6, 92 testes). Este documento consolida tudo que falta.

**Spec referência:** [2026-05-11-configuracoes-loja-design.md](../specs/2026-05-11-configuracoes-loja-design.md)

**Convenção:** Cada item gera seu próprio plano detalhado em `docs/superpowers/plans/`. A ordem aqui é a ordem recomendada de execução — itens posteriores dependem de itens anteriores.

---

## Fase 2 — Operação completa (6 módulos)

Tudo que a escola precisa pra operar a loja sem desenvolvedor: comunicação, regras de negócio, integrações.

### 2.1 — Notificações & E-mail · `/admin/configuracoes/emails`

**Spec:** seção 5.1
**Complexidade:** Alta (envolve render de templates + integração com Resend)
**Migrations:** Sim — tabela `email_templates`

**Funcionalidades:**
- Configurar remetente (nome + e-mail)
- Logo separada para e-mails
- **Editor de templates** texto + variáveis `{{nome_aluno}}`, `{{numero_pedido}}`, etc.
- 6 templates: confirmação pedido (PIX/cartão/boleto), pedido pago, cancelado, ingresso, recarga cantina, convite admin
- Painel lateral com chips clicáveis pra inserir variáveis
- Preview com dados de exemplo + botão "enviar teste"
- Botão "restaurar padrão" por template

**Decisões críticas:**
- Substituição **whitelist-based** (não `eval`) — só variáveis pré-definidas
- Render server-side
- E-mails seguem disparando das actions atuais (`lib/email`), só lendo template do banco se existir

**Arquivos esperados:** ~6 (1 migration, 1 server action, 1 helper de render, 3 components UI)
**Testes esperados:** ~12

---

### 2.2 — Cantina · `/admin/configuracoes/cantina`

**Spec:** seção 5.2
**Complexidade:** Média
**Migrations:** Não (campos já em `escola_configuracoes`)

**Funcionalidades:**
- Valor mínimo / máximo de recarga
- Métodos aceitos para recarga
- Exigir PIN? (sim/não) + tamanho do PIN (4-6 dígitos)
- Permite saldo negativo? (sim/não)
- Restrições alimentares (lista editável — chips)
- Horário de funcionamento (dias + janelas)

**Decisões:**
- `lib/cantina/*` precisa **ler** dessa config em vez das constantes hard-coded — refator necessário
- Restrições alimentares: salvar como `TEXT[]` numa nova coluna, ou só usar a tabela `cantina_restricoes` que já existe? Investigar antes do plano.

**Arquivos esperados:** ~4 (1 server action, 1 page, 2 client components)
**Testes esperados:** ~10

---

### 2.3 — Pedidos & Checkout · `/admin/configuracoes/checkout`

**Spec:** seção 5.3
**Complexidade:** Baixa
**Migrations:** Não (campos já em `escola_configuracoes`)

**Funcionalidades:**
- Termo padrão de compra (textarea)
- Permite múltiplos alunos no mesmo pedido? (sim/não)
- Mensagem pós-compra (mostrada em `/pedido/sucesso`)
- Tempo de expiração do carrinho (minutos)
- Exigir CPF do responsável no cadastro? (sim/não)

**Decisões:**
- Refator pequeno em `app/(loja)/checkout/*` pra ler `permite_multiplos_alunos` e `mensagem_pos_compra`
- Cadastro precisa ler `exige_cpf_responsavel`

**Arquivos esperados:** ~3 (1 server action, 1 page, 1 client form)
**Testes esperados:** ~8

---

### 2.4 — Termos & LGPD · `/admin/configuracoes/termos`

**Spec:** seção 5.4
**Complexidade:** Média-Alta (versionamento)
**Migrations:** Sim — tabela `termos_versoes`

**Funcionalidades:**
- Editor de Termos de Uso (markdown ou rich-text simples)
- Editor de Política de Privacidade
- **Versionamento:** ao salvar, cria nova versão na tabela
- E-mail do DPO/Encarregado
- Relatório de quem aceitou qual versão
- Botão "forçar re-aceite" quando publica nova versão

**Decisões:**
- Versionamento numérico simples (v1, v2, v3...)
- Re-aceite força modal no próximo acesso de cada responsável
- Substitui as páginas estáticas atuais `app/termos/page.tsx` e `app/privacidade/page.tsx` por leitura do banco

**Arquivos esperados:** ~7 (1 migration, 2 server actions, 2 pages admin, 2 client editors)
**Testes esperados:** ~12

---

### 2.5 — Integrações · `/admin/configuracoes/integracoes`

**Spec:** seção 5.5
**Complexidade:** Média
**Migrations:** Não (flags já em `escola_configuracoes`)

**Funcionalidades:**
- Cards habilitar/desabilitar para cada integração:
  - **Activesoft** (URL + token + botão "testar conexão")
  - **CRM** (endpoint + token)
  - **Asaas Webhook** (status ativo/`interrupted` + botão "reativar")
  - **Google Analytics** (GA4 ID)
  - **Meta Pixel** (Pixel ID)
- Cada card: status (✓/✗), data do último teste, "testar conexão"

**Decisões:**
- Token Activesoft/CRM continua em env (decisão da Fundação)
- O card só toggle a flag no banco — credenciais permanecem no Vercel
- Botão "reativar Asaas Webhook" usa rota documentada na memória do projeto (PUT /v3/webhooks)

**Arquivos esperados:** ~6 (~3 server actions de teste de conexão, 1 page, 5 cards)
**Testes esperados:** ~10

---

### 2.6 — Loja Online · `/admin/configuracoes/loja-online`

**Spec:** seção 5.6
**Complexidade:** Média
**Migrations:** Não (campos já em `escola_configuracoes`)

**Funcionalidades:**
- **Modo manutenção** (loja fechada com mensagem custom)
- Horário de funcionamento da loja online (fora dele, mostra aviso)
- Categorias visíveis na home (drag-and-drop pra reordenar)
- Produtos em destaque (até 6 produtos selecionáveis)
- Layout da home: grid / lista
- Mostrar contador de estoque baixo? (sim/não)
- Texto do rodapé

**Decisões:**
- `app/(loja)/loja/page.tsx` precisa respeitar:
  - `modo_manutencao` → mostra página de manutenção
  - Horário fora de funcionamento → mostra aviso
  - Layout (grid/lista)
  - Mostrar estoque baixo
- Drag-and-drop precisa de uma biblioteca leve (`@dnd-kit/core`?) — ou implementar com botões "↑/↓"

**Arquivos esperados:** ~5 (1 server action, 1 page, 3 client components)
**Testes esperados:** ~10

---

## Fase 3 — Avançado / Opcional (2 módulos)

### 3.1 — Auditoria & Logs · `/admin/configuracoes/auditoria`

**Spec:** seção 6.1
**Complexidade:** Alta (toca todas as Server Actions sensíveis)
**Migrations:** Sim — tabela `auditoria_log` + cron de limpeza

**Funcionalidades:**
- Tabela `auditoria_log`: usuário, ação, módulo, valor antes, valor depois, timestamp, IP
- Tela com filtros: usuário, módulo, tipo, intervalo de datas
- Exportação CSV
- Retenção: 12 meses (cron diário)

**Trabalho transversal:**
- Helper `auditLog()` em `lib/auditoria/`
- **Adicionar `auditLog()` em todas as Server Actions sensíveis** já criadas (das Fases 1 e 2): alterar identidade, mudar papel, suspender, criar usuário, alterar config de pagamento, etc. Provavelmente ~25 actions a modificar.
- Cron de limpeza usando Supabase Edge Function ou pg_cron

**Arquivos esperados:** ~5 + edits em ~25 actions existentes
**Testes esperados:** ~10 (lógica do helper + alguns smoke tests de integração)

---

### 3.2 — Backup & Dados · `/admin/configuracoes/dados`

**Spec:** seção 6.2
**Complexidade:** Média (geração de CSV/ZIP)
**Migrations:** Não

**Funcionalidades:**
- Exportar pedidos (CSV/Excel, com filtros)
- Exportar alunos (CSV — confirmação dupla)
- Exportar responsáveis (CSV — confirmação dupla)
- **LGPD — exclusão:** input CPF → preview → confirmação por senha → soft delete + log
- **LGPD — portabilidade:** input CPF → ZIP com tudo

**Decisões:**
- CSV gerado server-side e baixado via Response com Content-Disposition
- ZIP gerado com `jszip` (lib leve)
- Soft delete = marcar `excluido_em` em `responsaveis` (já existe)
- Anonymize PII em `pedidos`/`pedido_itens` (mantém histórico financeiro mas remove identificação)

**Arquivos esperados:** ~6 (4 server actions, 1 page, 1 modal de confirmação)
**Testes esperados:** ~12

---

## Estatísticas previstas (após Fases 2 + 3)

| | Fase 1 (atual) | + Fase 2 | + Fase 3 | Total |
|---|---|---|---|---|
| Testes | 92 | +62 | +22 | ~176 |
| Migrations | 9 | +3 | +1 | 13 |
| Server Actions | ~12 | +12 | +6 | ~30 |
| Páginas admin | 6 | +6 | +2 | 14 |
| Tabelas novas | 4 | +2 | +1 | 7 |

---

## Ordem recomendada de execução

Critério: dependências, valor entregue, complexidade.

**Próximo (curto prazo):**
1. **2.6 Loja Online** — alta visibilidade pro responsável final, complexidade média, sem migration. Bom pra "matar a vontade" de personalização.
2. **2.3 Checkout** — pequeno e rápido, fecha config básica de venda.
3. **2.2 Cantina** — depende do projeto ter cantina ativa em alguma escola.

**Médio prazo:**
4. **2.1 E-mails** — Alta complexidade, mas alto impacto (escola passa a controlar comunicação)
5. **2.4 Termos & LGPD** — Importante pra compliance
6. **2.5 Integrações** — Depende do uso real de Activesoft/CRM

**Longo prazo (opcional):**
7. **3.1 Auditoria** — Importante pra escolas grandes; trabalhoso (toca várias actions)
8. **3.2 Backup & LGPD** — Útil mas raramente usado no dia-a-dia

---

## Observações estratégicas

### O que pode ser cortado / postergado indefinidamente
- **Auditoria (3.1)**: Se você não tem requisito de compliance nem múltiplas escolas, deixe pra depois.
- **Backup & Dados (3.2)**: Pode ser substituído por exports manuais via SQL Editor enquanto a base é pequena.
- **Templates de e-mail editáveis (2.1)**: Pode começar com templates hard-coded melhorados, e só implementar editor quando uma escola pedir.

### O que é realmente essencial pra próximas escolas
- **Modo manutenção** (parte de 2.6) — pra fazer maintenance sem desligar a loja
- **Horário de funcionamento** (parte de 2.6) — pra fechar pedidos fora de hora
- **Termo padrão de compra** (parte de 2.3) — proteção legal básica
- **Integrações Activesoft** (parte de 2.5) — pra escolas que usam SIGAWeb

### Sugestão: "Slim Fase 2"
Se quiser entregar mais rápido sem fazer todos os 6 módulos da Fase 2, considere fazer só:
- **2.6 Loja Online** (modo manutenção + horário + layout)
- **2.3 Checkout** (termo + msg pós-compra + multi-aluno)
- Pular 2.1, 2.2, 2.4, 2.5 até demanda real

Isso entrega ~70% do valor da Fase 2 com ~30% do esforço.

---

## Como decidir o que fazer agora

Me responda 3 perguntas:

1. **Já tem alguma escola usando em produção** (ou prestes a usar)? Se sim, quais módulos da Fase 2 são bloqueadores reais?
2. **Tem cantina ativa em alguma escola**? Determina se 2.2 vale priorizar.
3. **Tem requisito de auditoria/compliance** (LGPD, contrato com cliente exigindo log)? Determina se 3.1 vai virar prioridade.

Com base nas respostas, posso propor uma ordem ajustada.
