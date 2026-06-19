
-- Phase 4: Emission of labels
-- Enum for label type
DO $$ BEGIN
  CREATE TYPE public.label_type AS ENUM (
    'nutricional','gondola','promocional','logistica','producao','identificacao','validade','outros'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.print_batch_status AS ENUM ('draft','generated','cancelled','reprinted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.printed_label_status AS ENUM ('generated','cancelled','reprinted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.print_event_type AS ENUM (
    'generated','cancelled','reprinted','layout_changed','layout_suggested','no_layout_suggestion','previewed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add label_type column to label_categories (optional mapping) and label_layouts
ALTER TABLE public.label_categories ADD COLUMN IF NOT EXISTS label_type public.label_type;
ALTER TABLE public.label_layouts ADD COLUMN IF NOT EXISTS label_type public.label_type;

-- Map seeded categories to label_type
UPDATE public.label_categories SET label_type = CASE
  WHEN name ILIKE '%Nutricional%' THEN 'nutricional'::public.label_type
  WHEN name ILIKE '%Gôndola%' OR name ILIKE '%Gondola%' THEN 'gondola'::public.label_type
  WHEN name ILIKE '%Promocional%' THEN 'promocional'::public.label_type
  WHEN name ILIKE '%Produção%' OR name ILIKE '%Producao%' THEN 'producao'::public.label_type
  WHEN name ILIKE '%Logística%' OR name ILIKE '%Logistica%' THEN 'logistica'::public.label_type
  WHEN name ILIKE '%Expedição%' OR name ILIKE '%Expedicao%' THEN 'logistica'::public.label_type
  WHEN name ILIKE '%Identificação%' OR name ILIKE '%Identificacao%' THEN 'identificacao'::public.label_type
  WHEN name ILIKE '%Validade%' THEN 'validade'::public.label_type
  ELSE 'outros'::public.label_type
END WHERE label_type IS NULL;

-- =========================
-- print_batches
-- =========================
CREATE TABLE IF NOT EXISTS public.print_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  label_type public.label_type NOT NULL,
  label_layout_id UUID NOT NULL REFERENCES public.label_layouts(id) ON DELETE RESTRICT,
  label_layout_version_id UUID NOT NULL REFERENCES public.label_layout_versions(id) ON DELETE RESTRICT,
  printer_config_id UUID REFERENCES public.printer_configs(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  batch_code TEXT,
  manufacture_date DATE,
  expiration_date DATE,
  variable_weight NUMERIC,
  layout_suggested BOOLEAN DEFAULT false,
  layout_suggestion_source TEXT,
  layout_overridden BOOLEAN DEFAULT false,
  status public.print_batch_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_batches TO authenticated;
GRANT ALL ON public.print_batches TO service_role;
ALTER TABLE public.print_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pb_select" ON public.print_batches FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "pb_insert" ON public.print_batches FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor','operador']::app_role[]));
CREATE POLICY "pb_update" ON public.print_batches FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]));
CREATE POLICY "pb_delete" ON public.print_batches FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), company_id, 'administrador'));

CREATE INDEX IF NOT EXISTS idx_pb_company ON public.print_batches(company_id);
CREATE INDEX IF NOT EXISTS idx_pb_branch ON public.print_batches(branch_id);
CREATE INDEX IF NOT EXISTS idx_pb_product ON public.print_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_pb_layout ON public.print_batches(label_layout_id);
CREATE INDEX IF NOT EXISTS idx_pb_status ON public.print_batches(status);
CREATE INDEX IF NOT EXISTS idx_pb_created ON public.print_batches(created_at DESC);

CREATE TRIGGER print_batches_updated BEFORE UPDATE ON public.print_batches
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER print_batches_audit AFTER INSERT OR UPDATE OR DELETE ON public.print_batches
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

