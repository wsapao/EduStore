ALTER TABLE cantina_movimentacoes
  DROP CONSTRAINT cantina_movimentacoes_tipo_check,
  ADD CONSTRAINT cantina_movimentacoes_tipo_check
    CHECK (tipo = ANY (ARRAY['recarga','consumo','estorno','ajuste_manual','estorno_recarga']));
