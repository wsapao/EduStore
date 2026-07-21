-- Seletor de Unidade F3 (Loja) — FOUNDATION (aditivo, NÃO altera policy existente).
-- spec: Planejamento SaaS/design-seletor-unidade-multi-unidade.md; plano F3.
-- A escola ativa do staff passa a ser resolvível no RLS (loja_escola_ativa) e o papel
-- por unidade ativa (loja_tem_papel_na_ativa) — usados pelo rewrite das policies (T3).

-- 1) Unidade ativa por conta (staff)
create table if not exists public.saas_unidade_ativa (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  escola_id  uuid not null references public.escolas(id) on delete cascade,
  updated_at timestamptz not null default now()
);

-- 2) Escola ativa do staff: seleção válida (vínculo não-suspenso na escola escolhida)
--    senão o vínculo mais antigo (created_at, id) → espelha o comportamento atual
--    (getEscolaIdParaAdmin pegava 1 vínculo; single-tenant resolve para a mesma escola).
create or replace function public.loja_escola_ativa()
returns uuid
language sql stable security definer set search_path to 'public'
as $$
  select coalesce(
    (select ua.escola_id
       from public.saas_unidade_ativa ua
       join public.usuario_papel up
         on up.user_id = ua.user_id and up.escola_id = ua.escola_id and up.suspenso = false
      where ua.user_id = auth.uid()
      limit 1),
    (select up.escola_id
       from public.usuario_papel up
      where up.user_id = auth.uid() and up.suspenso = false
      order by up.created_at asc, up.id asc
      limit 1)
  );
$$;

-- 3) O usuário tem, NA ESCOLA ATIVA, um papel cujo preset está na lista?
--    Substitui o check `app_metadata.role in (...)` (escalar único) por papel-por-unidade.
create or replace function public.loja_tem_papel_na_ativa(v_presets text[])
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1
    from public.usuario_papel up
    join public.papeis p on p.id = up.papel_id
    where up.user_id = auth.uid()
      and up.suspenso = false
      and up.escola_id = (select public.loja_escola_ativa())
      and p.chave_preset = any (v_presets)
  );
$$;

-- 4) RLS da tabela de seleção (self; só escola com vínculo não-suspenso)
alter table public.saas_unidade_ativa enable row level security;
drop policy if exists saas_unidade_ativa_self on public.saas_unidade_ativa;
create policy saas_unidade_ativa_self on public.saas_unidade_ativa
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and escola_id in (
      select up.escola_id from public.usuario_papel up
      where up.user_id = auth.uid() and up.suspenso = false
    )
  );

-- 5) Policy ADITIVA de SELECT em escolas: staff lê as escolas às quais está vinculado
--    (p/ o seletor listar as unidades). OR-combina com as policies existentes.
drop policy if exists escolas_select_vinculadas on public.escolas;
create policy escolas_select_vinculadas on public.escolas
  for select to authenticated
  using (
    id in (
      select up.escola_id from public.usuario_papel up
      where up.user_id = auth.uid() and up.suspenso = false
    )
  );

-- 6) Hardening (rsts é projeto padrão: default ACL dá EXECUTE a public/anon)
revoke all on table public.saas_unidade_ativa from public, anon;
grant select, insert, update, delete on table public.saas_unidade_ativa to authenticated;
grant all on table public.saas_unidade_ativa to service_role;

revoke execute on function public.loja_escola_ativa() from public, anon;
grant execute on function public.loja_escola_ativa() to authenticated, service_role;
revoke execute on function public.loja_tem_papel_na_ativa(text[]) from public, anon;
grant execute on function public.loja_tem_papel_na_ativa(text[]) to authenticated, service_role;
