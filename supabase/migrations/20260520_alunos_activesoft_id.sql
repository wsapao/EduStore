-- Chave natural para identificar o aluno vindo do ActiveSoft (SigaWeb).
-- Necessária para o onboarding do responsável fazer upsert sem duplicar o
-- aluno quando um segundo responsável (ex.: a mãe) também se cadastra.
-- NULL é permitido (alunos cadastrados manualmente não têm origem no ActiveSoft);
-- o índice único trata NULLs como distintos, então múltiplos NULLs convivem.

ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS activesoft_id integer;

CREATE UNIQUE INDEX IF NOT EXISTS alunos_activesoft_id_key
  ON public.alunos (activesoft_id);
