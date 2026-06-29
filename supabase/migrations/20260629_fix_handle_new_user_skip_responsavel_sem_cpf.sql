-- Root cause: handle_new_user() inseria em public.responsaveis para TODO auth.user,
-- forçando cpf='' quando não havia CPF nos metadados. Como responsaveis.cpf é
-- UNIQUE + NOT NULL, apenas o 1º usuário sem CPF entrava; convites de equipe
-- (admin, inviteUserByEmail — sem CPF) seguintes colidiam com cpf='' já existente
-- -> SQLSTATE 23505 -> Auth retorna 500 "Database error saving new user".
--
-- Correção: só cria perfil de responsável quando há CPF real. O cadastro pelo
-- responsável (cadastrarAction) sempre envia CPF, então é preservado. Convites
-- de equipe não têm CPF e são tratados via usuario_papel — não viram responsáveis.
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

  SELECT id INTO v_escola_id FROM public.escolas WHERE ativo = true LIMIT 1;

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
