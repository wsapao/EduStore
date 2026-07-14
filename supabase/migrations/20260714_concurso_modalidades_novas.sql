-- Edital nº 01/2026 atualizado (jul/2026): concurso passa a ofertar 8 modalidades
-- (novas: basquete, handebol, ballet). Aplicada em prod via MCP em 14/07/2026
-- como "concurso_modalidades_basquete_handebol_ballet".
ALTER TABLE public.inscricoes_concurso
  DROP CONSTRAINT inscricoes_concurso_modalidade_check;

ALTER TABLE public.inscricoes_concurso
  ADD CONSTRAINT inscricoes_concurso_modalidade_check
  CHECK (modalidade IN ('futsal','volei','basquete','handebol','judo','ginastica','ballet','natacao'));
