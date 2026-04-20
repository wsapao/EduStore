-- ─────────────────────────────────────────────────────────────────────────────
-- LGPD — permite anonimizar responsáveis sem apagar histórico fiscal.
-- ─────────────────────────────────────────────────────────────────────────────
-- Adiciona colunas `ativo` e `excluido_em` em `responsaveis`.
-- Ao exercer o direito de eliminação (art. 18, VI da LGPD), o backend:
--   1) sobrescreve PII (nome, email, cpf, telefone) com valores anonimizados;
--   2) define ativo=false e excluido_em=now();
--   3) remove o usuário de auth.users (invalida sessão).
-- Pedidos, ingressos e movimentações de cantina permanecem vinculados para
-- cumprir prazos fiscais e contábeis.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.responsaveis
  add column if not exists ativo boolean not null default true,
  add column if not exists excluido_em timestamptz null;

create index if not exists idx_responsaveis_ativo on public.responsaveis(ativo);

-- Opcional: RLS para impedir login/consulta de contas inativas em rotas públicas.
-- Ajustar conforme policies existentes do projeto.
comment on column public.responsaveis.ativo is
  'false = conta desativada ou anonimizada via LGPD; não deve ser usada em novos fluxos.';
comment on column public.responsaveis.excluido_em is
  'Timestamp da anonimização via exclusão de conta (LGPD art. 18, VI).';
