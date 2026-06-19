
-- =====================================================================
-- FASE 2 — Cadastros principais
-- =====================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'revisao_necessaria'
                 AND enumtypid = 'public.entity_status'::regtype) THEN
    ALTER TYPE public.entity_status ADD VALUE 'revisao_necessaria';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nutrition_status') THEN
    CREATE TYPE public.nutrition_status AS ENUM ('vigente','em_revisao','substituida','inativa');
  END IF;
END $$;

-- Audit trigger updated to detect company_id automatically
CREATE OR REPLACE FUNCTION public.tg_audit_row()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _company UUID; _branch UUID; _rec_id TEXT;
  _old JSONB; _new JSONB; _payload JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _old := to_jsonb(OLD); _new := NULL; _payload := _old;
    _rec_id := COALESCE((OLD).id::text, NULL);
  ELSIF TG_OP = 'UPDATE' THEN
    _old := to_jsonb(OLD); _new := to_jsonb(NEW); _payload := _new;
    _rec_id := COALESCE((NEW).id::text, NULL);
  ELSE
    _old := NULL; _new := to_jsonb(NEW); _payload := _new;
    _rec_id := COALESCE((NEW).id::text, NULL);
  END IF;
  IF TG_TABLE_NAME = 'companies' THEN
    _company := (_payload->>'id')::uuid;
  ELSIF _payload ? 'company_id' THEN
    _company := NULLIF(_payload->>'company_id','')::uuid;
  END IF;
  IF _payload ? 'branch_id' THEN
    _branch := NULLIF(_payload->>'branch_id','')::uuid;
  END IF;
  INSERT INTO public.audit_logs(company_id, branch_id, user_id, action, table_name, record_id, old_values, new_values)
  VALUES (_company, _branch, auth.uid(), TG_OP::public.audit_action, TG_TABLE_NAME, _rec_id, _old, _new);
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- CATEGORIES
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  name text NOT NULL, slug text, description text,
  status public.entity_status NOT NULL DEFAULT 'ativo',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, parent_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories select members" ON public.categories FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "categories insert admin sup" ON public.categories FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]));
CREATE POLICY "categories update admin sup" ON public.categories FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]));
CREATE POLICY "categories delete admin" ON public.categories FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), company_id, 'administrador'));
CREATE TRIGGER categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER categories_audit AFTER INSERT OR UPDATE OR DELETE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

-- BRANDS
CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL, description text,
  status public.entity_status NOT NULL DEFAULT 'ativo',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brands select members" ON public.brands FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "brands insert admin sup" ON public.brands FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]));
CREATE POLICY "brands update admin sup" ON public.brands FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]));
CREATE POLICY "brands delete admin" ON public.brands FOR DELETE TO authenticated USING (public.has_role(auth.uid(), company_id, 'administrador'));
CREATE TRIGGER brands_updated_at BEFORE UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER brands_audit AFTER INSERT OR UPDATE OR DELETE ON public.brands FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

-- INGREDIENTS
CREATE TABLE public.ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL, description text, origin text,
  status public.entity_status NOT NULL DEFAULT 'ativo',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingredients TO authenticated;
GRANT ALL ON public.ingredients TO service_role;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ingredients select members" ON public.ingredients FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "ingredients insert admin sup" ON public.ingredients FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]));
CREATE POLICY "ingredients update admin sup" ON public.ingredients FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]));
CREATE POLICY "ingredients delete admin" ON public.ingredients FOR DELETE TO authenticated USING (public.has_role(auth.uid(), company_id, 'administrador'));
CREATE TRIGGER ingredients_updated_at BEFORE UPDATE ON public.ingredients FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER ingredients_audit AFTER INSERT OR UPDATE OR DELETE ON public.ingredients FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

-- ALLERGENS
CREATE TABLE public.allergens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL, code text, description text,
  status public.entity_status NOT NULL DEFAULT 'ativo',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.allergens TO authenticated;
GRANT ALL ON public.allergens TO service_role;
ALTER TABLE public.allergens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allergens select members" ON public.allergens FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "allergens insert admin sup" ON public.allergens FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]));
CREATE POLICY "allergens update admin sup" ON public.allergens FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]));
CREATE POLICY "allergens delete admin" ON public.allergens FOR DELETE TO authenticated USING (public.has_role(auth.uid(), company_id, 'administrador'));
CREATE TRIGGER allergens_updated_at BEFORE UPDATE ON public.allergens FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER allergens_audit AFTER INSERT OR UPDATE OR DELETE ON public.allergens FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

