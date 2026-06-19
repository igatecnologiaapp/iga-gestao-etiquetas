
-- ENUMS
DO $$ BEGIN
  CREATE TYPE public.integration_type AS ENUM ('erp','printer','scale','whatsapp','email','external_api','production','tech_sheet');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.integration_status AS ENUM ('inactive','testing','active','error','disabled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.integration_auth_type AS ENUM ('none','api_key','bearer','basic','oauth2','hmac','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.integration_log_status AS ENUM ('success','error','pending','skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.integration_log_direction AS ENUM ('inbound','outbound');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.integration_queue_status AS ENUM ('pending','processing','success','error','skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.printer_command_language AS ENUM ('ZPL','EPL','ESC_POS','PDF','generic');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.template_status AS ENUM ('draft','active','disabled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.external_entity_type AS ENUM ('product','category','brand','label','promotion','customer','supplier','price');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- integration_configs
CREATE TABLE public.integration_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  integration_type public.integration_type NOT NULL,
  name TEXT NOT NULL,
  provider TEXT,
  status public.integration_status NOT NULL DEFAULT 'inactive',
  base_url TEXT,
  auth_type public.integration_auth_type NOT NULL DEFAULT 'none',
  settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_test_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  last_error_message TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, integration_type, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_configs TO authenticated;
GRANT ALL ON public.integration_configs TO service_role;
ALTER TABLE public.integration_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY ic_select ON public.integration_configs FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]));
CREATE POLICY ic_insert ON public.integration_configs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), company_id, 'administrador'));
CREATE POLICY ic_update ON public.integration_configs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), company_id, 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), company_id, 'administrador'));
CREATE POLICY ic_delete ON public.integration_configs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), company_id, 'administrador'));
CREATE TRIGGER trg_ic_updated BEFORE UPDATE ON public.integration_configs FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_ic_audit AFTER INSERT OR UPDATE OR DELETE ON public.integration_configs FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();
CREATE INDEX idx_ic_company ON public.integration_configs(company_id, integration_type, status);

-- integration_tokens (encrypted-at-rest placeholders; never SELECT to client)
CREATE TABLE public.integration_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  integration_config_id UUID NOT NULL REFERENCES public.integration_configs(id) ON DELETE CASCADE,
  token_name TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (integration_config_id, token_name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_tokens TO authenticated;
GRANT ALL ON public.integration_tokens TO service_role;
ALTER TABLE public.integration_tokens ENABLE ROW LEVEL SECURITY;
-- Only metadata via SELECT (no client should read token_hash; service role only)
CREATE POLICY itk_no_select ON public.integration_tokens FOR SELECT TO authenticated USING (false);
CREATE POLICY itk_insert ON public.integration_tokens FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), company_id, 'administrador'));
CREATE POLICY itk_update ON public.integration_tokens FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), company_id, 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), company_id, 'administrador'));
CREATE POLICY itk_delete ON public.integration_tokens FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), company_id, 'administrador'));
CREATE TRIGGER trg_itk_updated BEFORE UPDATE ON public.integration_tokens FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_itk_config ON public.integration_tokens(integration_config_id);

-- integration_logs
CREATE TABLE public.integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  integration_config_id UUID REFERENCES public.integration_configs(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  direction public.integration_log_direction NOT NULL,
  status public.integration_log_status NOT NULL DEFAULT 'success',
  request_payload JSONB,
  response_payload JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.integration_logs TO authenticated;
GRANT ALL ON public.integration_logs TO service_role;
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY il_select ON public.integration_logs FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]));
CREATE POLICY il_insert ON public.integration_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE INDEX idx_il_config_created ON public.integration_logs(integration_config_id, created_at DESC);
CREATE INDEX idx_il_company_created ON public.integration_logs(company_id, created_at DESC);

