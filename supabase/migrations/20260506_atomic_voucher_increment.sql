-- Incrementa usos_atuais apenas se ainda há capacidade.
-- Retorna TRUE se o incremento foi feito, FALSE se o limite já foi atingido.
-- Operação atômica — elimina race condition em checkout simultâneo.
CREATE OR REPLACE FUNCTION incrementar_uso_voucher(p_voucher_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE vouchers
  SET usos_atuais = usos_atuais + 1
  WHERE id = p_voucher_id
    AND (limite_usos IS NULL OR usos_atuais < limite_usos);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;
