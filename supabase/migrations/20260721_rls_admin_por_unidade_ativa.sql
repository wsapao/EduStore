-- Seletor de Unidade F3 (Loja) — T3: escopar as 19 policies de admin por UNIDADE ATIVA
-- e resolver o papel POR unidade (loja_tem_papel_na_ativa), não pelo escalar app_metadata.role.
-- Substitui `app_metadata.role='admin'` (sem filtro de escola) por
--   escola_id = loja_escola_ativa() AND loja_tem_papel_na_ativa(array[...])
-- Corrige de passagem a exposição pré-existente (admin tinha acesso RLS a TODAS as escolas).
-- loja_escola_ativa()/loja_tem_papel_na_ativa() são STABLE + no-arg/const-arg → avaliadas 1x por query.
-- Regressão single-tenant: loja_escola_ativa()=sua escola, loja_tem_papel_na_ativa(['admin'])=true → mesmo acesso.

-- ============ escola_id DIRETO ============
alter policy auditoria_log_admin_select on public.auditoria_log
  using (escola_id = public.loja_escola_ativa() and public.loja_tem_papel_na_ativa(array['admin']));

alter policy email_templates_admin_rw on public.email_templates
  using (escola_id = public.loja_escola_ativa() and public.loja_tem_papel_na_ativa(array['admin']))
  with check (escola_id = public.loja_escola_ativa() and public.loja_tem_papel_na_ativa(array['admin']));

alter policy escola_configuracoes_admin_rw on public.escola_configuracoes
  using (escola_id = public.loja_escola_ativa() and public.loja_tem_papel_na_ativa(array['admin']))
  with check (escola_id = public.loja_escola_ativa() and public.loja_tem_papel_na_ativa(array['admin']));

alter policy papeis_admin_rw on public.papeis
  using (escola_id = public.loja_escola_ativa() and public.loja_tem_papel_na_ativa(array['admin']))
  with check (escola_id = public.loja_escola_ativa() and public.loja_tem_papel_na_ativa(array['admin']));

alter policy termos_versoes_admin_rw on public.termos_versoes
  using (escola_id = public.loja_escola_ativa() and public.loja_tem_papel_na_ativa(array['admin']))
  with check (escola_id = public.loja_escola_ativa() and public.loja_tem_papel_na_ativa(array['admin']));

alter policy usuario_papel_admin_all on public.usuario_papel
  using (escola_id = public.loja_escola_ativa() and public.loja_tem_papel_na_ativa(array['admin']))
  with check (escola_id = public.loja_escola_ativa() and public.loja_tem_papel_na_ativa(array['admin']));

-- cantina: admin OU operador
alter policy cantina_carteiras_admin_all on public.cantina_carteiras
  using (escola_id = public.loja_escola_ativa() and public.loja_tem_papel_na_ativa(array['admin','operador']))
  with check (escola_id = public.loja_escola_ativa() and public.loja_tem_papel_na_ativa(array['admin','operador']));

alter policy cantina_pedidos_admin_all on public.cantina_pedidos
  using (escola_id = public.loja_escola_ativa() and public.loja_tem_papel_na_ativa(array['admin','operador']))
  with check (escola_id = public.loja_escola_ativa() and public.loja_tem_papel_na_ativa(array['admin','operador']));

-- cantina_produtos: era (jwt->>role=admin) OR (app_metadata.role=admin) → admin
alter policy cantina_produtos_all_admin on public.cantina_produtos
  using (escola_id = public.loja_escola_ativa() and public.loja_tem_papel_na_ativa(array['admin']))
  with check (escola_id = public.loja_escola_ativa() and public.loja_tem_papel_na_ativa(array['admin']));

-- escolas: update por role → só a escola ativa
alter policy escolas_admin_update on public.escolas
  using (id = public.loja_escola_ativa() and public.loja_tem_papel_na_ativa(array['admin']))
  with check (id = public.loja_escola_ativa() and public.loja_tem_papel_na_ativa(array['admin']));

-- ============ Sem escola_id → EXISTS no pai ============
alter policy cantina_movimentacoes_admin_all on public.cantina_movimentacoes
  using (exists (select 1 from public.cantina_carteiras c
                 where c.id = cantina_movimentacoes.carteira_id and c.escola_id = public.loja_escola_ativa())
         and public.loja_tem_papel_na_ativa(array['admin','operador']))
  with check (exists (select 1 from public.cantina_carteiras c
                 where c.id = cantina_movimentacoes.carteira_id and c.escola_id = public.loja_escola_ativa())
         and public.loja_tem_papel_na_ativa(array['admin','operador']));

alter policy cantina_pedido_itens_admin_all on public.cantina_pedido_itens
  using (exists (select 1 from public.cantina_pedidos p
                 where p.id = cantina_pedido_itens.pedido_id and p.escola_id = public.loja_escola_ativa())
         and public.loja_tem_papel_na_ativa(array['admin','operador']))
  with check (exists (select 1 from public.cantina_pedidos p
                 where p.id = cantina_pedido_itens.pedido_id and p.escola_id = public.loja_escola_ativa())
         and public.loja_tem_papel_na_ativa(array['admin','operador']));

