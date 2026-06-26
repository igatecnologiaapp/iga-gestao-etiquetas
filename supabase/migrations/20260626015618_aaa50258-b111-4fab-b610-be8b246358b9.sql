
CREATE TABLE public.print_agent_pairing_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pairing_id UUID REFERENCES public.print_agent_pairings(id) ON DELETE SET NULL,
  consumed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT print_agent_pairing_codes_code_format CHECK (code ~ '^[0-9]{6}$')
);

CREATE UNIQUE INDEX print_agent_pairing_codes_active_code_idx
  ON public.print_agent_pairing_codes (code)
  WHERE consumed_at IS NULL;

CREATE INDEX print_agent_pairing_codes_company_idx
  ON public.print_agent_pairing_codes (company_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.print_agent_pairing_codes TO authenticated;
GRANT ALL ON public.print_agent_pairing_codes TO service_role;

ALTER TABLE public.print_agent_pairing_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company admins read pairing codes"
  ON public.print_agent_pairing_codes
  FOR SELECT
  TO authenticated
  USING (
    public.is_global_admin(auth.uid())
    OR public.has_role(auth.uid(), company_id, 'administrador')
  );

CREATE POLICY "Company admins insert pairing codes"
  ON public.print_agent_pairing_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_global_admin(auth.uid())
     OR public.has_role(auth.uid(), company_id, 'administrador'))
    AND created_by = auth.uid()
  );

CREATE TRIGGER set_updated_at_print_agent_pairing_codes
  BEFORE UPDATE ON public.print_agent_pairing_codes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
