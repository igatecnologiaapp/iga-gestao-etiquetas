
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, uuid, public.app_role[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_company_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_global_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.log_audit(public.audit_action, text, text, uuid, uuid, jsonb, jsonb, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.tg_audit_row() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, uuid, public.app_role[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_global_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_audit(public.audit_action, text, text, uuid, uuid, jsonb, jsonb, text) TO authenticated, service_role;
