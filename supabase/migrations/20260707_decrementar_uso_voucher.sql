-- Devolve um uso do voucher (contrapartida de incrementar_uso_voucher).
-- Usado quando um checkout que já consumiu o cupom precisa ser revertido
-- (falha do gateway, falha ao reservar estoque etc.). Clampa em 0 para nunca
-- ficar negativo. Operação atômica.
--
-- Segurança: SECURITY DEFINER chamada apenas via service role. Revoga EXECUTE
-- de PUBLIC (anon/authenticated herdam de PUBLIC) e concede ao service_role.
CREATE OR REPLACE FUNCTION public.decrementar_uso_voucher(p_voucher_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE vouchers
  SET usos_atuais = GREATEST(0, usos_atuais - 1)
  WHERE id = p_voucher_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.decrementar_uso_voucher(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrementar_uso_voucher(uuid) TO service_role;
