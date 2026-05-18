-- ============================================================
-- Otimiza 47 políticas RLS pra cachear o resultado de auth.uid()
-- e auth.jwt() por query em vez de reavaliar por linha.
-- A lógica de cada policy é idêntica; só envolvemos a chamada
-- em (select ...) conforme recomendado:
-- https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- ============================================================

ALTER POLICY "alunos_do_responsavel" ON alunos
  USING (id IN (SELECT responsavel_aluno.aluno_id FROM responsavel_aluno WHERE responsavel_aluno.responsavel_id = (select auth.uid())));
ALTER POLICY "responsavel_read_aluno" ON alunos
  USING (id IN (SELECT responsavel_aluno.aluno_id FROM responsavel_aluno WHERE responsavel_aluno.responsavel_id = (select auth.uid())));
ALTER POLICY "responsavel_update_aluno" ON alunos
  USING (id IN (SELECT responsavel_aluno.aluno_id FROM responsavel_aluno WHERE responsavel_aluno.responsavel_id = (select auth.uid())));

ALTER POLICY "auditoria_log_admin_select" ON auditoria_log
  USING ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text);

ALTER POLICY "cantina_carteiras_admin_all" ON cantina_carteiras
  USING (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text) OR ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'operador'::text));
ALTER POLICY "cantina_carteiras_responsavel_select" ON cantina_carteiras
  USING (aluno_id IN (SELECT ra.aluno_id FROM responsavel_aluno ra WHERE ra.responsavel_id = (select auth.uid())));

ALTER POLICY "cantina_movimentacoes_admin_all" ON cantina_movimentacoes
  USING (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text) OR ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'operador'::text));
ALTER POLICY "cantina_movimentacoes_responsavel_select" ON cantina_movimentacoes
  USING (carteira_id IN (SELECT cc.id FROM cantina_carteiras cc JOIN responsavel_aluno ra ON ra.aluno_id = cc.aluno_id WHERE ra.responsavel_id = (select auth.uid())));

ALTER POLICY "cantina_pedido_itens_admin_all" ON cantina_pedido_itens
  USING (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text) OR ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'operador'::text));
ALTER POLICY "cantina_pedido_itens_responsavel_select" ON cantina_pedido_itens
  USING (pedido_id IN (SELECT cp.id FROM cantina_pedidos cp JOIN responsavel_aluno ra ON ra.aluno_id = cp.aluno_id WHERE ra.responsavel_id = (select auth.uid())));

ALTER POLICY "cantina_pedidos_admin_all" ON cantina_pedidos
  USING (((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text) OR ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'operador'::text));
ALTER POLICY "cantina_pedidos_responsavel_select" ON cantina_pedidos
  USING (aluno_id IN (SELECT ra.aluno_id FROM responsavel_aluno ra WHERE ra.responsavel_id = (select auth.uid())));

ALTER POLICY "cantina_produtos_all_admin" ON cantina_produtos
  USING ((((select auth.jwt()) ->> 'role'::text) = 'admin'::text) OR ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

ALTER POLICY "cantina_recargas_admin_all" ON cantina_recargas
  USING ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text);
ALTER POLICY "cantina_recargas_responsavel_select" ON cantina_recargas
  USING (responsavel_id = (select auth.uid()));

ALTER POLICY "cantina_restricoes_admin_all" ON cantina_restricoes
  USING ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text);
ALTER POLICY "cantina_restricoes_responsavel_select" ON cantina_restricoes
  USING (aluno_id IN (SELECT ra.aluno_id FROM responsavel_aluno ra WHERE ra.responsavel_id = (select auth.uid())));

ALTER POLICY "responsavel_ver_proprias_solicitacoes" ON cantina_solicitacoes_estorno
  USING (solicitante_id = (select auth.uid()));

ALTER POLICY "email_templates_admin_rw" ON email_templates
  USING ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)
  WITH CHECK ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text);

ALTER POLICY "escola_configuracoes_admin_rw" ON escola_configuracoes
  USING ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)
  WITH CHECK ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text);
ALTER POLICY "escola_configuracoes_self_escola_select" ON escola_configuracoes
  USING (escola_id IN (
    SELECT usuario_papel.escola_id FROM usuario_papel
      WHERE usuario_papel.user_id = (select auth.uid()) AND usuario_papel.suspenso = false
    UNION
    SELECT responsaveis.escola_id FROM responsaveis WHERE responsaveis.id = (select auth.uid())
  ));

