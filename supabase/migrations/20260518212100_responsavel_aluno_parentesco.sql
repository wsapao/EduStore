-- ============================================================
-- Adiciona 'parentesco' (Responsável, Pai, Mãe, etc.) ao vínculo
-- responsavel_aluno. O onboarding mágico via ActiveSoft já gravava
-- esse campo, mas a coluna não existia — o upsert quebrava em
-- "Could not find the 'parentesco' column" e o try/catch que envolve
-- o bloco silenciava o erro, deixando responsáveis recém-cadastrados
-- sem vínculo com seus filhos.
-- ============================================================

ALTER TABLE responsavel_aluno
  ADD COLUMN IF NOT EXISTS parentesco TEXT;
