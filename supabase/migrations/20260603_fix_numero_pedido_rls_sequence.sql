-- Corrige geração de número do pedido.
--
-- BUG: gerar_numero_pedido() era SECURITY INVOKER e calculava o próximo número
-- via `select max(...) from pedidos`. Esse SELECT roda sob a RLS de quem insere
-- (política responsavel_read_pedido: responsavel_id = auth.uid()), então cada
-- responsável só enxergava os PRÓPRIOS pedidos. Resultado: todo novo comprador
-- via 0 pedidos, gerava PED-ANO-000001 e colidia com a constraint UNIQUE(numero).
-- Só o primeiro comprador de todos conseguia finalizar; os demais recebiam
-- "Erro ao criar pedido".
--
-- FIX: usar uma sequence (igual cantina_pedidos_numero_seq). nextval() é atômico
-- e independente de RLS — resolve tanto a visibilidade quanto a corrida de
-- concorrência em checkouts simultâneos. A função vira SECURITY DEFINER para
-- garantir acesso à sequence sem precisar expor USAGE a anon/authenticated.

CREATE SEQUENCE IF NOT EXISTS public.pedidos_numero_seq;

-- Alinha a sequence ao maior sufixo já existente para não colidir com números
-- já emitidos. Se a tabela estiver vazia, o próximo número será 000001.
DO $$
DECLARE
  v_max int;
BEGIN
  SELECT coalesce(max(split_part(numero, '-', 3)::int), 0) INTO v_max FROM public.pedidos;
  IF v_max > 0 THEN
    PERFORM setval('public.pedidos_numero_seq', v_max, true);   -- próximo = v_max + 1
  ELSE
    PERFORM setval('public.pedidos_numero_seq', 1, false);      -- próximo = 1
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.gerar_numero_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
begin
  new.numero := 'PED-' || to_char(now(), 'YYYY') || '-' ||
                lpad(nextval('public.pedidos_numero_seq')::text, 6, '0');
  return new;
end;
$function$;
