-- ============================================================================
-- Hardening: revoga EXECUTE das RPCs SECURITY DEFINER sensíveis de
-- public / anon / authenticated e concede apenas a service_role.
--
-- Motivo: por padrão o PostgREST expõe toda função do schema public para os
-- papéis anon/authenticated. Várias dessas funções movimentam dinheiro
-- (saldo de cantina, confirmação de recarga, emissão de ingressos) ou expõem
-- PII (e-mail por CPF, dados do aluno por token). Sem este REVOKE, qualquer
-- usuário logado (ou anônimo com a anon key pública) poderia chamá-las
-- diretamente via POST /rest/v1/rpc/<nome>.
--
-- Os callers no código já foram migrados para o service role (admin client),
-- então revogar de authenticated/anon NÃO quebra a aplicação.
--
-- Idempotente: pode rodar mais de uma vez.
-- ============================================================================

DO $$
DECLARE
  r       RECORD;
  v_fns   TEXT[] := ARRAY[
    'creditar_saldo_cantina',
    'debitar_saldo_cantina',
    'confirmar_recarga',
    'estornar_recarga',
    'cancelar_recarga',
    'solicitar_estorno',
    'confirmar_estorno_asaas',
    'gerar_ingressos_pedido',
    'cancelar_ingressos_pedido',
    'incrementar_uso_voucher',
    'reservar_estoque_variante',
    'restaurar_estoque_variante',
    'get_email_by_cpf',
    'get_ingresso_by_token'
  ];
BEGIN
  FOR r IN
    SELECT p.oid,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (v_fns)
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
--        has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_pode,
--        has_function_privilege('service_role', p.oid, 'EXECUTE')  AS service_pode
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND p.proname IN (
--     'creditar_saldo_cantina','debitar_saldo_cantina','confirmar_recarga',
--     'estornar_recarga','cancelar_recarga','solicitar_estorno',
--     'confirmar_estorno_asaas','gerar_ingressos_pedido','cancelar_ingressos_pedido',
--     'incrementar_uso_voucher','reservar_estoque_variante','restaurar_estoque_variante',
--     'get_email_by_cpf','get_ingresso_by_token'
--   )
-- ORDER BY p.proname;
