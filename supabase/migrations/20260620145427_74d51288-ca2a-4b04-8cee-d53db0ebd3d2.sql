
-- 1) Dedicated platform admins table (separate from per-company roles)
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform admins read self" ON public.platform_admins;
CREATE POLICY "platform admins read self"
  ON public.platform_admins FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
-- No write policies: only service_role can modify (admin handover runs server-side)

-- 2) Seed initial platform admin (Souza Aguiar)
INSERT INTO public.platform_admins (user_id)
SELECT id FROM auth.users WHERE email = 'souzaaguiar.producao@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- 3) Rewire is_global_admin to read the dedicated platform table
CREATE OR REPLACE FUNCTION public.is_global_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = _user_id
  );
$$;

-- 4) Tighten audit_logs INSERT policy to prevent forged entries
DROP POLICY IF EXISTS "audit insert self" ON public.audit_logs;
CREATE POLICY "audit insert self"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND company_id IS NOT NULL
    AND public.is_company_member(auth.uid(), company_id)
  );
