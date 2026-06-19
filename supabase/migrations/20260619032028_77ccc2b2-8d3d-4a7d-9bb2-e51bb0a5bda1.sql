
-- ===========================================================================
-- FASE 1 — Base técnica, multiempresa, segurança e auditoria
-- ===========================================================================

-- ---------- ENUMS ----------------------------------------------------------
CREATE TYPE public.app_role AS ENUM ('administrador', 'supervisor', 'operador', 'consulta');
CREATE TYPE public.entity_status AS ENUM ('ativo', 'inativo', 'pendente');
CREATE TYPE public.audit_action AS ENUM ('INSERT','UPDATE','DELETE','LOGIN','LOGOUT','PERMISSION_CHANGE','OTHER');

-- ---------- updated_at helper ---------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ===========================================================================
-- COMPANIES
-- ===========================================================================
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT,
  tax_id TEXT,
  email TEXT,
  phone TEXT,
  status public.entity_status NOT NULL DEFAULT 'ativo',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX companies_tax_id_unique ON public.companies (tax_id) WHERE tax_id IS NOT NULL;
CREATE INDEX companies_status_idx ON public.companies (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;

CREATE TRIGGER companies_set_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ===========================================================================
-- BRANCHES
-- ===========================================================================
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  status public.entity_status NOT NULL DEFAULT 'ativo',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX branches_code_per_company ON public.branches (company_id, code) WHERE code IS NOT NULL;
CREATE INDEX branches_company_idx ON public.branches (company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;

CREATE TRIGGER branches_set_updated_at BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ===========================================================================
-- USER PROFILES
-- ===========================================================================
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  default_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  default_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  status public.entity_status NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;

CREATE TRIGGER user_profiles_set_updated_at BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-create profile on auth user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===========================================================================
-- USER ↔ COMPANY ↔ ROLE (autoritativo para perfil de acesso por empresa)
-- ===========================================================================
CREATE TABLE public.user_company_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id, role)
);
CREATE INDEX user_company_roles_user_idx ON public.user_company_roles (user_id);
CREATE INDEX user_company_roles_company_idx ON public.user_company_roles (company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_company_roles TO authenticated;
GRANT ALL ON public.user_company_roles TO service_role;

-- ===========================================================================
-- USER ↔ BRANCH ACCESS
-- ===========================================================================
CREATE TABLE public.user_branch_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, branch_id)
);
CREATE INDEX user_branch_access_user_idx ON public.user_branch_access (user_id);
CREATE INDEX user_branch_access_branch_idx ON public.user_branch_access (branch_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_branch_access TO authenticated;
GRANT ALL ON public.user_branch_access TO service_role;

-- ===========================================================================
-- PERMISSIONS CATALOG + ROLE_PERMISSIONS
-- ===========================================================================
CREATE TABLE public.permissions (
  key TEXT PRIMARY KEY,
  module TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;

CREATE TABLE public.role_permissions (
  role public.app_role NOT NULL,
  permission_key TEXT NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role, permission_key)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

-- Seed permissions (Fase 1 — módulos administrativos)
INSERT INTO public.permissions (key, module, description) VALUES
  ('companies.read',   'companies', 'Visualizar empresas'),
  ('companies.manage', 'companies', 'Criar, editar e inativar empresas'),
  ('branches.read',    'branches',  'Visualizar filiais'),
  ('branches.manage',  'branches',  'Criar, editar e inativar filiais'),
  ('users.read',       'users',     'Visualizar usuários'),
  ('users.manage',     'users',     'Vincular usuários a empresas/filiais e atribuir perfis'),
  ('settings.read',    'settings',  'Visualizar configurações gerais'),
  ('settings.manage',  'settings',  'Editar configurações gerais'),
  ('audit.read',       'audit',     'Visualizar logs de auditoria')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_key)
SELECT 'administrador'::public.app_role, key FROM public.permissions
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_key) VALUES
  ('supervisor','companies.read'),
  ('supervisor','branches.read'),
  ('supervisor','branches.manage'),
  ('supervisor','users.read'),
  ('supervisor','users.manage'),
  ('supervisor','settings.read'),
  ('supervisor','audit.read'),
  ('operador','companies.read'),
  ('operador','branches.read'),
  ('consulta','companies.read'),
  ('consulta','branches.read')
