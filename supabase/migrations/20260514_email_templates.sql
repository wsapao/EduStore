-- ============================================================
-- Tabela email_templates
-- Permite admin customizar assunto + corpo dos e-mails transacionais
-- por escola. Quando não há template no banco para uma escola+tipo,
-- o app cai no template default em código (lib/email/templates.ts).
--
-- Substituição de variáveis é whitelist-based no app — esta tabela
-- só guarda o texto livre.
-- ============================================================

CREATE TABLE IF NOT EXISTS email_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id     UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL CHECK (tipo IN (
    'confirmacao_pedido_pix',
    'confirmacao_pedido_cartao',
    'confirmacao_pedido_boleto',
    'pedido_pago',
    'pedido_cancelado',
    'ingresso_emitido',
    'recarga_cantina_aprovada',
    'convite_admin'
  )),
  assunto       TEXT NOT NULL,
  corpo         TEXT NOT NULL,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT email_templates_unico UNIQUE (escola_id, tipo)
);

CREATE INDEX IF NOT EXISTS idx_email_templates_escola ON email_templates(escola_id);

DROP TRIGGER IF EXISTS email_templates_set_updated_at ON email_templates;
CREATE TRIGGER email_templates_set_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_templates_admin_rw"
  ON email_templates FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
