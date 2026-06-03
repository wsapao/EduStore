# Edição de responsável pelo admin (com sincronia do e-mail de login)

**Data:** 2026-06-03
**Status:** Aprovado para planejamento

## Problema

Uma responsável se cadastrou na loja digitando o e-mail errado. Como o e-mail
errado é também o e-mail de login (`auth.users`), ela:

- não consegue logar (usa o e-mail correto, que nunca foi cadastrado → "senha incorreta");
- não consegue recuperar a senha (o link vai para o e-mail errado, que ela não controla).

O admin foi contatado para corrigir, mas **a tela de responsáveis hoje é somente
leitura** — não há como editar os dados de um usuário. Resultado: a única saída
seria mexer no banco na mão.

Causa raiz do impasse operacional: falta uma capacidade de administração para
corrigir o contato de um responsável, incluindo o e-mail de login.

> **Escopo desta entrega:** dar ao admin o poder de corrigir o contato com
> segurança e auditoria. Esta entrega **não** previne o erro de digitação no
> cadastro (confirmação de e-mail no signup fica para uma entrega futura, se
> desejado) — ela torna o erro **corrigível** sem depender do suporte/banco.

## Objetivo

Permitir que um admin com a permissão `responsaveis.editar` edite **nome,
e-mail e telefone** de um responsável pela interface, mantendo o e-mail de
login (`auth.users`) em sincronia com `public.responsaveis`, com auditoria e
aviso de segurança por e-mail.

Fora de escopo: edição de CPF (único/identificador, somente leitura),
ativação/exclusão de conta (já coberto por outros fluxos: LGPD/soft-delete),
confirmação de e-mail no cadastro.

## Contexto do código existente (reuso)

A maior parte da infraestrutura já existe:

| Recurso | Onde | Uso |
|---|---|---|
| Permissão `responsaveis.editar` | `lib/permissoes/keys.ts` | já definida, ainda não usada |
| Checagem de permissão | `lib/permissoes/getUserPermissions.ts` → `getUserPermissions(supabase): string[]` | gate da action |
| Cliente service role | `lib/supabase/admin.ts` → `createAdminClient()` | Admin API do Auth |
| Troca de e-mail no Auth | padrão já usado em `app/actions/lgpd.ts` (`admin.auth.admin.updateUserById` / `deleteUser`) | copiar padrão |
| Auditoria | `lib/auditoria/log.ts` → `auditLog({ modulo, acao, descricao, metadata })` | resolve user/escola/IP sozinho |
| Envio de e-mail (Resend) | `lib/email/send.ts` (`enviarEmailPedido`, `enviarEmailIngresso`, `enviarEmailResetSenhaAdmin`, ...) + `lib/email/templates*.ts` | aviso de troca |
| Tela de responsáveis | `app/(admin)/admin/responsaveis/page.tsx` (hoje só leitura: lista, busca, export CSV) | onde a edição entra |
| Padrão de escola do admin | `app/actions/admin.ts` (`responsaveis.select('escola_id').eq('id', user.id).single()`) | isolamento por escola |

## Arquitetura

Segue o padrão da casa: **Next.js Server Action** usando o cliente service
role. Não há Supabase Edge Functions no projeto; a Admin API do Auth é chamada
a partir do servidor Next via `createAdminClient()`.

### Componentes

1. **Server Action `editarResponsavelAction(responsavelId, formData)`**
   (novo arquivo `app/actions/responsaveis.ts`, ou dentro de `app/actions/admin.ts`
   seguindo o padrão existente).

2. **UI de edição** na tela `app/(admin)/admin/responsaveis/page.tsx`: botão
   "Editar" por linha → modal/form com nome, e-mail e telefone editáveis; CPF
   somente leitura. Feedback via `sonner`. Botão visível só com a permissão.

3. **Aviso de troca de e-mail** (novo): função em `lib/email/send.ts`
   (ex.: `enviarEmailAvisoTrocaEmail`) + template, seguindo o padrão de
   `templates.ts` / `templates-config.ts`.

