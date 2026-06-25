
-- =========================================================
-- FASE 2 — Print Agent / Impressão Direta — Esquema base
-- =========================================================

-- 1) Ampliar printer_configs (idempotente)
ALTER TABLE public.printer_configs
  ADD COLUMN IF NOT EXISTS driver_name text,
  ADD COLUMN IF NOT EXISTS agent_printer_id text,
  ADD COLUMN IF NOT EXISTS raw_language text,
  ADD COLUMN IF NOT EXISTS speed integer,
  ADD COLUMN IF NOT EXISTS rotation integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_cut boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS label_advance numeric(10,3),
  ADD COLUMN IF NOT EXISTS offset_x numeric(10,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS offset_y numeric(10,3) NOT NULL DEFAULT 0;

-- 2) printer_layout_compatibility
CREATE TABLE IF NOT EXISTS public.printer_layout_compatibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  printer_id uuid NOT NULL REFERENCES public.printer_configs(id) ON DELETE CASCADE,
  layout_id uuid REFERENCES public.label_layouts(id) ON DELETE CASCADE,
  format_id uuid REFERENCES public.label_formats(id) ON DELETE CASCADE,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plc_layout_or_format CHECK (
    (layout_id IS NOT NULL AND format_id IS NULL) OR
    (layout_id IS NULL AND format_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS plc_unique_layout
  ON public.printer_layout_compatibility(printer_id, layout_id)
  WHERE layout_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS plc_unique_format
  ON public.printer_layout_compatibility(printer_id, format_id)
  WHERE format_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS plc_company_idx ON public.printer_layout_compatibility(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.printer_layout_compatibility TO authenticated;
GRANT ALL ON public.printer_layout_compatibility TO service_role;

ALTER TABLE public.printer_layout_compatibility ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plc select members" ON public.printer_layout_compatibility;
CREATE POLICY "plc select members" ON public.printer_layout_compatibility
  FOR SELECT TO authenticated
  USING (is_company_member(auth.uid(), company_id));

DROP POLICY IF EXISTS "plc insert admin sup" ON public.printer_layout_compatibility;
CREATE POLICY "plc insert admin sup" ON public.printer_layout_compatibility
  FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), company_id, ARRAY['administrador'::app_role, 'supervisor'::app_role]));

DROP POLICY IF EXISTS "plc update admin sup" ON public.printer_layout_compatibility;
CREATE POLICY "plc update admin sup" ON public.printer_layout_compatibility
  FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), company_id, ARRAY['administrador'::app_role, 'supervisor'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), company_id, ARRAY['administrador'::app_role, 'supervisor'::app_role]));

DROP POLICY IF EXISTS "plc delete admin" ON public.printer_layout_compatibility;
CREATE POLICY "plc delete admin" ON public.printer_layout_compatibility
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), company_id, 'administrador'::app_role));

DROP TRIGGER IF EXISTS plc_updated_at ON public.printer_layout_compatibility;
CREATE TRIGGER plc_updated_at BEFORE UPDATE ON public.printer_layout_compatibility
  FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();

DROP TRIGGER IF EXISTS plc_audit ON public.printer_layout_compatibility;
CREATE TRIGGER plc_audit AFTER INSERT OR UPDATE OR DELETE ON public.printer_layout_compatibility
  FOR EACH ROW EXECUTE FUNCTION tg_audit_row();

-- 3) print_queue
DO $$ BEGIN
  CREATE TYPE public.print_job_status AS ENUM
    ('pending','sent','printing','completed','failed','canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.print_job_source AS ENUM ('print_agent','pdf_fallback','manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.print_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id),
  printer_id uuid REFERENCES public.printer_configs(id) ON DELETE SET NULL,
  layout_id uuid REFERENCES public.label_layouts(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  batch_id uuid REFERENCES public.print_batches(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  status public.print_job_status NOT NULL DEFAULT 'pending',
  source public.print_job_source NOT NULL DEFAULT 'print_agent',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  agent_job_id text,
  error_message text,
  attempts integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS print_queue_company_status_idx
  ON public.print_queue(company_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS print_queue_printer_idx
  ON public.print_queue(printer_id);
CREATE INDEX IF NOT EXISTS print_queue_user_idx
  ON public.print_queue(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_queue TO authenticated;
GRANT ALL ON public.print_queue TO service_role;

ALTER TABLE public.print_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pq select members" ON public.print_queue;
CREATE POLICY "pq select members" ON public.print_queue
  FOR SELECT TO authenticated
  USING (is_company_member(auth.uid(), company_id));

DROP POLICY IF EXISTS "pq insert members" ON public.print_queue;
CREATE POLICY "pq insert members" ON public.print_queue
  FOR INSERT TO authenticated
  WITH CHECK (is_company_member(auth.uid(), company_id) AND user_id = auth.uid());

DROP POLICY IF EXISTS "pq update own or admin" ON public.print_queue;
CREATE POLICY "pq update own or admin" ON public.print_queue
  FOR UPDATE TO authenticated
  USING (
    is_company_member(auth.uid(), company_id)
    AND (user_id = auth.uid()
         OR has_any_role(auth.uid(), company_id, ARRAY['administrador'::app_role, 'supervisor'::app_role]))
  )
  WITH CHECK (is_company_member(auth.uid(), company_id));

DROP POLICY IF EXISTS "pq delete admin" ON public.print_queue;
CREATE POLICY "pq delete admin" ON public.print_queue
  FOR DELETE TO authenticated
  USING (has_any_role(auth.uid(), company_id, ARRAY['administrador'::app_role, 'supervisor'::app_role]));

DROP TRIGGER IF EXISTS print_queue_updated_at ON public.print_queue;
CREATE TRIGGER print_queue_updated_at BEFORE UPDATE ON public.print_queue
  FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();

DROP TRIGGER IF EXISTS print_queue_audit ON public.print_queue;
CREATE TRIGGER print_queue_audit AFTER INSERT OR UPDATE OR DELETE ON public.print_queue
  FOR EACH ROW EXECUTE FUNCTION tg_audit_row();
