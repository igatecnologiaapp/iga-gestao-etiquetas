
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, uuid, public.app_role[]) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_global_admin(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_company_member(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_audit(public.audit_action, text, text, uuid, uuid, jsonb, jsonb, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_active_promotion_for_product(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.suggest_label_layout(uuid, uuid, uuid, public.label_type) FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, uuid, public.app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_global_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit(public.audit_action, text, text, uuid, uuid, jsonb, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_promotion_for_product(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.suggest_label_layout(uuid, uuid, uuid, public.label_type) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_nutrition_facts_company_status ON public.nutrition_facts(company_id, status);
CREATE INDEX IF NOT EXISTS idx_categories_company_parent ON public.categories(company_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_brands_company ON public.brands(company_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_company ON public.ingredients(company_id);
CREATE INDEX IF NOT EXISTS idx_allergens_company ON public.allergens(company_id);
CREATE INDEX IF NOT EXISTS idx_product_allergens_product ON public.product_allergens(product_id);
CREATE INDEX IF NOT EXISTS idx_product_ingredients_product ON public.product_ingredients(product_id);
CREATE INDEX IF NOT EXISTS idx_product_prices_product ON public.product_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_promotion_products_product ON public.promotion_products(product_id);
CREATE INDEX IF NOT EXISTS idx_promotion_products_promotion ON public.promotion_products(promotion_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(company_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON public.audit_logs(table_name, record_id);
