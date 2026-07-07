-- ============================================================================
-- Versionamento: snapshot das RPCs de gestão de alunos pelo responsável,
-- dumpado de produção via pg_get_functiondef em 06/07/2026. As funções
-- existiam apenas no banco (sprint9_gestao_alunos), sem SQL no repo.
--
-- Chamadas por app/actions/alunos.ts com o cliente de SESSÃO do usuário
-- (papel authenticated) — a autorização é feita por auth.uid() dentro de
-- cada função. Por isso authenticated MANTÉM EXECUTE aqui; NÃO aplicar o
-- padrão service-role-only de 20260519_revoke_rpc_execute.sql.
--
-- p_serie é armazenada como recebida (o dropdown envia a grafia canônica do
-- ActiveSoft); a equivalência de grafias legadas ("1º ano EM" ≡ "1º Série EM")
-- é resolvida na leitura por comparação normalizada (lib/crm/series-core.ts).
--
-- Idempotente: pode rodar mais de uma vez.
-- ============================================================================

-- ── criar_aluno_responsavel ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.criar_aluno_responsavel(p_nome text, p_serie text, p_turma text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_escola_id uuid;
  v_aluno_id  uuid;
BEGIN
  -- Busca escola do responsável autenticado
  SELECT escola_id INTO v_escola_id
  FROM responsaveis
  WHERE id = auth.uid();

  IF v_escola_id IS NULL THEN
    RAISE EXCEPTION 'Responsável sem escola vinculada.';
  END IF;

  -- Cria o aluno
  INSERT INTO alunos (nome, serie, turma, escola_id, ativo)
  VALUES (p_nome, p_serie, p_turma, v_escola_id, true)
  RETURNING id INTO v_aluno_id;

  -- Cria o vínculo
  INSERT INTO responsavel_aluno (responsavel_id, aluno_id)
  VALUES (auth.uid(), v_aluno_id);

  RETURN v_aluno_id;
END;
$function$;

-- ── editar_aluno_responsavel ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.editar_aluno_responsavel(p_aluno_id uuid, p_nome text, p_serie text, p_turma text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM responsavel_aluno
    WHERE responsavel_id = auth.uid() AND aluno_id = p_aluno_id
  ) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  UPDATE alunos
  SET nome = p_nome, serie = p_serie, turma = p_turma
  WHERE id = p_aluno_id;
END;
$function$;

-- ── toggle_aluno_ativo ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.toggle_aluno_ativo(p_aluno_id uuid, p_ativo boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Só pode alterar alunos vinculados a ele
  IF NOT EXISTS (
    SELECT 1 FROM responsavel_aluno
    WHERE responsavel_id = auth.uid() AND aluno_id = p_aluno_id
  ) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  UPDATE alunos SET ativo = p_ativo WHERE id = p_aluno_id;
END;
$function$;

-- ── Privilégios (estado de produção em 06/07/2026) ───────────────────────────
-- SECURITY DEFINER voltado ao usuário logado: anon/PUBLIC fora,
-- authenticated e service_role com EXECUTE.
REVOKE ALL ON FUNCTION public.criar_aluno_responsavel(text, text, text)        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.editar_aluno_responsavel(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.toggle_aluno_ativo(uuid, boolean)                FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.criar_aluno_responsavel(text, text, text)        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.editar_aluno_responsavel(uuid, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.toggle_aluno_ativo(uuid, boolean)                TO authenticated, service_role;
