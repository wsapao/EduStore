-- M-LJ7: handle_new_user() escolhia a escola do novo responsável com
--   SELECT id FROM escolas WHERE ativo = true LIMIT 1
-- sem ORDER BY. Com 2+ tenants ativos (ex.: escola demo), a linha retornada é
-- NÃO determinística → o pai real pode cair na escola errada e gerar pedidos
-- com escola_id incorreto.
--
-- Correção: torna a escolha determinística ordenando pela escola mais antiga
-- (created_at ASC, desempate por id). NÃO edita a migration antiga já aplicada
-- (20260629); substitui a função com CREATE OR REPLACE.
--
-- ATENÇÃO: precisa ser APLICADA no Supabase (rstsomdurwksoqxbypty).
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_escola_id uuid;
  v_cpf text;
BEGIN
  v_cpf := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'cpf', '')), '');

  -- Sem CPF (ex.: convite de equipe via admin) => não cria responsável.
  IF v_cpf IS NULL THEN
    RETURN NEW;
  END IF;

  -- Se o cadastro trouxe escola_id explícito nos metadados, respeita-o.
  v_escola_id := NULLIF(NEW.raw_user_meta_data->>'escola_id', '')::uuid;

  -- Caso contrário, resolve de forma determinística: a escola ativa mais antiga.
  IF v_escola_id IS NULL THEN
    SELECT id INTO v_escola_id
    FROM public.escolas
    WHERE ativo = true
    ORDER BY created_at ASC, id ASC
    LIMIT 1;
  END IF;

  INSERT INTO public.responsaveis (id, nome, cpf, email, escola_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    v_cpf,
    NEW.email,
    v_escola_id
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;
