-- RPC seguro para criação de empresa: valida que o caller é administrador global,
-- insere a empresa e vincula o caller como administrador, em uma única transação.
CREATE OR REPLACE FUNCTION public.create_company_with_admin(
  _name text,
  _legal_name text DEFAULT NULL,
  _tax_id text DEFAULT NULL,
  _email text DEFAULT NULL,
  _phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _company_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.is_global_admin(_uid) THEN
    RAISE EXCEPTION 'forbidden: requires administrator role';
  END IF;

  IF _name IS NULL OR length(btrim(_name)) = 0 THEN
    RAISE EXCEPTION 'invalid_name';
  END IF;

  INSERT INTO public.companies (name, legal_name, tax_id, email, phone, created_by, status)
  VALUES (btrim(_name), NULLIF(btrim(_legal_name), ''), NULLIF(btrim(_tax_id), ''),
          NULLIF(btrim(_email), ''), NULLIF(btrim(_phone), ''), _uid, 'ativo')
  RETURNING id INTO _company_id;

  INSERT INTO public.user_company_roles (user_id, company_id, role, created_by)
  VALUES (_uid, _company_id, 'administrador', _uid)
  ON CONFLICT (user_id, company_id, role) DO NOTHING;

  RETURN _company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_company_with_admin(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_company_with_admin(text, text, text, text, text) TO authenticated;