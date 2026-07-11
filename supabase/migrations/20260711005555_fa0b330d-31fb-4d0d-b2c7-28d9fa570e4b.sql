
ALTER TABLE public.print_agent_pairing_codes
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.print_agent_pairing_ip_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL,
  code_provided text,
  success boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS print_agent_pairing_ip_attempts_ip_time_idx
  ON public.print_agent_pairing_ip_attempts (ip, attempted_at DESC);

GRANT ALL ON public.print_agent_pairing_ip_attempts TO service_role;
ALTER TABLE public.print_agent_pairing_ip_attempts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_pairing_code(
  _code text,
  _device_id text,
  _device_name text,
  _agent_version text,
  _token_prefix text,
  _token_hash text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _code_row public.print_agent_pairing_codes%ROWTYPE;
  _pairing_id uuid;
  _final_label text;
BEGIN
  SELECT * INTO _code_row
  FROM public.print_agent_pairing_codes
  WHERE code = _code AND consumed_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_CODE');
  END IF;

  IF _code_row.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_CODE');
  END IF;

  IF COALESCE(_code_row.attempts, 0) >= 5 THEN
    UPDATE public.print_agent_pairing_codes
      SET consumed_at = now()
      WHERE id = _code_row.id;
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_CODE');
  END IF;

  _final_label := CASE
    WHEN _device_name IS NOT NULL AND length(btrim(_device_name)) > 0
      THEN _code_row.label || ' — ' || _device_name
    ELSE _code_row.label
  END;

  INSERT INTO public.print_agent_pairings (
    company_id, label, token_prefix, token_hash,
    device_id, device_name, agent_version, status
  ) VALUES (
    _code_row.company_id,
    LEFT(_final_label, 200),
    _token_prefix,
    _token_hash,
    _device_id,
    _device_name,
    _agent_version,
    'active'
  ) RETURNING id INTO _pairing_id;

  UPDATE public.print_agent_pairing_codes
    SET consumed_at = now(),
        pairing_id  = _pairing_id
    WHERE id = _code_row.id;

  RETURN jsonb_build_object(
    'ok', true,
    'pairing_id', _pairing_id,
    'company_id', _code_row.company_id,
    'label', LEFT(_final_label, 200)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_pairing_code(text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_pairing_code(text, text, text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.register_pairing_code_failure(_code text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new integer;
BEGIN
  UPDATE public.print_agent_pairing_codes
    SET attempts = COALESCE(attempts, 0) + 1
    WHERE code = _code AND consumed_at IS NULL
    RETURNING attempts INTO _new;
  RETURN COALESCE(_new, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.register_pairing_code_failure(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_pairing_code_failure(text) TO service_role;

CREATE OR REPLACE FUNCTION public.check_pairing_ip_rate_limit(
  _ip text,
  _code text,
  _success boolean
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _recent integer;
BEGIN
  DELETE FROM public.print_agent_pairing_ip_attempts
    WHERE attempted_at < now() - interval '24 hours';

  SELECT count(*) INTO _recent
    FROM public.print_agent_pairing_ip_attempts
    WHERE ip = _ip
      AND success = false
      AND attempted_at > now() - interval '15 minutes';

  INSERT INTO public.print_agent_pairing_ip_attempts (ip, code_provided, success)
    VALUES (_ip, LEFT(COALESCE(_code, ''), 6), COALESCE(_success, false));

  RETURN _recent < 20;
END;
$$;

REVOKE ALL ON FUNCTION public.check_pairing_ip_rate_limit(text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_pairing_ip_rate_limit(text, text, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.rotate_print_agent_pairing(
  _pairing_id uuid,
  _new_prefix text,
  _new_hash text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current public.print_agent_pairings%ROWTYPE;
  _new_id uuid;
  _actor uuid := auth.uid();
BEGIN
  IF _actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO _current
    FROM public.print_agent_pairings
    WHERE id = _pairing_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pairing_not_found';
  END IF;

  IF NOT (
    public.is_global_admin(_actor)
    OR public.has_role(_actor, _current.company_id, 'administrador')
  ) THEN
    RAISE EXCEPTION 'forbidden: requires administrator role';
  END IF;

  INSERT INTO public.print_agent_pairings (
    company_id, label, token_prefix, token_hash,
    device_id, device_name, agent_version, created_by, status
  ) VALUES (
    _current.company_id,
    LEFT(_current.label || ' (rotated)', 200),
    _new_prefix,
    _new_hash,
    _current.device_id,
    _current.device_name,
    _current.agent_version,
    _actor,
    'active'
  ) RETURNING id INTO _new_id;

  UPDATE public.print_agent_pairings
    SET status = 'revoked',
        revoked_by = _actor,
        revoked_at = now()
    WHERE id = _pairing_id;

  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rotate_print_agent_pairing(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rotate_print_agent_pairing(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_print_agent_pairing(uuid, text, text) TO service_role;
