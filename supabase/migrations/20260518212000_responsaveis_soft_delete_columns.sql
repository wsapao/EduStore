-- ============================================================
-- Adiciona soft-delete em responsaveis pra suportar LGPD.
-- excluirMinhaContaAction (público) e executarExclusaoLgpdAction
-- (admin) já gravavam nessas colunas, mas o schema não tinha — todo
-- pedido de exclusão de conta caía em "Could not find the 'ativo'
-- column of 'responsaveis' in the schema cache".
-- Hard-delete não é opção: pedidos/ingressos têm FK pra responsavel.
-- ============================================================

ALTER TABLE responsaveis
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS excluido_em TIMESTAMPTZ;

-- Index pra filtrar listagens admin que ocultam responsáveis excluídos.
-- Parcial pra não custar nada em escolas grandes onde quase ninguém é excluído.
CREATE INDEX IF NOT EXISTS idx_responsaveis_ativo
  ON responsaveis (escola_id, ativo)
  WHERE ativo = true;