ON CONFLICT DO NOTHING;

-- ===========================================================================
-- SYSTEM SETTINGS
-- ===========================================================================
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE, -- NULL = global
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX system_settings_unique_per_scope
  ON public.system_settings (COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid), key);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;

CREATE TRIGGER system_settings_set_updated_at BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ===========================================================================
-- AUDIT LOGS
-- ===========================================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  branch_id  UUID REFERENCES public.branches(id)  ON DELETE SET NULL,
  user_id    UUID REFERENCES auth.users(id)       ON DELETE SET NULL,
  action     public.audit_action NOT NULL,
  table_name TEXT NOT NULL,
  record_id  TEXT,
  old_values JSONB,
  new_values JSONB,
  reason     TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_company_idx     ON public.audit_logs (company_id, created_at DESC);
CREATE INDEX audit_logs_user_idx        ON public.audit_logs (user_id, created_at DESC);
CREATE INDEX audit_logs_table_idx       ON public.audit_logs (table_name, created_at DESC);
CREATE INDEX audit_logs_created_at_idx  ON public.audit_logs (created_at DESC);

-- INSERT only via SECURITY DEFINER function; SELECT permitido por RLS
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

-- ===========================================================================
-- SECURITY DEFINER HELPERS
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _company_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_company_roles
    WHERE user_id = _user_id AND company_id = _company_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _company_id UUID, _roles public.app_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_company_roles
    WHERE user_id = _user_id AND company_id = _company_id AND role = ANY(_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_member(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_company_roles
    WHERE user_id = _user_id AND company_id = _company_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_global_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_company_roles
    WHERE user_id = _user_id AND role = 'administrador'
  );
$$;

-- Audit logger callable from app or triggers
CREATE OR REPLACE FUNCTION public.log_audit(
  _action public.audit_action,
  _table_name TEXT,
  _record_id TEXT,
  _company_id UUID,
  _branch_id UUID,
  _old JSONB,
  _new JSONB,
  _reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id UUID;
BEGIN
  INSERT INTO public.audit_logs(
    company_id, branch_id, user_id, action, table_name, record_id,
    old_values, new_values, reason
  ) VALUES (
    _company_id, _branch_id, auth.uid(), _action, _table_name, _record_id,
    _old, _new, _reason
  ) RETURNING id INTO _id;
  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audit(public.audit_action, TEXT, TEXT, UUID, UUID, JSONB, JSONB, TEXT) TO authenticated;

-- Generic audit trigger for tracked tables
CREATE OR REPLACE FUNCTION public.tg_audit_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company UUID;
  _branch  UUID;
  _rec_id  TEXT;
  _old     JSONB;
  _new     JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _old := to_jsonb(OLD);
    _new := NULL;
    _rec_id := COALESCE((OLD).id::text, NULL);
    _company := CASE WHEN TG_TABLE_NAME IN ('branches','user_company_roles','system_settings') THEN (_old->>'company_id')::uuid ELSE NULL END;
    IF TG_TABLE_NAME = 'companies' THEN _company := (OLD).id; END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    _old := to_jsonb(OLD);
    _new := to_jsonb(NEW);
    _rec_id := COALESCE((NEW).id::text, NULL);
    _company := CASE WHEN TG_TABLE_NAME IN ('branches','user_company_roles','system_settings') THEN (_new->>'company_id')::uuid ELSE NULL END;
    IF TG_TABLE_NAME = 'companies' THEN _company := (NEW).id; END IF;
  ELSE -- INSERT
    _old := NULL;
    _new := to_jsonb(NEW);
    _rec_id := COALESCE((NEW).id::text, NULL);
    _company := CASE WHEN TG_TABLE_NAME IN ('branches','user_company_roles','system_settings') THEN (_new->>'company_id')::uuid ELSE NULL END;
    IF TG_TABLE_NAME = 'companies' THEN _company := (NEW).id; END IF;
  END IF;

  INSERT INTO public.audit_logs(
    company_id, branch_id, user_id, action, table_name, record_id,
    old_values, new_values
  ) VALUES (
    _company, _branch, auth.uid(), TG_OP::public.audit_action, TG_TABLE_NAME, _rec_id,
    _old, _new
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER audit_companies              AFTER INSERT OR UPDATE OR DELETE ON public.companies              FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();
CREATE TRIGGER audit_branches               AFTER INSERT OR UPDATE OR DELETE ON public.branches               FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();
CREATE TRIGGER audit_user_company_roles     AFTER INSERT OR UPDATE OR DELETE ON public.user_company_roles     FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();
CREATE TRIGGER audit_user_branch_access     AFTER INSERT OR UPDATE OR DELETE ON public.user_branch_access     FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();
CREATE TRIGGER audit_system_settings        AFTER INSERT OR UPDATE OR DELETE ON public.system_settings        FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

-- ===========================================================================
-- ENABLE RLS
-- ===========================================================================
ALTER TABLE public.companies            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_company_roles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_branch_access   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs           ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- POLICIES — COMPANIES
-- ===========================================================================
CREATE POLICY "companies select members"
  ON public.companies FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), id));

