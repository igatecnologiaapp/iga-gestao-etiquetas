
DROP VIEW IF EXISTS public.product_pending_issues CASCADE;

CREATE VIEW public.product_pending_issues WITH (security_invoker = true) AS
SELECT
  p.id AS product_id,
  p.company_id,
  p.name,
  p.status::text AS status,
  p.category_id,
  p.brand_id,
  (p.nutrition_fact_id IS NULL) AS missing_nutrition,
  (NOT EXISTS (SELECT 1 FROM public.product_ingredients pi WHERE pi.product_id = p.id)) AS missing_ingredients,
  (NOT EXISTS (SELECT 1 FROM public.product_allergens pa WHERE pa.product_id = p.id)) AS missing_allergens,
  (p.shelf_life_days IS NULL OR p.shelf_life_days <= 0) AS missing_shelf_life,
  (p.preservation IS NULL OR length(trim(p.preservation)) = 0) AS missing_preservation,
  COALESCE((SELECT nf.status::text = 'revisao' FROM public.nutrition_facts nf WHERE nf.id = p.nutrition_fact_id), false) AS nutrition_in_review,
  (p.status::text IN ('pendente','revisao')) AS status_pending
FROM public.products p;

GRANT SELECT ON public.product_pending_issues TO authenticated;