-- NUTRITION FACTS (versioned)
CREATE TABLE public.nutrition_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  version int NOT NULL DEFAULT 1,
  status public.nutrition_status NOT NULL DEFAULT 'vigente',
  serving_size_g numeric(10,3), serving_household text,
  servings_per_pack numeric(10,2), reference_basis text DEFAULT '100g',
  energy_kcal numeric(10,2), carbs_g numeric(10,2),
  total_sugars_g numeric(10,2), added_sugars_g numeric(10,2),
  protein_g numeric(10,2), total_fat_g numeric(10,2),
  saturated_fat_g numeric(10,2), trans_fat_g numeric(10,2),
  fiber_g numeric(10,2), sodium_mg numeric(10,2),
  daily_values jsonb, responsible text, notes text,
  data_updated_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_facts TO authenticated;
GRANT ALL ON public.nutrition_facts TO service_role;
ALTER TABLE public.nutrition_facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nutrition select members" ON public.nutrition_facts FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "nutrition insert admin sup" ON public.nutrition_facts FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]));
CREATE POLICY "nutrition update admin sup" ON public.nutrition_facts FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]));
CREATE POLICY "nutrition delete admin" ON public.nutrition_facts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), company_id, 'administrador'));
CREATE TRIGGER nutrition_updated_at BEFORE UPDATE ON public.nutrition_facts FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER nutrition_audit AFTER INSERT OR UPDATE OR DELETE ON public.nutrition_facts FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

-- PRODUCTS
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  internal_code text, ean text, sku text,
  name text NOT NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  subcategory_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  unit_of_measure text, standard_weight numeric(10,3),
  variable_weight boolean NOT NULL DEFAULT false,
  commercial_description text,
  nutrition_fact_id uuid REFERENCES public.nutrition_facts(id) ON DELETE SET NULL,
  contains_gluten boolean, contains_lactose boolean,
  preservation text, preparation text,
  shelf_life_days int, storage_temperature text,
  legal_notes text, image_url text,
  status public.entity_status NOT NULL DEFAULT 'pendente',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, internal_code)
);
CREATE INDEX products_company_idx ON public.products(company_id);
CREATE INDEX products_category_idx ON public.products(category_id);
CREATE INDEX products_brand_idx ON public.products(brand_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products select members" ON public.products FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "products insert admin sup op" ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor','operador']::public.app_role[]));
CREATE POLICY "products update admin sup" ON public.products FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]));
CREATE POLICY "products delete admin" ON public.products FOR DELETE TO authenticated USING (public.has_role(auth.uid(), company_id, 'administrador'));
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER products_audit AFTER INSERT OR UPDATE OR DELETE ON public.products FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

-- PRODUCT ↔ INGREDIENTS
CREATE TABLE public.product_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE RESTRICT,
  position int DEFAULT 0, quantity text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, ingredient_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_ingredients TO authenticated;
GRANT ALL ON public.product_ingredients TO service_role;
ALTER TABLE public.product_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pi select members" ON public.product_ingredients FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "pi write admin sup" ON public.product_ingredients FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]));
CREATE TRIGGER pi_audit AFTER INSERT OR UPDATE OR DELETE ON public.product_ingredients FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

-- PRODUCT ↔ ALLERGENS
CREATE TABLE public.product_allergens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  allergen_id uuid NOT NULL REFERENCES public.allergens(id) ON DELETE RESTRICT,
  may_contain boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, allergen_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_allergens TO authenticated;
GRANT ALL ON public.product_allergens TO service_role;
ALTER TABLE public.product_allergens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pa select members" ON public.product_allergens FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "pa write admin sup" ON public.product_allergens FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::public.app_role[]));
CREATE TRIGGER pa_audit AFTER INSERT OR UPDATE OR DELETE ON public.product_allergens FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

-- VIEW: regulatory pending issues (compare status as text to avoid new-enum-value restriction)
CREATE OR REPLACE VIEW public.product_pending_issues AS
SELECT
  p.id AS product_id, p.company_id, p.name, p.status,
  (p.nutrition_fact_id IS NULL) AS missing_nutrition,
  (NOT EXISTS (SELECT 1 FROM public.product_ingredients pi WHERE pi.product_id = p.id)) AS missing_ingredients,
  (NOT EXISTS (SELECT 1 FROM public.product_allergens pa WHERE pa.product_id = p.id)) AS missing_allergens,
  (p.shelf_life_days IS NULL) AS missing_shelf_life,
  (p.preservation IS NULL OR p.preservation = '') AS missing_preservation,
  EXISTS (SELECT 1 FROM public.nutrition_facts nf
          WHERE nf.id = p.nutrition_fact_id AND nf.status = 'em_revisao') AS nutrition_in_review,
  (p.status::text IN ('pendente','revisao_necessaria')) AS status_pending
FROM public.products p;
GRANT SELECT ON public.product_pending_issues TO authenticated;
