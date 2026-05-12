-- ============================================================
-- Mantém auth.users.raw_app_meta_data->>'role' espelhando o
-- chave_preset do papel atual em usuario_papel.
--
-- Motivo: todas as RLS atuais checam app_metadata.role. Em vez de
-- reescrever todas as policies, espelhamos. Papéis customizados
-- (preset = false) ficam com role = 'custom' (sem privilégio nas RLS
-- antigas — admin custom precisa ter chave_preset = 'admin' OU as
-- RLS antigas serem migradas em fase futura).
--
-- Para papel preset = false, gravamos role = 'custom' (RLS antigas
-- não reconhecem — esses usuários só funcionam via novo sistema de
-- permissões, o que é o objetivo).
-- ============================================================

CREATE OR REPLACE FUNCTION sync_app_metadata_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_chave TEXT;
  v_user  UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user := OLD.user_id;
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) - 'role'
    WHERE id = v_user;
    RETURN OLD;
  END IF;

  v_user := NEW.user_id;
  IF NEW.suspenso THEN
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'suspenso')
    WHERE id = v_user;
    RETURN NEW;
  END IF;

  SELECT COALESCE(chave_preset, 'custom') INTO v_chave
    FROM papeis WHERE id = NEW.papel_id;

  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', v_chave)
  WHERE id = v_user;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS usuario_papel_sync_app_metadata ON usuario_papel;
CREATE TRIGGER usuario_papel_sync_app_metadata
  AFTER INSERT OR UPDATE OR DELETE ON usuario_papel
  FOR EACH ROW EXECUTE FUNCTION sync_app_metadata_role();

-- Roda uma vez para sincronizar registros já existentes
UPDATE usuario_papel SET updated_at = updated_at;
