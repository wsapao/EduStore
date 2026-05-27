-- Campos de cupom aplicados ao pedido.
-- O checkout só envia esses campos quando há voucher, mas o schema precisa
-- existir para manter rastreabilidade do desconto e evitar falhas no PostgREST.

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS voucher_id uuid REFERENCES vouchers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS desconto_aplicado numeric(10,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_pedidos_voucher
  ON pedidos (voucher_id);

NOTIFY pgrst, 'reload schema';
