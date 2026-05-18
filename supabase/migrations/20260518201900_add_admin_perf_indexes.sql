-- ============================================================
-- Índices pra acelerar listas e agregados do /admin/*.
-- Cobre filtros (escola_id+status+data, nome, série), FKs sem
-- índice apontadas pelo advisor do Supabase, e lookups reversos
-- (responsavel_aluno por aluno_id).
-- ============================================================

-- pedidos: list paginado, filtros de status/método, PIX pendentes 24h
CREATE INDEX IF NOT EXISTS idx_pedidos_escola_created
  ON pedidos (escola_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_status_created
  ON pedidos (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_metodo_status_created
  ON pedidos (metodo_pagamento, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_responsavel
  ON pedidos (responsavel_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_voucher
  ON pedidos (voucher_id);

-- alunos: list por escola, busca por nome, filtro por série
CREATE INDEX IF NOT EXISTS idx_alunos_escola_nome
  ON alunos (escola_id, nome);
CREATE INDEX IF NOT EXISTS idx_alunos_serie
  ON alunos (serie);

-- responsaveis: list por escola, busca por nome
CREATE INDEX IF NOT EXISTS idx_responsaveis_escola_nome
  ON responsaveis (escola_id, nome);
CREATE INDEX IF NOT EXISTS idx_responsaveis_escola_created
  ON responsaveis (escola_id, created_at DESC);

-- produtos: list e filtros do admin/produtos e dashboard
CREATE INDEX IF NOT EXISTS idx_produtos_escola_ativo
  ON produtos (escola_id, ativo);
CREATE INDEX IF NOT EXISTS idx_produtos_categoria
  ON produtos (categoria);

-- itens_pedido: agregações (top produtos, receita por produto/método)
CREATE INDEX IF NOT EXISTS idx_itens_pedido_pedido
  ON itens_pedido (pedido_id);
CREATE INDEX IF NOT EXISTS idx_itens_pedido_produto
  ON itens_pedido (produto_id);
CREATE INDEX IF NOT EXISTS idx_itens_pedido_aluno
  ON itens_pedido (aluno_id);
CREATE INDEX IF NOT EXISTS idx_itens_pedido_variante
  ON itens_pedido (variante_id);

-- responsavel_aluno: PK começa em responsavel_id, falta lookup por aluno_id
CREATE INDEX IF NOT EXISTS idx_responsavel_aluno_aluno
  ON responsavel_aluno (aluno_id);

-- ingressos: capacidade por produto no dashboard
CREATE INDEX IF NOT EXISTS idx_ingressos_produto_status
  ON ingressos (produto_id, status);
CREATE INDEX IF NOT EXISTS idx_ingressos_item_pedido
  ON ingressos (item_pedido_id);
CREATE INDEX IF NOT EXISTS idx_ingressos_aluno
  ON ingressos (aluno_id);
CREATE INDEX IF NOT EXISTS idx_ingressos_responsavel
  ON ingressos (responsavel_id);

-- Cantina e demais FKs sem índice flagadas pelo advisor
CREATE INDEX IF NOT EXISTS idx_cantina_pedido_itens_pedido
  ON cantina_pedido_itens (pedido_id);
CREATE INDEX IF NOT EXISTS idx_cantina_pedido_itens_produto
  ON cantina_pedido_itens (produto_id);
CREATE INDEX IF NOT EXISTS idx_cantina_pedidos_movimentacao
  ON cantina_pedidos (movimentacao_id);
CREATE INDEX IF NOT EXISTS idx_cantina_restricoes_produto
  ON cantina_restricoes (produto_id);
CREATE INDEX IF NOT EXISTS idx_cantina_solicitacoes_estorno_recarga
  ON cantina_solicitacoes_estorno (recarga_id);
CREATE INDEX IF NOT EXISTS idx_categorias_produto_escola
  ON categorias_produto (escola_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_updated_by
  ON email_templates (updated_by);
CREATE INDEX IF NOT EXISTS idx_pedido_estornos_itens_item
  ON pedido_estornos_itens (item_pedido_id);
CREATE INDEX IF NOT EXISTS idx_termos_versoes_publicado_por
  ON termos_versoes (publicado_por);
CREATE INDEX IF NOT EXISTS idx_usuario_papel_suspenso_por
  ON usuario_papel (suspenso_por);