-- integration_event_queue
CREATE TABLE public.integration_event_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  integration_config_id UUID REFERENCES public.integration_configs(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.integration_queue_status NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_event_queue TO authenticated;
GRANT ALL ON public.integration_event_queue TO service_role;
ALTER TABLE public.integration_event_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY ieq_select ON public.integration_event_queue FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]));
CREATE POLICY ieq_insert ON public.integration_event_queue FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY ieq_update ON public.integration_event_queue FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]));
CREATE POLICY ieq_delete ON public.integration_event_queue FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), company_id, 'administrador'));
CREATE TRIGGER trg_ieq_updated BEFORE UPDATE ON public.integration_event_queue FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_ieq_status ON public.integration_event_queue(company_id, status, next_retry_at);
CREATE INDEX idx_ieq_config ON public.integration_event_queue(integration_config_id);

-- integration_webhooks
CREATE TABLE public.integration_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  integration_config_id UUID NOT NULL REFERENCES public.integration_configs(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  target_url TEXT NOT NULL,
  secret_hash TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_delivery_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (integration_config_id, event, target_url)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_webhooks TO authenticated;
GRANT ALL ON public.integration_webhooks TO service_role;
ALTER TABLE public.integration_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY iw_select ON public.integration_webhooks FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]));
CREATE POLICY iw_admin ON public.integration_webhooks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), company_id, 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), company_id, 'administrador'));
CREATE TRIGGER trg_iw_updated BEFORE UPDATE ON public.integration_webhooks FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_iw_config ON public.integration_webhooks(integration_config_id);

-- email_templates
CREATE TABLE public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  variables TEXT[] NOT NULL DEFAULT '{}',
  status public.template_status NOT NULL DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY et_select ON public.email_templates FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY et_write ON public.email_templates FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]));
CREATE TRIGGER trg_et_updated BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_et_audit AFTER INSERT OR UPDATE OR DELETE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

-- whatsapp_templates
CREATE TABLE public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  variables TEXT[] NOT NULL DEFAULT '{}',
  status public.template_status NOT NULL DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_templates TO authenticated;
GRANT ALL ON public.whatsapp_templates TO service_role;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY wt_select ON public.whatsapp_templates FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY wt_write ON public.whatsapp_templates FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]));
CREATE TRIGGER trg_wt_updated BEFORE UPDATE ON public.whatsapp_templates FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_wt_audit AFTER INSERT OR UPDATE OR DELETE ON public.whatsapp_templates FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

-- external_system_mappings
CREATE TABLE public.external_system_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  integration_config_id UUID NOT NULL REFERENCES public.integration_configs(id) ON DELETE CASCADE,
  entity_type public.external_entity_type NOT NULL,
  internal_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  external_payload JSONB,
  last_sync_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (integration_config_id, entity_type, internal_id),
  UNIQUE (integration_config_id, entity_type, external_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_system_mappings TO authenticated;
GRANT ALL ON public.external_system_mappings TO service_role;
ALTER TABLE public.external_system_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY esm_select ON public.external_system_mappings FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]));
CREATE POLICY esm_write ON public.external_system_mappings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), company_id, 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), company_id, 'administrador'));
CREATE TRIGGER trg_esm_updated BEFORE UPDATE ON public.external_system_mappings FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_esm_lookup ON public.external_system_mappings(company_id, entity_type, internal_id);

-- scale_configs
CREATE TABLE public.scale_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  integration_config_id UUID REFERENCES public.integration_configs(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  manufacturer TEXT,
  model TEXT,
  protocol TEXT,
  connection_type TEXT,
  status public.integration_status NOT NULL DEFAULT 'inactive',
  settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scale_configs TO authenticated;
GRANT ALL ON public.scale_configs TO service_role;
ALTER TABLE public.scale_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY sc_select ON public.scale_configs FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY sc_write ON public.scale_configs FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]));
CREATE TRIGGER trg_sc_updated BEFORE UPDATE ON public.scale_configs FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_sc_audit AFTER INSERT OR UPDATE OR DELETE ON public.scale_configs FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();
CREATE INDEX idx_sc_company ON public.scale_configs(company_id, branch_id);

-- Extend printer_configs
ALTER TABLE public.printer_configs
  ADD COLUMN IF NOT EXISTS protocol TEXT,
  ADD COLUMN IF NOT EXISTS command_language public.printer_command_language,
  ADD COLUMN IF NOT EXISTS connection_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS driver_notes TEXT,
  ADD COLUMN IF NOT EXISTS integration_config_id UUID REFERENCES public.integration_configs(id) ON DELETE SET NULL;
