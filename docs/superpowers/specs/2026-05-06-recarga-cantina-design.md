# Recarga da Cantina com Pagamento Real — Design

**Goal:** Substituir a recarga fictícia da cantina por um fluxo PIX real via Asaas, com página de aguardando e crédito automático via webhook + Supabase Realtime.

**Contexto:** A `iniciarRecargaAction` atual credita saldo diretamente sem nenhum pagamento — qualquer responsável autenticado pode recarregar de graça. Este spec corrige esse bug crítico de segurança.

---

## Fluxo Completo

```
Pai escolhe valor na tela de recarga
        ↓
iniciarRecargaAction (server action)
  → valida sessão + vínculo responsável↔aluno
  → verifica carteira não está bloqueada
  → cria cobrança PIX no Asaas
  → insere cantina_recargas (status: 'aguardando')
  → retorna { recarga_id, pix_qr_code, pix_qr_code_imagem, pix_expiracao }
        ↓
RecargaClient redireciona para:
  /cantina/[aluno_id]/recarga/[recarga_id]
        ↓
AguardandoClient (Supabase Realtime)
  → exibe QR Code + copia-e-cola + countdown
  → escuta UPDATE em cantina_recargas WHERE id = recarga_id
        ↓
Pai paga no app do banco
        ↓
Asaas → POST /api/webhook/asaas
  → detecta externalReference = "recarga:{recarga_id}"
  → chama RPC confirmar_recarga(recarga_id)
      → credita saldo via creditar_saldo_cantina (atômico)
      → atualiza status = 'confirmada'
        ↓
Realtime notifica o browser
  → exibe tela de sucesso ✅
  → redireciona para /cantina/[aluno_id]/extrato após 3s
```

---

## Banco de Dados

### Tabela `cantina_recargas`

```sql
id               uuid PRIMARY KEY DEFAULT gen_random_uuid()
carteira_id      uuid NOT NULL REFERENCES cantina_carteiras(id)
responsavel_id   uuid NOT NULL REFERENCES responsaveis(id)
valor            numeric(10,2) NOT NULL CHECK (valor >= 5 AND valor <= 2000)
status           text NOT NULL DEFAULT 'aguardando'
                 CHECK (status IN ('aguardando','confirmada','expirada','falhou'))
gateway_id       text              -- ID do pagamento no Asaas
pix_qr_code      text              -- texto copia-e-cola
pix_qr_code_imagem text            -- base64 data URL
pix_expiracao    timestamptz
created_at       timestamptz NOT NULL DEFAULT now()
confirmada_em    timestamptz
```

- `REPLICA IDENTITY FULL` habilitado para Supabase Realtime funcionar em UPDATEs.
- RLS: responsável só lê suas próprias recargas (`responsavel_id = auth.uid()`).

### RPC `confirmar_recarga(p_recarga_id uuid)`

Roda dentro de uma transaction:
1. `SELECT ... FOR UPDATE` na recarga — garante exclusividade
2. Valida `status = 'aguardando'` — idempotência: se já `confirmada`, retorna `ok: true` sem creditar
3. Chama `creditar_saldo_cantina(carteira_id, valor, ...)`
4. `UPDATE cantina_recargas SET status = 'confirmada', confirmada_em = now()`
5. Retorna `{ ok: boolean, erro?: text }`

---

## Arquivos

### Novos
| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/20260506_cantina_recargas.sql` | Cria tabela + RPC + RLS + Realtime |
| `app/(loja)/cantina/[aluno_id]/recarga/[recarga_id]/page.tsx` | Server component: valida ownership, busca recarga, passa props |
| `app/(loja)/cantina/[aluno_id]/recarga/[recarga_id]/AguardandoClient.tsx` | Client component: QR Code, countdown, Realtime, estados |

### Modificados
| Arquivo | O que muda |
|---|---|
| `app/actions/cantina.ts` | `iniciarRecargaAction` → cria PIX + insere recarga. Adiciona `renovarRecargaAction` |
| `app/(loja)/cantina/[aluno_id]/recarga/RecargaClient.tsx` | Redireciona para `[recarga_id]` em vez de `/extrato` |
| `app/api/webhook/asaas/route.ts` | Detecta prefixo `recarga:` no `externalReference` e chama `confirmar_recarga` |

---

## Segurança

- **Autenticação:** todas as server actions e a página `[recarga_id]` verificam sessão e vínculo responsável↔aluno.
- **Ownership:** página `[recarga_id]` valida no servidor que `recarga.responsavel_id = user.id`. URL adivinhada retorna `notFound()`.
- **Idempotência do webhook:** RPC usa `SELECT FOR UPDATE` + check de status — dois webhooks simultâneos não creditam duas vezes.
- **Renovação:** `renovarRecargaAction` só aceita recargas `aguardando` com `pix_expiracao < now()`, pertencentes ao usuário autenticado.
- **Carteira bloqueada:** `creditar_saldo_cantina` já bloqueia crédito em carteiras inativas — a RPC não precisa verificar novamente.

---

## UX — Estados da Página de Aguardando

### Estado 1: Aguardando pagamento (inicial)
- QR Code 220×220
- Texto copia-e-cola com botão "Copiar" (feedback "Copiado! ✓" por 2s)
- Countdown `MM:SS` atualizado por `setInterval` a cada segundo
- Valor da recarga

### Estado 2: Confirmado
- Ícone ✅ + "Saldo creditado!"
- Mensagem: "R$ X,XX adicionados ao saldo de [nome]"
- "Redirecionando em 3s..." → `router.push(/cantina/[aluno_id]/extrato)`

### Estado 3: PIX expirado
- Ícone ⏰ + "PIX expirado"
- Botão "Gerar novo PIX" → chama `renovarRecargaAction` → atualiza QR Code no mesmo registro → volta ao Estado 1

### Fallback de Realtime
- Se conexão Realtime cair: exibe link "Verificar pagamento" que faz `router.refresh()`

---

## Tratamento de Erros

| Situação | Comportamento |
|---|---|
| Asaas fora do ar ao criar PIX | `iniciarRecargaAction` retorna `{ error }`, nenhum registro criado |
| Webhook chega duplicado | RPC ignora silenciosamente (status já `confirmada`) |
| Carteira bloqueada ao criar recarga | Action retorna erro antes de chamar Asaas |
| Renovação com PIX ainda válido | `renovarRecargaAction` retorna erro "PIX ainda não expirou" |
| Valor fora do intervalo [5, 2000] | Validação no client + check no banco (CHECK constraint) |

---

## Fora de Escopo

- Boleto e cartão para recarga (apenas PIX nesta versão)
- Notificação por email/WhatsApp ao confirmar recarga
- Estorno/reembolso de recarga
- Relatório de recargas no painel admin (pode vir em iteração futura)
