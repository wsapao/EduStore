-- Loja RLS — fecha os 2 residuais do papel-misto (PR #39). JÁ APLICADO no rsts em 21/07.
-- Regressão verificada: admin acesso total (278 pedidos/360 alunos), comprador só o próprio, anon sem erro.

-- 1) responsavel_aluno: escopar por unidade ativa SEM recursão.
-- Um EXISTS direto em alunos causaria recursão mútua (alunos_do_responsavel lê responsavel_aluno).
-- loja_escola_do_aluno é SECURITY DEFINER → lê alunos bypassando RLS → sem recursão.
create or replace function public.loja_escola_do_aluno(p_aluno uuid)
returns uuid language sql stable security definer set search_path to 'public'
as $$ select escola_id from public.alunos where id = p_aluno; $$;

revoke execute on function public.loja_escola_do_aluno(uuid) from public, anon;
grant execute on function public.loja_escola_do_aluno(uuid) to authenticated, service_role;

alter policy responsavel_aluno_staff_select on public.responsavel_aluno
  using ((public.tem_permissao('alunos.ver') or public.tem_permissao('responsaveis.ver'))
         and (select public.loja_escola_do_aluno(responsavel_aluno.aluno_id)) = public.loja_escola_ativa());

-- 2) tem_permissao passa a checar a permissão NO PAPEL DA UNIDADE ATIVA (não em qualquer papel).
-- Regressão zero p/ single-tenant (a única unidade é a ativa). Recursion-safe (loja_escola_ativa é SDF).
create or replace function public.tem_permissao(p_chave text)
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1
    from public.usuario_papel up
    join public.papel_permissoes pp on pp.papel_id = up.papel_id
    where up.user_id = auth.uid()
      and up.suspenso = false
      and pp.chave = p_chave
      and up.escola_id = public.loja_escola_ativa()
  );
$$;
