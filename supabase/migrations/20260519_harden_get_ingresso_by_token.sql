-- ============================================================================
-- get_ingresso_by_token: parar de retornar PII do responsável.
--
-- Antes a função devolvia a linha inteira de responsaveis (nome, email, cpf,
-- telefone) no payload do ingresso — dados que a página nem usa. Agora retorna
-- apenas os campos exibidos (produto + aluno). EXECUTE segue restrito ao
-- service role (chamada feita pelo server, página já exige login).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_ingresso_by_token(p_token uuid)
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT row_to_json(r)
  FROM (
    SELECT
      i.id, i.token, i.status, i.usado_em, i.validado_por, i.created_at,
      json_build_object(
        'nome', p.nome,
        'categoria', p.categoria,
        'icon', p.icon,
        'data_evento', p.data_evento,
        'hora_evento', p.hora_evento,
        'local_evento', p.local_evento
      ) AS produto,
      json_build_object(
        'nome', a.nome,
        'serie', a.serie,
        'turma', a.turma
      ) AS aluno
    FROM public.ingressos i
    JOIN public.produtos p ON p.id = i.produto_id
    JOIN public.alunos   a ON a.id = i.aluno_id
    WHERE i.token = p_token
    LIMIT 1
  ) r;
$function$;

REVOKE ALL ON FUNCTION public.get_ingresso_by_token(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ingresso_by_token(uuid) TO service_role;
