-- ============================================================
-- Tabela papel_permissoes
-- Lista de chaves de permissão concedidas a um papel.
-- A lista canônica de chaves vive no código (lib/permissoes/keys.ts);
-- aqui não há FK para uma tabela "permissoes" — chaves são strings
-- validadas pela aplicação.
-- ============================================================

CREATE TABLE IF NOT EXISTS papel_permissoes (
  papel_id     UUID NOT NULL REFERENCES papeis(id) ON DELETE CASCADE,
  chave        TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (papel_id, chave)
);

CREATE INDEX IF NOT EXISTS idx_papel_permissoes_papel ON papel_permissoes(papel_id);
