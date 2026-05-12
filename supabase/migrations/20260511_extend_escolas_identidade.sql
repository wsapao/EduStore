-- ============================================================
-- Estende a tabela escolas com campos de identidade fiscal e
-- personalização da loja online.
-- Faz parte da Fundação do Menu de Configurações.
-- ============================================================

ALTER TABLE escolas
  ADD COLUMN IF NOT EXISTS razao_social         TEXT,
  ADD COLUMN IF NOT EXISTS banner_url           TEXT,
  ADD COLUMN IF NOT EXISTS slogan               TEXT,
  ADD COLUMN IF NOT EXISTS texto_boas_vindas    TEXT,
  ADD COLUMN IF NOT EXISTS favicon_url          TEXT,
  ADD COLUMN IF NOT EXISTS endereco_logradouro  TEXT,
  ADD COLUMN IF NOT EXISTS endereco_numero      TEXT,
  ADD COLUMN IF NOT EXISTS endereco_bairro      TEXT,
  ADD COLUMN IF NOT EXISTS endereco_cidade      TEXT,
  ADD COLUMN IF NOT EXISTS endereco_uf          CHAR(2),
  ADD COLUMN IF NOT EXISTS endereco_cep         TEXT;

-- Constraint de tamanho conforme spec
ALTER TABLE escolas
  ADD CONSTRAINT escolas_slogan_len            CHECK (slogan IS NULL OR char_length(slogan) <= 120),
  ADD CONSTRAINT escolas_texto_boas_vindas_len CHECK (texto_boas_vindas IS NULL OR char_length(texto_boas_vindas) <= 500);
