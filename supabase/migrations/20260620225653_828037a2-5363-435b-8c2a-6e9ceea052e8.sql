CREATE OR REPLACE FUNCTION public.tg_protect_admin_essential_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _essential CONSTANT text[] := ARRAY['users.read','users.manage','roles.read','roles.manage'];
BEGIN
  IF OLD.role = 'administrador'
     AND OLD.permission_key = ANY(_essential)
     AND EXISTS (SELECT 1 FROM public.permissions WHERE key = OLD.permission_key)
  THEN
    RAISE EXCEPTION
      'Permissão essencial do Administrador não pode ser removida: %', OLD.permission_key
      USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_protect_admin_essential_permissions() FROM PUBLIC, anon, authenticated;