-- =========================
-- printed_labels
-- =========================
CREATE TABLE IF NOT EXISTS public.printed_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  print_batch_id UUID NOT NULL REFERENCES public.print_batches(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  label_layout_id UUID NOT NULL REFERENCES public.label_layouts(id) ON DELETE RESTRICT,
  label_layout_version_id UUID NOT NULL REFERENCES public.label_layout_versions(id) ON DELETE RESTRICT,
  unique_label_code TEXT NOT NULL UNIQUE,
  sequential_number INTEGER NOT NULL,
  qr_code_payload JSONB,
  barcode_value TEXT,
  status public.printed_label_status NOT NULL DEFAULT 'generated',
  reprint_of UUID REFERENCES public.printed_labels(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.printed_labels TO authenticated;
GRANT ALL ON public.printed_labels TO service_role;
ALTER TABLE public.printed_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pl_select" ON public.printed_labels FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "pl_insert" ON public.printed_labels FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor','operador']::app_role[]));
CREATE POLICY "pl_update" ON public.printed_labels FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]));
CREATE POLICY "pl_delete" ON public.printed_labels FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), company_id, 'administrador'));

CREATE INDEX IF NOT EXISTS idx_pl_company ON public.printed_labels(company_id);
CREATE INDEX IF NOT EXISTS idx_pl_branch ON public.printed_labels(branch_id);
CREATE INDEX IF NOT EXISTS idx_pl_product ON public.printed_labels(product_id);
CREATE INDEX IF NOT EXISTS idx_pl_batch ON public.printed_labels(print_batch_id);
CREATE INDEX IF NOT EXISTS idx_pl_layout ON public.printed_labels(label_layout_id);
CREATE INDEX IF NOT EXISTS idx_pl_status ON public.printed_labels(status);
CREATE INDEX IF NOT EXISTS idx_pl_created ON public.printed_labels(created_at DESC);

CREATE TRIGGER printed_labels_audit AFTER INSERT OR UPDATE OR DELETE ON public.printed_labels
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

-- =========================
-- label_snapshots
-- =========================
CREATE TABLE IF NOT EXISTS public.label_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  printed_label_id UUID NOT NULL REFERENCES public.printed_labels(id) ON DELETE CASCADE,
  product_snapshot JSONB,
  nutrition_snapshot JSONB,
  ingredients_snapshot JSONB,
  allergens_snapshot JSONB,
  layout_snapshot JSONB,
  printer_snapshot JSONB,
  emission_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.label_snapshots TO authenticated;
GRANT ALL ON public.label_snapshots TO service_role;
ALTER TABLE public.label_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ls_select" ON public.label_snapshots FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "ls_insert" ON public.label_snapshots FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor','operador']::app_role[]));
CREATE POLICY "ls_delete" ON public.label_snapshots FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), company_id, 'administrador'));

CREATE INDEX IF NOT EXISTS idx_ls_company ON public.label_snapshots(company_id);
CREATE INDEX IF NOT EXISTS idx_ls_label ON public.label_snapshots(printed_label_id);

CREATE TRIGGER label_snapshots_audit AFTER INSERT OR UPDATE OR DELETE ON public.label_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

-- =========================
-- print_events
-- =========================
CREATE TABLE IF NOT EXISTS public.print_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  print_batch_id UUID REFERENCES public.print_batches(id) ON DELETE CASCADE,
  printed_label_id UUID REFERENCES public.printed_labels(id) ON DELETE CASCADE,
  event_type public.print_event_type NOT NULL,
  event_notes TEXT,
  metadata JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_events TO authenticated;
GRANT ALL ON public.print_events TO service_role;
ALTER TABLE public.print_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pe_select" ON public.print_events FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "pe_insert" ON public.print_events FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor','operador']::app_role[]));

CREATE INDEX IF NOT EXISTS idx_pe_company ON public.print_events(company_id);
CREATE INDEX IF NOT EXISTS idx_pe_batch ON public.print_events(print_batch_id);
CREATE INDEX IF NOT EXISTS idx_pe_label ON public.print_events(printed_label_id);
CREATE INDEX IF NOT EXISTS idx_pe_created ON public.print_events(created_at DESC);

