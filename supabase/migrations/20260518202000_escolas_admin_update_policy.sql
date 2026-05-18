-- ============================================================
-- A tabela escolas tinha RLS ativa mas só policy de SELECT.
-- Qualquer UPDATE de admin (identidade, endereço, logo/banner/favicon)
-- afetava 0 linhas silenciosamente e o supabase-js retornava sem erro
-- — a action mostrava "Identidade atualizada!" mas o valor não persistia.
-- ============================================================

CREATE POLICY "escolas_admin_update"
  ON escolas
  FOR UPDATE
  TO authenticated
  USING ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)
  WITH CHECK ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text);