CREATE POLICY "companies insert authenticated"
  ON public.companies FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "companies update admin"
  ON public.companies FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), id, 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), id, 'administrador'));

CREATE POLICY "companies delete admin"
  ON public.companies FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), id, 'administrador'));

-- ===========================================================================
-- POLICIES — BRANCHES
-- ===========================================================================
CREATE POLICY "branches select members"
  ON public.branches FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "branches manage admin or supervisor"
  ON public.branches FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]));

-- ===========================================================================
-- POLICIES — USER PROFILES
-- ===========================================================================
CREATE POLICY "profiles select self"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles select same company"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_company_roles ucr_self
      JOIN public.user_company_roles ucr_target
        ON ucr_target.company_id = ucr_self.company_id
      WHERE ucr_self.user_id = auth.uid()
        AND ucr_target.user_id = user_profiles.id
    )
  );

CREATE POLICY "profiles update self"
  ON public.user_profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles insert self"
  ON public.user_profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- ===========================================================================
-- POLICIES — USER_COMPANY_ROLES
-- ===========================================================================
CREATE POLICY "ucr select self or admin"
  ON public.user_company_roles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[])
  );

CREATE POLICY "ucr manage admin"
  ON public.user_company_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), company_id, 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), company_id, 'administrador'));

-- ===========================================================================
-- POLICIES — USER_BRANCH_ACCESS
-- ===========================================================================
CREATE POLICY "uba select self or admin"
  ON public.user_branch_access FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.id = user_branch_access.branch_id
        AND public.has_any_role(auth.uid(), b.company_id, ARRAY['administrador','supervisor']::public.app_role[])
    )
  );

CREATE POLICY "uba manage admin or supervisor"
  ON public.user_branch_access FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.id = user_branch_access.branch_id
        AND public.has_any_role(auth.uid(), b.company_id, ARRAY['administrador','supervisor']::public.app_role[])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.id = user_branch_access.branch_id
        AND public.has_any_role(auth.uid(), b.company_id, ARRAY['administrador','supervisor']::public.app_role[])
    )
  );

-- ===========================================================================
-- POLICIES — PERMISSIONS / ROLE_PERMISSIONS (catálogo público p/ autenticados)
-- ===========================================================================
CREATE POLICY "permissions read all auth"
  ON public.permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "role_permissions read all auth"
  ON public.role_permissions FOR SELECT TO authenticated USING (true);

-- ===========================================================================
-- POLICIES — SYSTEM_SETTINGS
-- ===========================================================================
CREATE POLICY "settings select members or global"
  ON public.system_settings FOR SELECT TO authenticated
  USING (
    company_id IS NULL
    OR public.is_company_member(auth.uid(), company_id)
  );

CREATE POLICY "settings manage admin company"
  ON public.system_settings FOR ALL TO authenticated
  USING (
    company_id IS NOT NULL
    AND public.has_role(auth.uid(), company_id, 'administrador')
  )
  WITH CHECK (
    company_id IS NOT NULL
    AND public.has_role(auth.uid(), company_id, 'administrador')
  );

-- ===========================================================================
-- POLICIES — AUDIT_LOGS
-- ===========================================================================
CREATE POLICY "audit select self"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "audit select admin supervisor"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
    company_id IS NOT NULL
    AND public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[])
  );

-- Allow authenticated to insert audit rows for themselves (triggers usam SECURITY DEFINER, mas mantemos um caminho de app)
CREATE POLICY "audit insert self"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
