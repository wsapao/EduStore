-- Concurso de Bolsas – Seletivas Esportivas 2027 (ESJT)
-- Tabela de inscrições públicas (sem login). Escrita/leitura APENAS via
-- service role (server actions + webhook). RLS ligada sem policies = nega
-- anon/authenticated; service role bypassa RLS.

CREATE TABLE public.inscricoes_concurso (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id           uuid NOT NULL REFERENCES public.escolas(id),
  numero              text NOT NULL UNIQUE,

  -- Aluno candidato (Q1–Q6)
  aluno_nome          text NOT NULL,
  aluno_nascimento    date NOT NULL,
  turno               text NOT NULL DEFAULT 'tarde',
  serie_2026          text NOT NULL,
  modalidade          text NOT NULL CHECK (modalidade IN ('futsal','volei','judo','ginastica','natacao')),
  instituicao_atual   text NOT NULL,

  -- Responsável 1 (Q7–Q11 + CPF/e-mail p/ Pix e comprovante)
  resp1_nome          text NOT NULL,
  resp1_cpf           text NOT NULL,
  resp1_email         text NOT NULL,
  resp1_telefone      text,
  resp1_endereco      text,
  resp1_profissao     text,
  resp1_parentesco    text,

  -- Responsável 2 (Q12–Q16, opcional)
  resp2_nome          text,
  resp2_endereco      text,
  resp2_telefone      text,
  resp2_profissao     text,
  resp2_parentesco    text,

  -- Irmãos (Q17–Q18)
  tem_irmaos          boolean,
  irmaos_series_2026  text,

  -- LGPD
  consentimento_em    timestamptz,

  -- Pagamento
  valor               numeric(10,2) NOT NULL,
  status_pagamento    text NOT NULL DEFAULT 'pendente'
                        CHECK (status_pagamento IN ('pendente','pago','expirado','cancelado')),
  gateway_id          text,
  pix_qr_code         text,
  pix_qr_code_imagem  text,
  pix_tx_id           text,
  pix_expiracao       timestamptz,
  pago_em             timestamptz,
  valor_liquido       numeric(10,2),

  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inscricoes_concurso_escola_idx     ON public.inscricoes_concurso (escola_id);
CREATE INDEX inscricoes_concurso_status_idx     ON public.inscricoes_concurso (status_pagamento);
CREATE INDEX inscricoes_concurso_modalidade_idx ON public.inscricoes_concurso (modalidade);
CREATE INDEX inscricoes_concurso_gateway_idx    ON public.inscricoes_concurso (gateway_id);

-- Numeração amigável CB2027-0001 via sequence (atômica, imune a RLS —
-- mesmo padrão de 20260603_fix_numero_pedido_rls_sequence.sql)
CREATE SEQUENCE IF NOT EXISTS public.inscricoes_concurso_numero_seq;

CREATE OR REPLACE FUNCTION public.gerar_numero_inscricao_concurso()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
begin
  new.numero := 'CB2027-' ||
                lpad(nextval('public.inscricoes_concurso_numero_seq')::text, 4, '0');
  return new;
end;
$function$;

CREATE TRIGGER trg_gerar_numero_inscricao_concurso
  BEFORE INSERT ON public.inscricoes_concurso
  FOR EACH ROW EXECUTE FUNCTION public.gerar_numero_inscricao_concurso();

-- Hardening: RLS ligada sem policies + revogar do PUBLIC (herança!) —
-- revogar só de anon/authenticated é inócuo, eles herdam de PUBLIC.
ALTER TABLE public.inscricoes_concurso ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.inscricoes_concurso FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.inscricoes_concurso TO service_role;
REVOKE ALL ON SEQUENCE public.inscricoes_concurso_numero_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SEQUENCE public.inscricoes_concurso_numero_seq TO service_role;
REVOKE EXECUTE ON FUNCTION public.gerar_numero_inscricao_concurso() FROM PUBLIC, anon, authenticated;
