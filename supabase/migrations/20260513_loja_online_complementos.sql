ALTER TABLE escola_configuracoes
  ADD COLUMN IF NOT EXISTS loja_funcionamento JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS categorias_home_visiveis TEXT[],
  ADD COLUMN IF NOT EXISTS produtos_home_destaque UUID[] NOT NULL DEFAULT '{}'::uuid[];