### Fluxo da action

```
1. Autentica (createClient/server) e carrega permissões → exige 'responsaveis.editar'.
2. Resolve escola_id do admin (responsaveis.escola_id por user.id).
3. Carrega o responsável-alvo; valida:
   - pertence à mesma escola_id (isolamento multi-tenant);
   - excluido_em IS NULL (bloqueia edição de conta removida).
4. Valida input: nome não vazio; e-mail bem formado; telefone opcional.
5. Se e-mail mudou: checa duplicidade (responsaveis + auth.users, exceto a própria conta).
6. UPDATE em public.responsaveis (nome, telefone, email) via createAdminClient().
7. Se e-mail mudou:
   admin.auth.admin.updateUserById(responsavelId, { email, email_confirm: true }).
   - Falhou? REVERTE o UPDATE de responsaveis (email/nome/telefone anteriores) e retorna erro.
8. auditLog({ modulo: 'responsaveis', acao: 'editar',
             descricao, metadata: { de: {...}, para: {...} } }).
9. Se e-mail mudou: dispara aviso (best-effort) para o e-mail ANTIGO e o NOVO.
10. revalidatePath('/admin/responsaveis'); retorna { success: true }.
```

### Dados

- `public.responsaveis`: `id` (= `auth.users.id`), `nome`, `email`, `cpf`
  (único, read-only nesta feature), `telefone`, `escola_id`, `ativo`,
  `excluido_em`.
- `auth.users`: e-mail de login — alterado **somente** via Admin API com
  `email_confirm: true` (troca imediata e já confirmada; a responsável não
  precisa clicar em nenhum link para destravar).
- Sincronia: a fonte de verdade do e-mail passa a ser atualizada nos dois
  lugares na mesma action; um nunca fica sem o outro (rollback no passo 7).

## Tratamento de erros e casos de borda

- **E-mail novo já em uso** (em `responsaveis` ou `auth.users`): rejeita com
  mensagem clara antes de chamar a Admin API.
- **Só nome/telefone mudaram** (e-mail igual): pula a Admin API; atualiza só
  `responsaveis`.
- **Conta removida** (`excluido_em` preenchido): bloqueia.
- **Sem permissão / escola diferente**: "Acesso negado." (padrão das actions).
- **Falha parcial** (responsaveis ok, Auth falha): rollback do `responsaveis`
  para nunca divergir de `auth.users`.
- **Falha no e-mail de aviso**: best-effort — não derruba a operação (igual ao
  padrão de `auditLog`); apenas loga.

## Segurança

- Action server-side com service role apenas (alinha com o hardening já
  adotado: RPCs SECURITY DEFINER e EXECUTE revogado de anon/authenticated).
- Gate por permissão `responsaveis.editar` + isolamento por `escola_id`.
- Toda alteração gravada em `auditoria_log` (de→para, user admin, IP).
- Aviso de segurança para o e-mail antigo e o novo mitiga troca indevida.

## Testes (Vitest)

- Permissão negada → erro, nenhuma escrita.
- Escola diferente → erro, nenhuma escrita.
- E-mail duplicado → erro antes da Admin API.
- Caminho feliz com troca de e-mail → atualiza `responsaveis` + chama
  `updateUserById({ email_confirm: true })` + 1 linha de auditoria + 2 avisos.
- Caminho "e-mail inalterado" → **não** chama a Admin API.
- Falha simulada na Admin API → `responsaveis` revertido ao estado anterior.

## Caso urgente (a responsável atual)

Assim que a action existir, usá-la para corrigir a conta da responsável (troca
+ já confirmada), sem tocar no banco manualmente. Se for preciso destravar
antes de a feature ficar pronta, fazer a correção pontual via Supabase (Admin
API), com confirmação do admin sobre qual conta e qual e-mail correto.
