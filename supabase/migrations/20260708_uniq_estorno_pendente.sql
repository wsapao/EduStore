-- BAIXO (auditoria): solicitarEstornoParcialAction fazia check-then-insert sem
-- atomicidade → dois cliques/requests simultâneos criavam duas solicitações de
-- estorno "pendente" para o mesmo pedido. Este índice único parcial garante no
-- máximo uma solicitação pendente por pedido; o código trata o 23505 e devolve a
-- mensagem amigável de "já existe solicitação pendente".
--
-- ATENÇÃO: se já houver duplicatas pendentes em prod, resolva-as antes de criar o
-- índice (a criação falha com dados que já violam a restrição). Aplicar via MCP do
-- Supabase (rstsomdurwksoqxbypty).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pedido_estorno_pendente
  ON public.pedido_estornos (pedido_id)
  WHERE status = 'pendente';
