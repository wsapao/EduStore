-- ============================================================
-- Tabela usuario_papel
-- Associa um auth.users (admin/operador/etc) a um papel de uma escola.
-- Um usuário tem APENAS UM papel por escola (UNIQUE).
-- Suspensão é registrada aqui (em vez de tocar em auth.users).
-- ============================================================

CREATE TABLE IF NOT EXISTS usuario_papel (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  escola_id      UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  papel_id       UUID NOT NULL REFERENCES papeis(id) ON DELETE RESTRICT,
  suspenso       BOOLEAN NOT NULL DEFAULT false,
  suspenso_em    TIMESTAMPTZ,
  suspenso_por   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT usuario_papel_unico_por_escola UNIQUE (user_id, escola_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_papel_escola ON usuario_papel(escola_id);
CREATE INDEX IF NOT EXISTS idx_usuario_papel_papel  ON usuario_papel(papel_id);

DROP TRIGGER IF EXISTS usuario_papel_set_updated_at ON usuario_papel;
CREATE TRIGGER usuario_papel_set_updated_at
  BEFORE UPDATE ON usuario_papel
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