alter policy cantina_recargas_admin_all on public.cantina_recargas
  using (exists (select 1 from public.cantina_carteiras c
                 where c.id = cantina_recargas.carteira_id and c.escola_id = public.loja_escola_ativa())
         and public.loja_tem_papel_na_ativa(array['admin']))
  with check (exists (select 1 from public.cantina_carteiras c
                 where c.id = cantina_recargas.carteira_id and c.escola_id = public.loja_escola_ativa())
         and public.loja_tem_papel_na_ativa(array['admin']));

alter policy cantina_restricoes_admin_all on public.cantina_restricoes
  using (exists (select 1 from public.cantina_produtos pr
                 where pr.id = cantina_restricoes.produto_id and pr.escola_id = public.loja_escola_ativa())
         and public.loja_tem_papel_na_ativa(array['admin']))
  with check (exists (select 1 from public.cantina_produtos pr
                 where pr.id = cantina_restricoes.produto_id and pr.escola_id = public.loja_escola_ativa())
         and public.loja_tem_papel_na_ativa(array['admin']));

alter policy papel_permissoes_admin_rw on public.papel_permissoes
  using (exists (select 1 from public.papeis p
                 where p.id = papel_permissoes.papel_id and p.escola_id = public.loja_escola_ativa())
         and public.loja_tem_papel_na_ativa(array['admin']))
  with check (exists (select 1 from public.papeis p
                 where p.id = papel_permissoes.papel_id and p.escola_id = public.loja_escola_ativa())
         and public.loja_tem_papel_na_ativa(array['admin']));

alter policy pedido_estornos_admin_all on public.pedido_estornos
  using (exists (select 1 from public.pedidos p
                 where p.id = pedido_estornos.pedido_id and p.escola_id = public.loja_escola_ativa())
         and public.loja_tem_papel_na_ativa(array['admin']))
  with check (exists (select 1 from public.pedidos p
                 where p.id = pedido_estornos.pedido_id and p.escola_id = public.loja_escola_ativa())
         and public.loja_tem_papel_na_ativa(array['admin']));

-- 2 níveis: estorno_id → pedido_estornos → pedidos
alter policy pedido_estornos_itens_admin_all on public.pedido_estornos_itens
  using (exists (select 1 from public.pedido_estornos e join public.pedidos p on p.id = e.pedido_id
                 where e.id = pedido_estornos_itens.estorno_id and p.escola_id = public.loja_escola_ativa())
         and public.loja_tem_papel_na_ativa(array['admin']))
  with check (exists (select 1 from public.pedido_estornos e join public.pedidos p on p.id = e.pedido_id
                 where e.id = pedido_estornos_itens.estorno_id and p.escola_id = public.loja_escola_ativa())
         and public.loja_tem_papel_na_ativa(array['admin']));

-- ============ Já escopadas por união (todas minhas escolas) → apertar p/ = ativa ============
alter policy categorias_produto_admin_all on public.categorias_produto
  using (escola_id = public.loja_escola_ativa() and public.loja_tem_papel_na_ativa(array['admin']))
  with check (escola_id = public.loja_escola_ativa() and public.loja_tem_papel_na_ativa(array['admin']));

alter policy vouchers_admin_all on public.vouchers
  using (escola_id = public.loja_escola_ativa() and public.loja_tem_papel_na_ativa(array['admin']))
  with check (escola_id = public.loja_escola_ativa() and public.loja_tem_papel_na_ativa(array['admin']));

-- ============================================================================
-- COMPLETUDE (2ª rodada do review): is_admin() e tem_permissao() também eram
-- escalar-sem-escola. Escopar por unidade ativa nas tabelas sensíveis.
-- ============================================================================

-- ---- is_admin() → ESCRITA (admin_all_*) por unidade ativa + papel-na-ativa ----
alter policy admin_all_alunos on public.alunos
  to authenticated
  using (escola_id = public.loja_escola_ativa() and public.loja_tem_papel_na_ativa(array['admin']))
  with check (escola_id = public.loja_escola_ativa() and public.loja_tem_papel_na_ativa(array['admin']));

alter policy admin_all_pedidos on public.pedidos
  to authenticated
  using (escola_id = public.loja_escola_ativa() and public.loja_tem_papel_na_ativa(array['admin']))
  with check (escola_id = public.loja_escola_ativa() and public.loja_tem_papel_na_ativa(array['admin']));

alter policy admin_all_produtos on public.produtos
  to authenticated
  using (escola_id = public.loja_escola_ativa() and public.loja_tem_papel_na_ativa(array['admin']))
  with check (escola_id = public.loja_escola_ativa() and public.loja_tem_papel_na_ativa(array['admin']));

alter policy admin_all_responsaveis on public.responsaveis
  to authenticated
  using (escola_id = public.loja_escola_ativa() and public.loja_tem_papel_na_ativa(array['admin']))
  with check (escola_id = public.loja_escola_ativa() and public.loja_tem_papel_na_ativa(array['admin']));

