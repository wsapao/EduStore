-- ── Solicitações de estorno parcial ──────────────────────────
CREATE TABLE pedido_estornos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id      uuid NOT NULL REFERENCES pedidos(id),
  responsavel_id uuid NOT NULL REFERENCES responsaveis(id),
  status         text NOT NULL DEFAULT 'pendente'
                 CHECK (status IN ('pendente', 'aprovado', 'negado')),
  motivo         text NOT NULL,
  obs_admin      text,
  valor_total    numeric(10,2) NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  resolvido_em   timestamptz
);

CREATE TABLE pedido_estornos_itens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estorno_id      uuid NOT NULL REFERENCES pedido_estornos(id) ON DELETE CASCADE,
  item_pedido_id  uuid NOT NULL REFERENCES itens_pedido(id),
  valor_item      numeric(10,2) NOT NULL
);

-- Rastrear quais itens foram estornados
ALTER TABLE itens_pedido ADD COLUMN IF NOT EXISTS estornado_em timestamptz;

-- Índices
CREATE INDEX idx_pedido_estornos_pedido     ON pedido_estornos(pedido_id);
CREATE INDEX idx_pedido_estornos_responsavel ON pedido_estornos(responsavel_id);
CREATE INDEX idx_pedido_estornos_status      ON pedido_estornos(status);
CREATE INDEX idx_pedido_estornos_itens_estorno ON pedido_estornos_itens(estorno_id);

-- RLS
ALTER TABLE pedido_estornos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_estornos_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pedido_estornos_responsavel_select"
  ON pedido_estornos FOR SELECT TO authenticated
  USING (responsavel_id = auth.uid());

CREATE POLICY "pedido_estornos_admin_all"
  ON pedido_estornos FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "pedido_estornos_itens_responsavel_select"
  ON pedido_estornos_itens FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pedido_estornos e
      WHERE e.id = estorno_id
      AND e.responsavel_id = auth.uid()
    )
  );

CREATE POLICY "pedido_estornos_itens_admin_all"
  ON pedido_estornos_itens FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
