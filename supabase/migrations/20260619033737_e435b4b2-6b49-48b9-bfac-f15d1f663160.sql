
-- Lock down companies: only global admins can create; only admins can self-assign roles
DROP POLICY IF EXISTS "companies insert authenticated" ON public.companies;

CREATE POLICY "companies insert global admin only"
ON public.companies FOR INSERT
TO authenticated
WITH CHECK (public.is_global_admin(auth.uid()));

-- user_company_roles: prevent users from inserting their own admin role unless they already are admin somewhere
-- Existing "ucr manage admin" policy already requires has_role(auth.uid(), company_id, 'administrador')
-- which a brand-new company won't satisfy. So self-promotion via UI is already blocked.
-- (No change needed beyond removing the companies INSERT loophole.)
