-- ============================================================
-- Tabela auditoria_log — histórico de mudanças sensíveis.
-- Populada via helper lib/auditoria/log.ts em Server Actions.
-- ============================================================

CREATE TABLE IF NOT EXISTS auditoria_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id     UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  modulo        TEXT NOT NULL,
  acao          TEXT NOT NULL,
  -- Detalhes contextuais (ex: id do alvo, versão antes/depois). Texto livre.
  descricao     TEXT,
  metadata      JSONB,
  ip            TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_escola_data ON auditoria_log(escola_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_user        ON auditoria_log(user_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_modulo      ON auditoria_log(modulo);

ALTER TABLE auditoria_log ENABLE ROW LEVEL SECURITY;

-- Apenas admin lê/escreve da própria escola.
-- Inserts virão de Server Actions usando service-role (admin client) — bypass RLS.
-- A policy aqui é para SELECT via cliente normal (admin autenticado).
CREATE POLICY "auditoria_log_admin_select"
  ON auditoria_log FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Função utilitária para retenção (12 meses).
-- Pode ser agendada via pg_cron quando habilitado:
--   SELECT cron.schedule('auditoria-purge-mensal', '0 3 1 * *', $$ SELECT purge_auditoria_antiga(12); $$);
CREATE OR REPLACE FUNCTION purge_auditoria_antiga(p_meses INT DEFAULT 12)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  DELETE FROM auditoria_log
  WHERE created_at < now() - make_interval(months => p_meses);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
