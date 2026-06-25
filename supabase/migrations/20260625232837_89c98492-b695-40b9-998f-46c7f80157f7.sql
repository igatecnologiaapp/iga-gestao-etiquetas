
-- FASE 6: Configurações técnicas avançadas e compatibilidade impressora/layout

-- 1. Novas colunas em printer_configs
ALTER TABLE public.printer_configs
  ADD COLUMN IF NOT EXISTS scale numeric NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS margin_top numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS margin_right numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS margin_bottom numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS margin_left numeric NOT NULL DEFAULT 0;

-- 2. Constraints de validação
DO $$ BEGIN
  ALTER TABLE public.printer_configs
    ADD CONSTRAINT printer_configs_dpi_check CHECK (dpi IS NULL OR (dpi > 0 AND dpi <= 2400));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.printer_configs
    ADD CONSTRAINT printer_configs_speed_check CHECK (speed IS NULL OR (speed >= 0 AND speed <= 600));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.printer_configs
    ADD CONSTRAINT printer_configs_scale_check CHECK (scale >= 10 AND scale <= 400);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.printer_configs
    ADD CONSTRAINT printer_configs_margins_check CHECK (
      margin_top >= 0 AND margin_right >= 0 AND margin_bottom >= 0 AND margin_left >= 0
      AND margin_top <= 200 AND margin_right <= 200 AND margin_bottom <= 200 AND margin_left <= 200
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.printer_configs
    ADD CONSTRAINT printer_configs_offsets_check CHECK (
      offset_x >= -200 AND offset_x <= 200 AND offset_y >= -200 AND offset_y <= 200
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.printer_configs
    ADD CONSTRAINT printer_configs_rotation_check CHECK (rotation IN (0, 90, 180, 270));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.printer_configs
    ADD CONSTRAINT printer_configs_raw_language_check CHECK (
      raw_language IS NULL OR raw_language IN ('driver','ZPL','EPL','PPLB','TSPL')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.printer_configs
    ADD CONSTRAINT printer_configs_label_advance_check CHECK (label_advance IS NULL OR (label_advance >= 0 AND label_advance <= 200));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Auditoria automática
DROP TRIGGER IF EXISTS audit_printer_configs ON public.printer_configs;
CREATE TRIGGER audit_printer_configs
  AFTER INSERT OR UPDATE OR DELETE ON public.printer_configs
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

DROP TRIGGER IF EXISTS audit_printer_layout_compatibility ON public.printer_layout_compatibility;
CREATE TRIGGER audit_printer_layout_compatibility
  AFTER INSERT OR UPDATE OR DELETE ON public.printer_layout_compatibility
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

-- 4. updated_at automático
DROP TRIGGER IF EXISTS set_updated_at_printer_configs ON public.printer_configs;
CREATE TRIGGER set_updated_at_printer_configs
  BEFORE UPDATE ON public.printer_configs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_printer_layout_compatibility ON public.printer_layout_compatibility;
CREATE TRIGGER set_updated_at_printer_layout_compatibility
  BEFORE UPDATE ON public.printer_layout_compatibility
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 5. Index para consultas de compatibilidade
CREATE INDEX IF NOT EXISTS idx_plc_printer ON public.printer_layout_compatibility(printer_id);
CREATE INDEX IF NOT EXISTS idx_plc_layout ON public.printer_layout_compatibility(layout_id);
CREATE INDEX IF NOT EXISTS idx_plc_format ON public.printer_layout_compatibility(format_id);

-- 6. Garantir unicidade do vínculo (printer + layout) e (printer + format)
DO $$ BEGIN
  ALTER TABLE public.printer_layout_compatibility
    ADD CONSTRAINT plc_unique_printer_layout UNIQUE (printer_id, layout_id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;
