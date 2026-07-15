-- Leitura do painel por permissão de papel, não só role=admin no JWT.
--
-- Contexto: os guards das páginas /admin passaram a usar papel_permissoes
-- (podeAcessarAdmin/currentPermissions), mas as policies de SELECT das
-- tabelas centrais ainda exigiam is_admin() — papéis como Financeiro
-- entravam nas páginas e viam listas vazias. Estas policies são ADITIVAS
-- e somente de SELECT; escrita continua como estava (is_admin/service role).

create or replace function public.tem_permissao(p_chave text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuario_papel up
    join public.papel_permissoes pp on pp.papel_id = up.papel_id
    where up.user_id = auth.uid()
      and up.suspenso = false
      and pp.chave = p_chave
  );
$$;

revoke execute on function public.tem_permissao(text) from public;
grant execute on function public.tem_permissao(text) to authenticated;

-- Pedidos e satélites
drop policy if exists pedidos_staff_select on public.pedidos;
create policy pedidos_staff_select on public.pedidos
  for select to authenticated using (public.tem_permissao('pedidos.ver'));

drop policy if exists itens_pedido_staff_select on public.itens_pedido;
create policy itens_pedido_staff_select on public.itens_pedido
  for select to authenticated using (public.tem_permissao('pedidos.ver'));

drop policy if exists pagamentos_staff_select on public.pagamentos;
create policy pagamentos_staff_select on public.pagamentos
  for select to authenticated using (public.tem_permissao('pagamentos.ver'));

drop policy if exists pedido_estornos_staff_select on public.pedido_estornos;
create policy pedido_estornos_staff_select on public.pedido_estornos
  for select to authenticated using (public.tem_permissao('pedidos.ver'));

drop policy if exists pedido_estornos_itens_staff_select on public.pedido_estornos_itens;
create policy pedido_estornos_itens_staff_select on public.pedido_estornos_itens
  for select to authenticated using (public.tem_permissao('pedidos.ver'));

-- Alunos e responsáveis
drop policy if exists alunos_staff_select on public.alunos;
create policy alunos_staff_select on public.alunos
  for select to authenticated using (public.tem_permissao('alunos.ver'));

drop policy if exists responsaveis_staff_select on public.responsaveis;
create policy responsaveis_staff_select on public.responsaveis
  for select to authenticated using (public.tem_permissao('responsaveis.ver'));

drop policy if exists responsavel_aluno_staff_select on public.responsavel_aluno;
create policy responsavel_aluno_staff_select on public.responsavel_aluno
  for select to authenticated
  using (public.tem_permissao('alunos.ver') or public.tem_permissao('responsaveis.ver'));

-- Catálogo
drop policy if exists produtos_staff_select on public.produtos;
create policy produtos_staff_select on public.produtos
  for select to authenticated using (public.tem_permissao('produtos.ver'));

drop policy if exists produto_variantes_staff_select on public.produto_variantes;
create policy produto_variantes_staff_select on public.produto_variantes
  for select to authenticated using (public.tem_permissao('produtos.ver'));

-- Vouchers e configurações
drop policy if exists vouchers_staff_select on public.vouchers;
create policy vouchers_staff_select on public.vouchers
  for select to authenticated using (public.tem_permissao('vouchers.ver'));

drop policy if exists escola_configuracoes_staff_select on public.escola_configuracoes;
create policy escola_configuracoes_staff_select on public.escola_configuracoes
  for select to authenticated using (public.tem_permissao('configuracoes.ver'));
