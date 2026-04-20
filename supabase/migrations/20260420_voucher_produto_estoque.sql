-- Vincula voucher a um produto específico (opcional)
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS produto_id uuid REFERENCES produtos(id) ON DELETE SET NULL;

-- Estoque direto no produto (para produtos sem variantes)
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS estoque integer DEFAULT NULL;
