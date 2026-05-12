-- ============================================================
-- Bucket público para assets da loja (logo, banner, favicon).
-- Upload restrito a admins; leitura pública.
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('escola-assets', 'escola-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Leitura pública
CREATE POLICY "escola_assets_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'escola-assets');

-- Upload/update/delete: admin
CREATE POLICY "escola_assets_admin_write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'escola-assets'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','gerente')
  );

CREATE POLICY "escola_assets_admin_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'escola-assets'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','gerente')
  );

CREATE POLICY "escola_assets_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'escola-assets'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','gerente')
  );