-- filhas (sem escola_id) → EXISTS no pai
alter policy admin_all_itens_pedido on public.itens_pedido
  to authenticated
  using (exists (select 1 from public.pedidos p where p.id = itens_pedido.pedido_id and p.escola_id = public.loja_escola_ativa())
         and public.loja_tem_papel_na_ativa(array['admin']))
  with check (exists (select 1 from public.pedidos p where p.id = itens_pedido.pedido_id and p.escola_id = public.loja_escola_ativa())
         and public.loja_tem_papel_na_ativa(array['admin']));

alter policy admin_all_pagamentos on public.pagamentos
  to authenticated
  using (exists (select 1 from public.pedidos p where p.id = pagamentos.pedido_id and p.escola_id = public.loja_escola_ativa())
         and public.loja_tem_papel_na_ativa(array['admin']))
  with check (exists (select 1 from public.pedidos p where p.id = pagamentos.pedido_id and p.escola_id = public.loja_escola_ativa())
         and public.loja_tem_papel_na_ativa(array['admin']));

alter policy admin_all_produto_variantes on public.produto_variantes
  to authenticated
  using (exists (select 1 from public.produtos pr where pr.id = produto_variantes.produto_id and pr.escola_id = public.loja_escola_ativa())
         and public.loja_tem_papel_na_ativa(array['admin']))
  with check (exists (select 1 from public.produtos pr where pr.id = produto_variantes.produto_id and pr.escola_id = public.loja_escola_ativa())
         and public.loja_tem_papel_na_ativa(array['admin']));

-- ingressos: escopar pelo produto (evento) do ingresso
alter policy admin_all_ingressos on public.ingressos
  to authenticated
  using (exists (select 1 from public.produtos pr where pr.id = ingressos.produto_id and pr.escola_id = public.loja_escola_ativa())
         and public.loja_tem_papel_na_ativa(array['admin']))
  with check (exists (select 1 from public.produtos pr where pr.id = ingressos.produto_id and pr.escola_id = public.loja_escola_ativa())
         and public.loja_tem_papel_na_ativa(array['admin']));

-- ---- tem_permissao() → LEITURA staff (*_staff_select): + escopo de unidade ativa ----
-- (mantém a checagem de permissão; adiciona confinamento de dados à unidade ativa)
alter policy alunos_staff_select on public.alunos
  using (public.tem_permissao('alunos.ver') and escola_id = public.loja_escola_ativa());

alter policy pedidos_staff_select on public.pedidos
  using (public.tem_permissao('pedidos.ver') and escola_id = public.loja_escola_ativa());

alter policy produtos_staff_select on public.produtos
  using (public.tem_permissao('produtos.ver') and escola_id = public.loja_escola_ativa());

alter policy responsaveis_staff_select on public.responsaveis
  using (public.tem_permissao('responsaveis.ver') and escola_id = public.loja_escola_ativa());

alter policy escola_configuracoes_staff_select on public.escola_configuracoes
  using (public.tem_permissao('configuracoes.ver') and escola_id = public.loja_escola_ativa());

alter policy vouchers_staff_select on public.vouchers
  using (public.tem_permissao('vouchers.ver') and escola_id = public.loja_escola_ativa());

-- filhas de leitura → EXISTS no pai
alter policy itens_pedido_staff_select on public.itens_pedido
  using (public.tem_permissao('pedidos.ver')
         and exists (select 1 from public.pedidos p where p.id = itens_pedido.pedido_id and p.escola_id = public.loja_escola_ativa()));

alter policy pagamentos_staff_select on public.pagamentos
  using (public.tem_permissao('pagamentos.ver')
         and exists (select 1 from public.pedidos p where p.id = pagamentos.pedido_id and p.escola_id = public.loja_escola_ativa()));

alter policy pedido_estornos_staff_select on public.pedido_estornos
  using (public.tem_permissao('pedidos.ver')
         and exists (select 1 from public.pedidos p where p.id = pedido_estornos.pedido_id and p.escola_id = public.loja_escola_ativa()));

alter policy pedido_estornos_itens_staff_select on public.pedido_estornos_itens
  using (public.tem_permissao('pedidos.ver')
         and exists (select 1 from public.pedido_estornos e join public.pedidos p on p.id = e.pedido_id
                     where e.id = pedido_estornos_itens.estorno_id and p.escola_id = public.loja_escola_ativa()));

alter policy produto_variantes_staff_select on public.produto_variantes
  using (public.tem_permissao('produtos.ver')
         and exists (select 1 from public.produtos pr where pr.id = produto_variantes.produto_id and pr.escola_id = public.loja_escola_ativa()));

-- responsavel_aluno_staff_select: NÃO escopado por escola aqui de propósito.
-- Um EXISTS em alunos causaria RECURSÃO mútua de RLS (alunos_do_responsavel lê
-- responsavel_aluno; esta policy leria alunos → 42P17). Mantido no original.
-- Para escopar por unidade numa 2ª unidade: usar função SECURITY DEFINER que
-- retorne a escola do aluno (bypass RLS), não um EXISTS em alunos.
alter policy responsavel_aluno_staff_select on public.responsavel_aluno
  using (public.tem_permissao('alunos.ver') or public.tem_permissao('responsaveis.ver'));
