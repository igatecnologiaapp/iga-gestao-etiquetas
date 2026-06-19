
CREATE INDEX IF NOT EXISTS idx_printed_labels_company_created ON public.printed_labels(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_printed_labels_branch ON public.printed_labels(branch_id);
CREATE INDEX IF NOT EXISTS idx_printed_labels_product ON public.printed_labels(product_id);
CREATE INDEX IF NOT EXISTS idx_printed_labels_layout ON public.printed_labels(label_layout_id);
CREATE INDEX IF NOT EXISTS idx_printed_labels_reprint ON public.printed_labels(reprint_of) WHERE reprint_of IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_print_batches_company_created ON public.print_batches(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_batches_requested_by ON public.print_batches(requested_by);
CREATE INDEX IF NOT EXISTS idx_print_batches_printer ON public.print_batches(printer_config_id);
CREATE INDEX IF NOT EXISTS idx_print_batches_label_type ON public.print_batches(label_type);

CREATE OR REPLACE VIEW public.dashboard_label_summary WITH (security_invoker = true) AS
SELECT pl.company_id, pl.branch_id,
  COUNT(*)::bigint AS total_labels,
  COUNT(*) FILTER (WHERE pb.label_type = 'nutricional')::bigint AS total_nutritional,
  COUNT(*) FILTER (WHERE pb.label_type = 'gondola')::bigint AS total_gondola,
  COUNT(*) FILTER (WHERE pl.reprint_of IS NOT NULL)::bigint AS total_reprints,
  COUNT(*) FILTER (WHERE pl.status = 'cancelled')::bigint AS total_cancelled,
  COUNT(DISTINCT pl.print_batch_id)::bigint AS total_batches
FROM public.printed_labels pl
LEFT JOIN public.print_batches pb ON pb.id = pl.print_batch_id
GROUP BY pl.company_id, pl.branch_id;

CREATE OR REPLACE VIEW public.dashboard_prints_by_period WITH (security_invoker = true) AS
SELECT pl.company_id, pl.branch_id, pb.label_type,
  date_trunc('day', pl.created_at)::date AS period_day,
  COUNT(*)::bigint AS total_labels,
  COUNT(*) FILTER (WHERE pl.reprint_of IS NOT NULL)::bigint AS total_reprints
FROM public.printed_labels pl
LEFT JOIN public.print_batches pb ON pb.id = pl.print_batch_id
GROUP BY pl.company_id, pl.branch_id, pb.label_type, date_trunc('day', pl.created_at);

CREATE OR REPLACE VIEW public.dashboard_top_products WITH (security_invoker = true) AS
SELECT pl.company_id, pl.branch_id, pl.product_id, p.name AS product_name,
  COUNT(*)::bigint AS total_labels, MAX(pl.created_at) AS last_printed_at
FROM public.printed_labels pl
LEFT JOIN public.products p ON p.id = pl.product_id
GROUP BY pl.company_id, pl.branch_id, pl.product_id, p.name;

CREATE OR REPLACE VIEW public.dashboard_top_layouts WITH (security_invoker = true) AS
SELECT pl.company_id, pl.branch_id, pl.label_layout_id, l.name AS layout_name, l.label_type,
  COUNT(*)::bigint AS total_labels
FROM public.printed_labels pl
LEFT JOIN public.label_layouts l ON l.id = pl.label_layout_id
GROUP BY pl.company_id, pl.branch_id, pl.label_layout_id, l.name, l.label_type;

CREATE OR REPLACE VIEW public.dashboard_prints_by_user WITH (security_invoker = true) AS
SELECT pb.company_id, pb.branch_id, pb.requested_by AS user_id, up.full_name, up.email,
  COUNT(pl.id)::bigint AS total_labels, COUNT(DISTINCT pb.id)::bigint AS total_batches
FROM public.print_batches pb
LEFT JOIN public.printed_labels pl ON pl.print_batch_id = pb.id
LEFT JOIN public.user_profiles up ON up.id = pb.requested_by
GROUP BY pb.company_id, pb.branch_id, pb.requested_by, up.full_name, up.email;

CREATE OR REPLACE VIEW public.dashboard_prints_by_printer WITH (security_invoker = true) AS
SELECT pb.company_id, pb.branch_id, pb.printer_config_id, pc.name AS printer_name,
  COUNT(pl.id)::bigint AS total_labels
FROM public.print_batches pb
LEFT JOIN public.printed_labels pl ON pl.print_batch_id = pb.id
LEFT JOIN public.printer_configs pc ON pc.id = pb.printer_config_id
GROUP BY pb.company_id, pb.branch_id, pb.printer_config_id, pc.name;

CREATE OR REPLACE VIEW public.dashboard_reprints WITH (security_invoker = true) AS
SELECT pl.company_id, pl.branch_id,
  date_trunc('day', pl.created_at)::date AS period_day,
  COUNT(*)::bigint AS total_reprints
FROM public.printed_labels pl
WHERE pl.reprint_of IS NOT NULL
GROUP BY pl.company_id, pl.branch_id, date_trunc('day', pl.created_at);

CREATE OR REPLACE VIEW public.dashboard_promotions_summary WITH (security_invoker = true) AS
SELECT pr.company_id, pr.id AS promotion_id, pr.name AS promotion_name, pr.status,
  pr.start_date, pr.end_date,
  COUNT(DISTINCT pp.product_id)::bigint AS total_products,
  COUNT(pl.id)::bigint AS total_labels
FROM public.promotions pr
LEFT JOIN public.promotion_products pp ON pp.promotion_id = pr.id
LEFT JOIN public.printed_labels pl
  ON pl.product_id = pp.product_id
 AND pl.company_id = pr.company_id
 AND pl.created_at BETWEEN pr.start_date AND pr.end_date
GROUP BY pr.company_id, pr.id, pr.name, pr.status, pr.start_date, pr.end_date;

GRANT SELECT ON public.dashboard_label_summary,
  public.dashboard_prints_by_period, public.dashboard_top_products,
  public.dashboard_top_layouts, public.dashboard_prints_by_user,
  public.dashboard_prints_by_printer, public.dashboard_reprints,
  public.dashboard_promotions_summary
TO authenticated;
