-- ============================================================================
-- Hardening (continuação de 20260519_revoke_rpc_execute.sql):
-- revoga EXECUTE de public/anon/authenticated da RPC validar_ingresso e
-- concede apenas ao service_role.
--
-- Motivo: validar_ingresso é SECURITY DEFINER e "queima" um ingresso
-- (UPDATE usado_em/validado_por a partir de um token). Ficou de fora do lote
-- de 20260519 e nunca foi versionada, então mantinha o EXECUTE que o PostgREST
-- concede por padrão a PUBLIC (herdado por anon/authenticated). Confirmado em
-- prod (jul/2026): um usuário logado (ex.: um pai) executa is_admin /
-- tem_permissao direto via /rest/v1/rpc/* — logo executaria também
-- validar_ingresso e poderia invalidar um ingresso cujo token conhecesse,
-- sem passar pelo guard checkin.usar de validarIngressoAction.
--
-- ORDEM DE APLICAÇÃO (importante):
--   1. Fazer deploy do código que move validarIngressoAction para o service
--      role (createAdminClient) — já feito no mesmo commit desta migration.
--   2. Confirmar que o check-in continua funcionando em prod.
--   3. SÓ ENTÃO rodar esta migration. Rodá-la ANTES do deploy quebraria o
--      check-in (a action ainda usaria o client de sessão sem EXECUTE).
--
-- Idempotente: pode rodar mais de uma vez.
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'validar_ingresso'
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated;',
      r.proname, r.args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role;',
      r.proname, r.args
    );
    RAISE NOTICE 'Locked down: public.%(%)', r.proname, r.args;
  END LOOP;
END $$;

-- ── Verificação (rode separadamente; deve mostrar auth_pode = false) ─────────
-- SELECT p.proname,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_pode,
--        has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_pode,
--        has_function_privilege('service_role',  p.oid, 'EXECUTE') AS svc_pode
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname = 'validar_ingresso';
