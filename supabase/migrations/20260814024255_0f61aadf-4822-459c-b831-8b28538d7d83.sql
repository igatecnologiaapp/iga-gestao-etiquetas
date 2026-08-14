REVOKE ALL ON FUNCTION public.check_pairing_ip_rate_limit(text, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.consume_pairing_code(text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.register_pairing_code_failure(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rotate_print_agent_pairing(uuid, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.check_pairing_ip_rate_limit(text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_pairing_code(text, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.register_pairing_code_failure(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.rotate_print_agent_pairing(uuid, text, text) TO authenticated, service_role;