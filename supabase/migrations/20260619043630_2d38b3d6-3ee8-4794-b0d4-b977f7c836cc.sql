
-- ============== ENUMS ==============
CREATE TYPE public.label_status AS ENUM ('ativo','inativo','arquivado');
CREATE TYPE public.measure_unit AS ENUM ('mm','cm','in','px');
CREATE TYPE public.label_orientation AS ENUM ('vertical','horizontal');
CREATE TYPE public.association_target AS ENUM ('product','category','brand','company','branch');
CREATE TYPE public.printer_type AS ENUM ('termica','laser','inkjet','matricial','pdf','grafica_externa','bobina_continua','etiqueta_adesiva');
CREATE TYPE public.label_element_type AS ENUM (
  'product_name','internal_code','sku','barcode','qrcode','logo','brand','weight',
  'lot','expiry','manufacture_date','ingredients','preservation','allergens',
  'gluten','lactose','nutrition_facts','price','custom_field','fixed_text',
  'image','line','box'
);

-- ============== label_categories ==============
CREATE TABLE public.label_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_native BOOLEAN NOT NULL DEFAULT false,
  status public.label_status NOT NULL DEFAULT 'ativo',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);
CREATE INDEX idx_label_categories_company ON public.label_categories(company_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.label_categories TO authenticated;
GRANT ALL ON public.label_categories TO service_role;
ALTER TABLE public.label_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lc select members" ON public.label_categories FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "lc insert admin sup" ON public.label_categories FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]));
CREATE POLICY "lc update admin sup" ON public.label_categories FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]));
CREATE POLICY "lc delete admin" ON public.label_categories FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), company_id, 'administrador'));

-- ============== label_formats ==============
CREATE TABLE public.label_formats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.label_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  width NUMERIC(10,3) NOT NULL,
  height NUMERIC(10,3) NOT NULL,
  unit public.measure_unit NOT NULL DEFAULT 'mm',
  margin_top NUMERIC(10,3) NOT NULL DEFAULT 0,
  margin_bottom NUMERIC(10,3) NOT NULL DEFAULT 0,
  margin_left NUMERIC(10,3) NOT NULL DEFAULT 0,
  margin_right NUMERIC(10,3) NOT NULL DEFAULT 0,
  spacing_h NUMERIC(10,3) NOT NULL DEFAULT 0,
  spacing_v NUMERIC(10,3) NOT NULL DEFAULT 0,
  columns INTEGER NOT NULL DEFAULT 1,
  rows INTEGER NOT NULL DEFAULT 1,
  orientation public.label_orientation NOT NULL DEFAULT 'vertical',
  status public.label_status NOT NULL DEFAULT 'ativo',
  is_native BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);
CREATE INDEX idx_label_formats_company ON public.label_formats(company_id, status);
CREATE INDEX idx_label_formats_branch ON public.label_formats(branch_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.label_formats TO authenticated;
GRANT ALL ON public.label_formats TO service_role;
ALTER TABLE public.label_formats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lf select members" ON public.label_formats FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "lf insert admin sup" ON public.label_formats FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]));
CREATE POLICY "lf update admin sup" ON public.label_formats FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]));
CREATE POLICY "lf delete admin" ON public.label_formats FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), company_id, 'administrador'));

-- ============== label_layouts ==============
CREATE TABLE public.label_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.label_categories(id) ON DELETE SET NULL,
  format_id UUID NOT NULL REFERENCES public.label_formats(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  status public.label_status NOT NULL DEFAULT 'ativo',
  is_default BOOLEAN NOT NULL DEFAULT false,
  current_version INTEGER NOT NULL DEFAULT 1,
  locked BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);
CREATE INDEX idx_label_layouts_company ON public.label_layouts(company_id, status);
CREATE INDEX idx_label_layouts_category ON public.label_layouts(category_id);
CREATE INDEX idx_label_layouts_format ON public.label_layouts(format_id);
CREATE INDEX idx_label_layouts_created ON public.label_layouts(created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.label_layouts TO authenticated;
GRANT ALL ON public.label_layouts TO service_role;
ALTER TABLE public.label_layouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ll select members" ON public.label_layouts FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "ll insert admin sup" ON public.label_layouts FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]));
CREATE POLICY "ll update admin sup" ON public.label_layouts FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]));
CREATE POLICY "ll delete admin" ON public.label_layouts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), company_id, 'administrador'));

