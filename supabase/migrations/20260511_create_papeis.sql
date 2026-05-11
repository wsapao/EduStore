-- ============================================================
-- Tabela papeis
-- Cada escola tem seus próprios papéis. 6 presets de fábrica
-- (preset = true, chave_preset = 'admin' | 'gerente' | ...).
-- Papéis customizados têm preset = false.
-- ============================================================

CREATE TABLE IF NOT EXISTS papeis (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id    UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  nome         TEXT NOT NULL,
  descricao    TEXT,
  preset       BOOLEAN NOT NULL DEFAULT false,
  chave_preset TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT papeis_chave_preset_valida CHECK (
    chave_preset IS NULL
    OR chave_preset IN ('admin','gerente','financeiro','cantineiro','operador','visualizador')
  ),
  CONSTRAINT papeis_preset_coerencia CHECK (
    (preset = true AND chave_preset IS NOT NULL)
    OR (preset = false AND chave_preset IS NULL)
  ),
  CONSTRAINT papeis_chave_preset_unica UNIQUE (escola_id, chave_preset)
);

CREATE INDEX IF NOT EXISTS idx_papeis_escola ON papeis(escola_id);

DROP TRIGGER IF EXISTS papeis_set_updated_at ON papeis;
CREATE TRIGGER papeis_set_updated_at
  BEFORE UPDATE ON papeis
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
