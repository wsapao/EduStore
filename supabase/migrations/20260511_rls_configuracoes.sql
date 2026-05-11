-- ============================================================
-- RLS para escola_configuracoes, papeis, papel_permissoes, usuario_papel.
--
-- Política temporária baseada em app_metadata.role enquanto a migração
-- de usuários para usuario_papel está sendo aplicada — a Task 10 vai
-- introduzir um trigger que mantém app_metadata.role espelhando o papel
-- preset associado, mantendo todas as RLS existentes funcionando.
-- ============================================================

ALTER TABLE escola_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE papeis               ENABLE ROW LEVEL SECURITY;
ALTER TABLE papel_permissoes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_papel        ENABLE ROW LEVEL SECURITY;

-- escola_configuracoes: admin lê/escreve da sua escola
CREATE POLICY "escola_configuracoes_admin_rw"
  ON escola_configuracoes FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- papeis: admin lê/escreve
CREATE POLICY "papeis_admin_rw"
  ON papeis FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- papel_permissoes: admin lê/escreve
CREATE POLICY "papel_permissoes_admin_rw"
  ON papel_permissoes FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- usuario_papel: admin lê/escreve; usuário lê o próprio
CREATE POLICY "usuario_papel_self_select"
  ON usuario_papel FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "usuario_papel_admin_all"
  ON usuario_papel FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
