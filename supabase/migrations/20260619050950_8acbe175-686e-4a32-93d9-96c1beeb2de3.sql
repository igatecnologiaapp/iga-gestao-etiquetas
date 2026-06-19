DO $$ BEGIN
  CREATE TYPE public.promotion_status AS ENUM ('draft','scheduled','active','ended','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.product_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sale_unit TEXT,
  regular_price NUMERIC(14,4) NOT NULL DEFAULT 0,
  wholesale_price NUMERIC(14,4),
  wholesale_min_quantity NUMERIC(14,4),
  current_promotional_price NUMERIC(14,4),
  active_promotion_id UUID,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'ativo',
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, product_id, branch_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_prices TO authenticated;
GRANT ALL ON public.product_prices TO service_role;
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prices_select_member" ON public.product_prices FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "prices_insert_writer" ON public.product_prices FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]));
CREATE POLICY "prices_update_writer" ON public.product_prices FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[])) WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]));
CREATE POLICY "prices_delete_admin" ON public.product_prices FOR DELETE TO authenticated USING (public.has_role(auth.uid(), company_id, 'administrador'::app_role));
CREATE TRIGGER tg_product_prices_updated BEFORE UPDATE ON public.product_prices FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_product_prices_audit AFTER INSERT OR UPDATE OR DELETE ON public.product_prices FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

CREATE TABLE IF NOT EXISTS public.product_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  previous_regular_price NUMERIC(14,4),
  new_regular_price NUMERIC(14,4),
  previous_promotional_price NUMERIC(14,4),
  new_promotional_price NUMERIC(14,4),
  previous_wholesale_price NUMERIC(14,4),
  new_wholesale_price NUMERIC(14,4),
  reason TEXT,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.product_price_history TO authenticated;
GRANT ALL ON public.product_price_history TO service_role;
ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_hist_select_member" ON public.product_price_history FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "price_hist_insert_writer" ON public.product_price_history FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]));
CREATE INDEX IF NOT EXISTS idx_price_hist_product ON public.product_price_history(company_id, product_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  status public.promotion_status NOT NULL DEFAULT 'draft',
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotions TO authenticated;
GRANT ALL ON public.promotions TO service_role;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promotions_select_member" ON public.promotions FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "promotions_insert_writer" ON public.promotions FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]));
CREATE POLICY "promotions_update_writer" ON public.promotions FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[])) WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]));
CREATE POLICY "promotions_delete_admin" ON public.promotions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), company_id, 'administrador'::app_role));
CREATE TRIGGER tg_promotions_updated BEFORE UPDATE ON public.promotions FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_promotions_audit AFTER INSERT OR UPDATE OR DELETE ON public.promotions FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();
CREATE INDEX IF NOT EXISTS idx_promotions_company ON public.promotions(company_id, status, start_date, end_date);

CREATE TABLE IF NOT EXISTS public.promotion_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  regular_price NUMERIC(14,4),
  promotional_price NUMERIC(14,4),
  wholesale_price NUMERIC(14,4),
  wholesale_min_quantity NUMERIC(14,4),
  promotion_rules TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (promotion_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotion_products TO authenticated;
GRANT ALL ON public.promotion_products TO service_role;
ALTER TABLE public.promotion_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promo_prod_select_member" ON public.promotion_products FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "promo_prod_insert_writer" ON public.promotion_products FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]));
CREATE POLICY "promo_prod_update_writer" ON public.promotion_products FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[])) WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]));
CREATE POLICY "promo_prod_delete_writer" ON public.promotion_products FOR DELETE TO authenticated USING (public.has_any_role(auth.uid(), company_id, ARRAY['administrador','supervisor']::app_role[]));
CREATE TRIGGER tg_promo_prod_updated BEFORE UPDATE ON public.promotion_products FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_promo_prod_audit AFTER INSERT OR UPDATE OR DELETE ON public.promotion_products FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

CREATE OR REPLACE FUNCTION public.get_active_promotion_for_product(_company_id uuid, _product_id uuid)
RETURNS TABLE(promotion_id uuid, name text, promotional_price numeric, wholesale_price numeric, wholesale_min_quantity numeric, promotion_rules text, start_date timestamptz, end_date timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.name, pp.promotional_price, pp.wholesale_price, pp.wholesale_min_quantity, pp.promotion_rules, p.start_date, p.end_date
  FROM public.promotions p
  JOIN public.promotion_products pp ON pp.promotion_id = p.id
  WHERE p.company_id = _company_id AND pp.product_id = _product_id
    AND p.status = 'active' AND p.start_date <= now() AND p.end_date >= now() AND pp.status = 'ativo'
  ORDER BY pp.promotional_price ASC NULLS LAST LIMIT 1;
$$;

INSERT INTO public.label_formats
  (company_id, name, width, height, unit, margin_top, margin_bottom, margin_left, margin_right, orientation, columns, rows, spacing_h, spacing_v, status, is_native, notes)
SELECT c.id, 'Gôndola 10x3', 10, 3, 'cm', 0.2, 0.2, 0.2, 0.2, 'horizontal'::label_orientation, 1, 1, 0, 0, 'ativo', false, 'Formato padrão para etiquetas de gôndola'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.label_formats f WHERE f.company_id = c.id AND f.name = 'Gôndola 10x3');
