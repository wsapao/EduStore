-- ── Tabela de recargas PIX ────────────────────────────────────
CREATE TABLE cantina_recargas (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  carteira_id        uuid        NOT NULL REFERENCES cantina_carteiras(id),
  responsavel_id     uuid        NOT NULL REFERENCES responsaveis(id),
  valor              numeric(10,2) NOT NULL CHECK (valor >= 5 AND valor <= 2000),
  status             text        NOT NULL DEFAULT 'aguardando'
                                 CHECK (status IN ('aguardando','confirmada','expirada','falhou')),
  gateway_id         text,
  pix_qr_code        text,
  pix_qr_code_imagem text,
  pix_expiracao      timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  confirmada_em      timestamptz
);

-- Necessário para Realtime detectar UPDATE (old + new row disponíveis)
ALTER TABLE cantina_recargas REPLICA IDENTITY FULL;

-- Adiciona à publicação do Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE cantina_recargas;

-- ── Índices ───────────────────────────────────────────────────
CREATE INDEX idx_cantina_recargas_responsavel ON cantina_recargas(responsavel_id);
CREATE INDEX idx_cantina_recargas_carteira    ON cantina_recargas(carteira_id);

-- ── updated_at trigger ────────────────────────────────────────
CREATE TRIGGER trg_cantina_recargas_updated_at
  BEFORE UPDATE ON cantina_recargas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE cantina_recargas ENABLE ROW LEVEL SECURITY;

-- Responsável só vê suas próprias recargas
CREATE POLICY "cantina_recargas_responsavel_select"
  ON cantina_recargas
  FOR SELECT
  TO authenticated
  USING (responsavel_id = auth.uid());

-- Admin tem acesso total
CREATE POLICY "cantina_recargas_admin_all"
  ON cantina_recargas FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ── RPC: confirmar_recarga ────────────────────────────────────
-- Chamada pelo webhook via admin client (SECURITY DEFINER ignora RLS)
CREATE OR REPLACE FUNCTION confirmar_recarga(p_recarga_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recarga cantina_recargas%ROWTYPE;
  v_credito jsonb;
BEGIN
  -- Lock exclusivo para evitar duplo crédito em webhooks simultâneos
  SELECT * INTO v_recarga
  FROM cantina_recargas
  WHERE id = p_recarga_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Recarga não encontrada.');
  END IF;

  -- Idempotência: se já confirmada, retorna ok sem creditar novamente
  IF v_recarga.status = 'confirmada' THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  IF v_recarga.status != 'aguardando' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Status inválido: ' || v_recarga.status);
  END IF;

  -- Credita saldo via RPC existente (atômico, registra movimentação)
  SELECT creditar_saldo_cantina(
    v_recarga.carteira_id,
    v_recarga.valor,
    'Recarga PIX confirmada — R$ ' || to_char(v_recarga.valor, 'FM9999990.00'),
    NULL,
    v_recarga.gateway_id
  ) INTO v_credito;

  IF NOT (v_credito->>'ok')::boolean THEN
    RAISE EXCEPTION 'creditar_saldo_cantina falhou: %', v_credito->>'erro';
  END IF;

  -- Atualiza status → Realtime notifica o browser
  UPDATE cantina_recargas
  SET status = 'confirmada', confirmada_em = now()
  WHERE id = p_recarga_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;
