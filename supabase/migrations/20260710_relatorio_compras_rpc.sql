-- ============================================================================
-- Relatório de Compras por Produto (aba "Compras" de /admin/relatorio).
--
-- get_relatorio_compras: itens de pedido de um produto com aluno, responsável
-- e dados do pedido. SECURITY DEFINER + EXECUTE restrito a service_role — o
-- caller é a página admin server-side via createAdminClient().
--
-- Aproveita para corrigir get_relatorio_presenca: ela ficou fora do lockdown
-- de 20260519_revoke_rpc_execute.sql e qualquer authenticated podia chamá-la
-- via POST /rest/v1/rpc/ e obter PII de alunos. Caller migrado p/ admin client.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_relatorio_compras(p_produto_id uuid)
RETURNS TABLE (
  item_id uuid,
  aluno_nome text,
  aluno_serie text,
  aluno_turma text,
  responsavel_nome text,
  responsavel_email text,
  responsavel_telefone text,
  variante text,
  pedido_numero text,
  pedido_status text,
  data_pagamento timestamptz,
  preco_unitario numeric,
  estornado boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT
    ip.id,
    a.nome,
    a.serie,
    a.turma,
    r.nome,
    r.email,
    r.telefone,
    ip.variante,
    p.numero,
    p.status,
    p.data_pagamento,
    ip.preco_unitario,
    (ip.estornado_em IS NOT NULL)
  FROM itens_pedido ip
  JOIN pedidos p        ON p.id = ip.pedido_id
  LEFT JOIN alunos a    ON a.id = ip.aluno_id
  LEFT JOIN responsaveis r ON r.id = p.responsavel_id
  WHERE ip.produto_id = p_produto_id
  ORDER BY a.serie, a.turma, a.nome, p.numero;
$$;

REVOKE ALL ON FUNCTION public.get_relatorio_compras(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_relatorio_compras(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_relatorio_presenca(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_relatorio_presenca(uuid) TO service_role;
