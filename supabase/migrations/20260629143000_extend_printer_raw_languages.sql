-- CORREÇÃO CRÍTICA — ampliar linguagens RAW suportadas para impressão direta.
-- Necessário para seleção manual Argox PPLA, ESC/POS e fallback Windows GDI/texto.

ALTER TABLE public.printer_configs
  DROP CONSTRAINT IF EXISTS printer_configs_raw_language_check;

ALTER TABLE public.printer_configs
  ADD CONSTRAINT printer_configs_raw_language_check CHECK (
    raw_language IS NULL OR raw_language IN ('driver','ZPL','EPL','PPLA','PPLB','TSPL','ESCPOS','GDI')
  );
