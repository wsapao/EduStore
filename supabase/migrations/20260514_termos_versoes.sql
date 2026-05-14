-- ============================================================
-- Tabela termos_versoes
-- Versionamento de Termos de Uso e Política de Privacidade por escola.
-- Cada novo "publicar" insere uma linha com versao incrementada.
-- A versão "atual" é a com maior `versao` para o (escola_id, tipo).
-- ============================================================

CREATE TABLE IF NOT EXISTS termos_versoes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id     UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL CHECK (tipo IN ('termos_uso', 'privacidade')),
  versao        INT  NOT NULL CHECK (versao >= 1),
  conteudo      TEXT NOT NULL,
  publicado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  publicado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT termos_versoes_unica UNIQUE (escola_id, tipo, versao)
);

CREATE INDEX IF NOT EXISTS idx_termos_versoes_escola_tipo
  ON termos_versoes(escola_id, tipo, versao DESC);

ALTER TABLE termos_versoes ENABLE ROW LEVEL SECURITY;

-- Admin lê/escreve da sua escola
CREATE POLICY "termos_versoes_admin_rw"
  ON termos_versoes FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Qualquer autenticado lê a versão da própria escola
CREATE POLICY "termos_versoes_self_escola_select"
  ON termos_versoes FOR SELECT
  TO authenticated
  USING (
    escola_id IN (
      SELECT escola_id FROM usuario_papel WHERE user_id = auth.uid() AND suspenso = false
      UNION
      SELECT escola_id FROM responsaveis WHERE id = auth.uid()
    )
  );
