-- ============================================================================
-- Correção de hardening: decrementar_uso_voucher continua executável por
-- anon E authenticated em prod, apesar da migration 20260708 (decrementar_uso_
-- voucher) já ter tentado bloqueá-la.
--
-- Root cause: aquela migration fez apenas `REVOKE EXECUTE ... FROM PUBLIC`.
-- No Supabase os papéis anon/authenticated recebem EXECUTE **diretamente**
-- (não só via PUBLIC), então revogar apenas de PUBLIC é INSUFICIENTE — o grant
-- direto permanece. Confirmado em prod (jul/2026): has_function_privilege
-- ('authenticated', ...) = true e ('anon', ...) = true.
--
-- Impacto: qualquer um com a anon key pública (embutida no bundle) podia dar
-- POST /rest/v1/rpc/decrementar_uso_voucher com um UUID de voucher e reduzir
-- usos_atuais (clampa em 0), permitindo reusar um cupom além do limite.
--
-- Seguro aplicar de imediato (sem ordenação): os dois callers já usam service
-- role — app/actions/orders.ts (adminClient) e lib/pagamentos/expirePixJob.ts
-- (createAdminClient). Nenhuma mudança de código é necessária.
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
      AND p.proname = 'decrementar_uso_voucher'
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

-- ── Verificação (rode separadamente; deve mostrar auth_pode = anon_pode = false)
-- SELECT p.proname,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_pode,
--        has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_pode,
--        has_function_privilege('service_role',  p.oid, 'EXECUTE') AS svc_pode
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname = 'decrementar_uso_voucher';