ALTER POLICY "responsavel_ingressos" ON ingressos
  USING (responsavel_id = (select auth.uid()))
  WITH CHECK (responsavel_id = (select auth.uid()));

ALTER POLICY "itens_proprio" ON itens_pedido
  USING (pedido_id IN (SELECT pedidos.id FROM pedidos WHERE pedidos.responsavel_id = (select auth.uid())));
ALTER POLICY "responsavel_insert_item" ON itens_pedido
  WITH CHECK (pedido_id IN (SELECT pedidos.id FROM pedidos WHERE pedidos.responsavel_id = (select auth.uid())));
ALTER POLICY "responsavel_read_item" ON itens_pedido
  USING (pedido_id IN (SELECT pedidos.id FROM pedidos WHERE pedidos.responsavel_id = (select auth.uid())));

ALTER POLICY "pagamentos_proprio" ON pagamentos
  USING (pedido_id IN (SELECT pedidos.id FROM pedidos WHERE pedidos.responsavel_id = (select auth.uid())));
ALTER POLICY "responsavel_insert_pagamento" ON pagamentos
  WITH CHECK (pedido_id IN (SELECT pedidos.id FROM pedidos WHERE pedidos.responsavel_id = (select auth.uid())));
ALTER POLICY "responsavel_read_pagamento" ON pagamentos
  USING (pedido_id IN (SELECT pedidos.id FROM pedidos WHERE pedidos.responsavel_id = (select auth.uid())));

ALTER POLICY "papeis_admin_rw" ON papeis
  USING ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)
  WITH CHECK ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text);
ALTER POLICY "papeis_self_select" ON papeis
  USING (id IN (SELECT usuario_papel.papel_id FROM usuario_papel WHERE usuario_papel.user_id = (select auth.uid()) AND usuario_papel.suspenso = false));

ALTER POLICY "papel_permissoes_admin_rw" ON papel_permissoes
  USING ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)
  WITH CHECK ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text);
ALTER POLICY "papel_permissoes_self_select" ON papel_permissoes
  USING (papel_id IN (SELECT usuario_papel.papel_id FROM usuario_papel WHERE usuario_papel.user_id = (select auth.uid()) AND usuario_papel.suspenso = false));

ALTER POLICY "pedido_estornos_admin_all" ON pedido_estornos
  USING ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text);
ALTER POLICY "pedido_estornos_responsavel_select" ON pedido_estornos
  USING (responsavel_id = (select auth.uid()));

ALTER POLICY "pedido_estornos_itens_admin_all" ON pedido_estornos_itens
  USING ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text);
ALTER POLICY "pedido_estornos_itens_responsavel_select" ON pedido_estornos_itens
  USING (EXISTS (SELECT 1 FROM pedido_estornos e WHERE e.id = pedido_estornos_itens.estorno_id AND e.responsavel_id = (select auth.uid())));

ALTER POLICY "pedidos_proprio" ON pedidos
  USING (responsavel_id = (select auth.uid()));
ALTER POLICY "responsavel_insert_pedido" ON pedidos
  WITH CHECK (responsavel_id = (select auth.uid()));
ALTER POLICY "responsavel_read_pedido" ON pedidos
  USING (responsavel_id = (select auth.uid()));
ALTER POLICY "responsavel_update_pedido" ON pedidos
  USING (responsavel_id = (select auth.uid()));

ALTER POLICY "produtos_da_escola" ON produtos
  USING ((ativo = true) AND (escola_id IN (SELECT responsaveis.escola_id FROM responsaveis WHERE responsaveis.id = (select auth.uid()))));

ALTER POLICY "responsaveis_proprio_perfil" ON responsaveis
  USING ((select auth.uid()) = id);

ALTER POLICY "vinculo_proprio" ON responsavel_aluno
  USING (responsavel_id = (select auth.uid()));

ALTER POLICY "termos_versoes_admin_rw" ON termos_versoes
  USING ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)
  WITH CHECK ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text);
ALTER POLICY "termos_versoes_self_escola_select" ON termos_versoes
  USING (escola_id IN (
    SELECT usuario_papel.escola_id FROM usuario_papel
      WHERE usuario_papel.user_id = (select auth.uid()) AND usuario_papel.suspenso = false
    UNION
    SELECT responsaveis.escola_id FROM responsaveis WHERE responsaveis.id = (select auth.uid())
  ));

ALTER POLICY "usuario_papel_admin_all" ON usuario_papel
  USING ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)
  WITH CHECK ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text);
ALTER POLICY "usuario_papel_self_select" ON usuario_papel
  USING (user_id = (select auth.uid()));
