ALTER TABLE cantina_recargas
  ADD COLUMN IF NOT EXISTS metodo text NOT NULL DEFAULT 'pix'
    CHECK (metodo IN ('pix', 'cartao')),
  ADD COLUMN IF NOT EXISTS checkout_url text;