-- ============== label_layout_versions ==============
CREATE TABLE public.label_layout_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  layout_id UUID NOT NULL REFERENCES public.label_layouts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  change_reason TEXT,
  snapshot JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (layout_id, version)
);
CREATE INDEX idx_llv_layout ON public.label_layout_versions(layout_id, version);
CREATE INDEX idx_llv_company ON public.label_layout_versions(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.label_layout_versions TO authenticated;
GRANT ALL ON public.label_layout_versions TO service_role;
ALTER TABLE public.label_layout_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "llv select members" ON public.label_layout_versions FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "llv insert admin sup" ON public.label_layout_versions FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]));
CREATE POLICY "llv update admin sup" ON public.label_layout_versions FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]));
CREATE POLICY "llv delete admin" ON public.label_layout_versions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), company_id, 'administrador'));

-- ============== label_layout_elements ==============
CREATE TABLE public.label_layout_elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES public.label_layout_versions(id) ON DELETE CASCADE,
  element_type public.label_element_type NOT NULL,
  bound_field TEXT,
  fixed_text TEXT,
  custom_field_id UUID,
  pos_x NUMERIC(10,3) NOT NULL DEFAULT 0,
  pos_y NUMERIC(10,3) NOT NULL DEFAULT 0,
  width NUMERIC(10,3) NOT NULL DEFAULT 20,
  height NUMERIC(10,3) NOT NULL DEFAULT 10,
  layer INTEGER NOT NULL DEFAULT 0,
  font_family TEXT DEFAULT 'Inter',
  font_size NUMERIC(6,2) DEFAULT 10,
  color TEXT DEFAULT '#111111',
  bold BOOLEAN NOT NULL DEFAULT false,
  align TEXT DEFAULT 'left',
  visible BOOLEAN NOT NULL DEFAULT true,
  required BOOLEAN NOT NULL DEFAULT false,
  extra JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lle_version ON public.label_layout_elements(version_id, layer);
CREATE INDEX idx_lle_company ON public.label_layout_elements(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.label_layout_elements TO authenticated;
GRANT ALL ON public.label_layout_elements TO service_role;
ALTER TABLE public.label_layout_elements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lle select members" ON public.label_layout_elements FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "lle write admin sup" ON public.label_layout_elements FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]));

-- ============== label_custom_fields ==============
CREATE TABLE public.label_custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key TEXT NOT NULL,
  data_type TEXT NOT NULL DEFAULT 'text',
  default_value TEXT,
  description TEXT,
  status public.label_status NOT NULL DEFAULT 'ativo',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, key)
);
CREATE INDEX idx_lcf_company ON public.label_custom_fields(company_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.label_custom_fields TO authenticated;
GRANT ALL ON public.label_custom_fields TO service_role;
ALTER TABLE public.label_custom_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lcf select members" ON public.label_custom_fields FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "lcf write admin sup" ON public.label_custom_fields FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]));

-- ============== layout_associations ==============
CREATE TABLE public.layout_associations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  layout_id UUID NOT NULL REFERENCES public.label_layouts(id) ON DELETE CASCADE,
  target_type public.association_target NOT NULL,
  target_id UUID,
  priority INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (layout_id, target_type, target_id)
);
CREATE INDEX idx_la_company ON public.layout_associations(company_id);
CREATE INDEX idx_la_layout ON public.layout_associations(layout_id);
CREATE INDEX idx_la_target ON public.layout_associations(target_type, target_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.layout_associations TO authenticated;
GRANT ALL ON public.layout_associations TO service_role;
ALTER TABLE public.layout_associations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "la select members" ON public.layout_associations FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "la write admin sup" ON public.layout_associations FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]));

-- ============== printer_configs ==============
CREATE TABLE public.printer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  manufacturer TEXT,
  model TEXT,
  printer_type public.printer_type,
  location TEXT,
  max_width NUMERIC(10,3),
  max_height NUMERIC(10,3),
  dpi INTEGER,
  paper_type TEXT,
  ribbon_type TEXT,
  connection_type TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  status public.label_status NOT NULL DEFAULT 'ativo',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);
