-- Follow-up da 20260701_concurso_bolsas_inscricoes:
-- 1) updated_at + trigger set_updated_at (convenção do schema — ver cantina_recargas)
-- 2) CHECK em turno (consistência com modalidade/status_pagamento)

ALTER TABLE public.inscricoes_concurso
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE TRIGGER trg_inscricoes_concurso_updated_at
  BEFORE UPDATE ON public.inscricoes_concurso
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.inscricoes_concurso
  ADD CONSTRAINT inscricoes_concurso_turno_check CHECK (turno IN ('tarde'));
