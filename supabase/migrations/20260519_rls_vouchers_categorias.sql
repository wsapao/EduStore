-- ============================================================================
-- RLS para vouchers e categorias_produto (estavam sem RLS — vazavam entre escolas).
--
-- vouchers: o responsável NÃO lê a tabela direto (evita enumeração de cupons).
--   A validação de cupom no checkout roda via service role (admin client),
--   conferindo só o código exato informado. Apenas admin gerencia, escopado
--   à própria escola.
--
-- categorias_produto: leitura liberada para usuários da própria escola
--   (monta a vitrine); só admin cria/edita/exclui na própria escola.
--
-- Idempotente.
-- ============================================================================

-- ── vouchers ────────────────────────────────────────────────────────────────
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

-- Remove a policy de leitura do responsável (permitia listar/enumerar cupons)
DROP POLICY IF EXISTS "vouchers_responsavel_select" ON public.vouchers;

DROP POLICY IF EXISTS "vouchers_admin_all" ON public.vouchers;
CREATE POLICY "vouchers_admin_all" ON public.vouchers
  FOR ALL TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    AND escola_id IN (
      SELECT escola_id FROM public.responsaveis WHERE id = auth.uid()
      UNION
      SELECT escola_id FROM public.usuario_papel WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    AND escola_id IN (
      SELECT escola_id FROM public.responsaveis WHERE id = auth.uid()
      UNION
      SELECT escola_id FROM public.usuario_papel WHERE user_id = auth.uid()
    )
  );

-- ── categorias_produto ──────────────────────────────────────────────────────
ALTER TABLE public.categorias_produto ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categorias_produto_select_escola" ON public.categorias_produto;
CREATE POLICY "categorias_produto_select_escola" ON public.categorias_produto
  FOR SELECT TO authenticated
  USING (
    escola_id IN (
      SELECT escola_id FROM public.responsaveis WHERE id = auth.uid()
      UNION
      SELECT escola_id FROM public.usuario_papel WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "categorias_produto_admin_all" ON public.categorias_produto;
CREATE POLICY "categorias_produto_admin_all" ON public.categorias_produto
  FOR ALL TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    AND escola_id IN (
      SELECT escola_id FROM public.responsaveis WHERE id = auth.uid()
      UNION
      SELECT escola_id FROM public.usuario_papel WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    AND escola_id IN (
      SELECT escola_id FROM public.responsaveis WHERE id = auth.uid()
      UNION
      SELECT escola_id FROM public.usuario_papel WHERE user_id = auth.uid()
    )
  );
