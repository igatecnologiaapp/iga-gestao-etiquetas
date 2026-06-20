CREATE POLICY "role_permissions insert global admin" ON public.role_permissions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_global_admin(auth.uid()));

CREATE POLICY "role_permissions delete global admin" ON public.role_permissions
  FOR DELETE TO authenticated
  USING (public.is_global_admin(auth.uid()));