CREATE INDEX idx_pc_company ON public.printer_configs(company_id, status);
CREATE INDEX idx_pc_branch ON public.printer_configs(branch_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.printer_configs TO authenticated;
GRANT ALL ON public.printer_configs TO service_role;
ALTER TABLE public.printer_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pc select members" ON public.printer_configs FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "pc insert admin sup" ON public.printer_configs FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]));
CREATE POLICY "pc update admin sup" ON public.printer_configs FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]));
CREATE POLICY "pc delete admin" ON public.printer_configs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), company_id, 'administrador'));

-- ============== TRIGGERS: updated_at + audit ==============
CREATE TRIGGER label_categories_updated_at BEFORE UPDATE ON public.label_categories
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER label_formats_updated_at BEFORE UPDATE ON public.label_formats
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER label_layouts_updated_at BEFORE UPDATE ON public.label_layouts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER label_layout_versions_updated_at BEFORE UPDATE ON public.label_layout_versions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER label_layout_elements_updated_at BEFORE UPDATE ON public.label_layout_elements
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER label_custom_fields_updated_at BEFORE UPDATE ON public.label_custom_fields
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER layout_associations_updated_at BEFORE UPDATE ON public.layout_associations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER printer_configs_updated_at BEFORE UPDATE ON public.printer_configs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER label_categories_audit AFTER INSERT OR UPDATE OR DELETE ON public.label_categories
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();
CREATE TRIGGER label_formats_audit AFTER INSERT OR UPDATE OR DELETE ON public.label_formats
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();
CREATE TRIGGER label_layouts_audit AFTER INSERT OR UPDATE OR DELETE ON public.label_layouts
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();
CREATE TRIGGER label_layout_versions_audit AFTER INSERT OR UPDATE OR DELETE ON public.label_layout_versions
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();
CREATE TRIGGER label_layout_elements_audit AFTER INSERT OR UPDATE OR DELETE ON public.label_layout_elements
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();
CREATE TRIGGER label_custom_fields_audit AFTER INSERT OR UPDATE OR DELETE ON public.label_custom_fields
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();
CREATE TRIGGER layout_associations_audit AFTER INSERT OR UPDATE OR DELETE ON public.layout_associations
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();
CREATE TRIGGER printer_configs_audit AFTER INSERT OR UPDATE OR DELETE ON public.printer_configs
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

-- ============== SEEDS para IGA Comercial ==============
DO $$
DECLARE
  v_company UUID;
BEGIN
  SELECT id INTO v_company FROM public.companies WHERE name = 'IGA Comercial' LIMIT 1;
  IF v_company IS NULL THEN RETURN; END IF;

  -- Categorias nativas
  INSERT INTO public.label_categories(company_id, name, description, is_native) VALUES
    (v_company, 'Etiquetas Nutricionais', 'Tabela nutricional, ingredientes e alergênicos', true),
    (v_company, 'Etiquetas de Gôndola', 'Preço, descrição e código', true),
    (v_company, 'Etiquetas Promocionais', 'Ofertas e promoções', true),
    (v_company, 'Etiquetas de Produção', 'Lote, data, responsável', true),
    (v_company, 'Etiquetas Logísticas', 'Pallet, caixa, transporte', true),
    (v_company, 'Etiquetas de Expedição', 'Destinatário, NF, volume', true),
    (v_company, 'Etiquetas de Identificação', 'Identificação geral de produto', true),
    (v_company, 'Etiquetas de Validade', 'Manipulação e validade interna', true),
    (v_company, 'Outros', 'Demais usos', true)
  ON CONFLICT (company_id, name) DO NOTHING;

  -- Formatos iniciais
  INSERT INTO public.label_formats(company_id, name, width, height, unit, orientation, is_native) VALUES
    (v_company, 'Nutricional 10x10', 100, 100, 'mm', 'vertical', true),
    (v_company, 'Nutricional 10x15', 100, 150, 'mm', 'vertical', true),
    (v_company, 'Gôndola 10x3',     100,  30, 'mm', 'horizontal', true),
    (v_company, 'A4',                210, 297, 'mm', 'vertical', true),
    (v_company, 'Carta',             216, 279, 'mm', 'vertical', true),
    (v_company, 'Zebra padrão',      102,  76, 'mm', 'vertical', true),
    (v_company, 'Argox padrão',      100,  50, 'mm', 'vertical', true),
    (v_company, 'Elgin padrão',       80,  60, 'mm', 'vertical', true),
    (v_company, 'Personalizado',     100, 100, 'mm', 'vertical', true)
  ON CONFLICT (company_id, name) DO NOTHING;
END $$;
