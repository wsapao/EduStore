-- ============================================================
-- Migra usuários existentes:
--   auth.users.raw_app_meta_data->>'role' = 'admin'    → preset Admin
--   auth.users.raw_app_meta_data->>'role' = 'operador' → preset Operador
--
-- Vincula à escola do usuário quando possível (via responsaveis.escola_id);
-- quando o usuário não está em responsaveis (admin "técnico"), pega
-- a primeira escola ativa como fallback.
-- ============================================================

DO $$
DECLARE
  u RECORD;
  v_escola_id UUID;
  v_papel_id  UUID;
BEGIN
  FOR u IN
    SELECT id, raw_app_meta_data->>'role' AS role
    FROM auth.users
    WHERE raw_app_meta_data->>'role' IN ('admin','operador')
  LOOP
    SELECT escola_id INTO v_escola_id FROM responsaveis WHERE id = u.id;
    IF v_escola_id IS NULL THEN
      SELECT id INTO v_escola_id FROM escolas WHERE ativo = true ORDER BY created_at LIMIT 1;
    END IF;
    IF v_escola_id IS NULL THEN
      RAISE NOTICE 'Sem escola para usuário %, pulando', u.id;
      CONTINUE;
    END IF;

    SELECT id INTO v_papel_id FROM papeis
      WHERE escola_id = v_escola_id AND chave_preset = u.role;

    IF v_papel_id IS NULL THEN
      RAISE NOTICE 'Preset % não encontrado para escola %, pulando user %', u.role, v_escola_id, u.id;
      CONTINUE;
    END IF;

    INSERT INTO usuario_papel (user_id, escola_id, papel_id)
      VALUES (u.id, v_escola_id, v_papel_id)
    ON CONFLICT (user_id, escola_id) DO UPDATE SET papel_id = EXCLUDED.papel_id;
  END LOOP;
END;
$$;