-- =========================
-- Layout suggestion function
-- =========================
CREATE OR REPLACE FUNCTION public.suggest_label_layout(
  _company_id UUID,
  _branch_id UUID,
  _product_id UUID,
  _label_type public.label_type
) RETURNS TABLE(layout_id UUID, source TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _category_id UUID;
  _brand_id UUID;
BEGIN
  SELECT category_id, brand_id INTO _category_id, _brand_id
  FROM public.products WHERE id = _product_id AND company_id = _company_id;

  -- 1. Product specific
  RETURN QUERY
  SELECT la.layout_id, 'product'::TEXT FROM public.layout_associations la
  JOIN public.label_layouts l ON l.id = la.layout_id
  WHERE la.company_id = _company_id AND la.target_type = 'product'
    AND la.target_id = _product_id
    AND l.status = 'ativo'
    AND (l.label_type = _label_type OR l.label_type IS NULL)
  ORDER BY la.priority ASC LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- 2. Category
  IF _category_id IS NOT NULL THEN
    RETURN QUERY
    SELECT la.layout_id, 'category'::TEXT FROM public.layout_associations la
    JOIN public.label_layouts l ON l.id = la.layout_id
    WHERE la.company_id = _company_id AND la.target_type = 'category'
      AND la.target_id = _category_id AND l.status = 'ativo'
      AND (l.label_type = _label_type OR l.label_type IS NULL)
    ORDER BY la.priority ASC LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- 3. Brand
  IF _brand_id IS NOT NULL THEN
    RETURN QUERY
    SELECT la.layout_id, 'brand'::TEXT FROM public.layout_associations la
    JOIN public.label_layouts l ON l.id = la.layout_id
    WHERE la.company_id = _company_id AND la.target_type = 'brand'
      AND la.target_id = _brand_id AND l.status = 'ativo'
      AND (l.label_type = _label_type OR l.label_type IS NULL)
    ORDER BY la.priority ASC LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- 4. Branch
  IF _branch_id IS NOT NULL THEN
    RETURN QUERY
    SELECT la.layout_id, 'branch'::TEXT FROM public.layout_associations la
    JOIN public.label_layouts l ON l.id = la.layout_id
    WHERE la.company_id = _company_id AND la.target_type = 'branch'
      AND la.target_id = _branch_id AND l.status = 'ativo'
      AND (l.label_type = _label_type OR l.label_type IS NULL)
    ORDER BY la.priority ASC LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- 5. Company
  RETURN QUERY
  SELECT la.layout_id, 'company'::TEXT FROM public.layout_associations la
  JOIN public.label_layouts l ON l.id = la.layout_id
  WHERE la.company_id = _company_id AND la.target_type = 'company'
    AND la.target_id = _company_id AND l.status = 'ativo'
    AND (l.label_type = _label_type OR l.label_type IS NULL)
  ORDER BY la.priority ASC LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- 6. Default layout by label category (label_type)
  RETURN QUERY
  SELECT l.id, 'label_category_default'::TEXT FROM public.label_layouts l
  JOIN public.label_categories c ON c.id = l.category_id
  WHERE l.company_id = _company_id AND l.status = 'ativo'
    AND l.is_default = true
    AND (l.label_type = _label_type OR c.label_type = _label_type)
  ORDER BY l.updated_at DESC LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- 7. Any active layout matching label_type
  RETURN QUERY
  SELECT l.id, 'label_category_any'::TEXT FROM public.label_layouts l
  JOIN public.label_categories c ON c.id = l.category_id
  WHERE l.company_id = _company_id AND l.status = 'ativo'
    AND (l.label_type = _label_type OR c.label_type = _label_type)
  ORDER BY l.updated_at DESC LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.suggest_label_layout(UUID, UUID, UUID, public.label_type) TO authenticated;
