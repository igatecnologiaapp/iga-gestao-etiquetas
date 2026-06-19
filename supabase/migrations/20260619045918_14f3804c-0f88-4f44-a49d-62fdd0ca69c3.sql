
-- 1. New event types
DO $$ BEGIN
  ALTER TYPE public.print_event_type ADD VALUE IF NOT EXISTS 'pdf_generated';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.print_event_type ADD VALUE IF NOT EXISTS 'pdf_downloaded';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Fix mapping for nutritional category (any company)
UPDATE public.label_categories
   SET label_type='nutricional'::public.label_type
 WHERE name ILIKE '%Nutricional%';

-- 3. Seed nutritional layouts (idempotent) for each company that has a Nutricional category and the formats
DO $$
DECLARE
  c RECORD;
  v_cat UUID;
  v_fmt10 UUID;
  v_fmt15 UUID;
  v_layout10 UUID;
  v_layout15 UUID;
  v_ver10 UUID;
  v_ver15 UUID;
BEGIN
  FOR c IN SELECT id AS company_id FROM public.companies LOOP
    SELECT id INTO v_cat FROM public.label_categories
      WHERE company_id=c.company_id AND label_type='nutricional' LIMIT 1;
    SELECT id INTO v_fmt10 FROM public.label_formats
      WHERE company_id=c.company_id AND width=100 AND height=100 AND unit='mm' LIMIT 1;
    SELECT id INTO v_fmt15 FROM public.label_formats
      WHERE company_id=c.company_id AND width=100 AND height=150 AND unit='mm' LIMIT 1;
    IF v_cat IS NULL OR v_fmt10 IS NULL OR v_fmt15 IS NULL THEN
      CONTINUE;
    END IF;

    -- 10x10
    SELECT id INTO v_layout10 FROM public.label_layouts
      WHERE company_id=c.company_id AND name='Nutricional Padrão 10x10' LIMIT 1;
    IF v_layout10 IS NULL THEN
      INSERT INTO public.label_layouts(company_id, category_id, format_id, name, description, status, label_type, is_default, current_version)
      VALUES (c.company_id, v_cat, v_fmt10, 'Nutricional Padrão 10x10',
              'Modelo nutricional padrão 10x10 cm', 'ativo', 'nutricional', true, 1)
      RETURNING id INTO v_layout10;

      INSERT INTO public.label_layout_versions(company_id, layout_id, version, change_reason, snapshot)
      VALUES (c.company_id, v_layout10, 1, 'Versão inicial seed', '{}'::jsonb)
      RETURNING id INTO v_ver10;

      INSERT INTO public.label_layout_elements (company_id, version_id, element_type, pos_x, pos_y, width, height, font_size, bold, align, layer, required)
      VALUES
        (c.company_id, v_ver10, 'product_name', 2, 2, 96, 8, 12, true, 'left', 1, true),
        (c.company_id, v_ver10, 'brand',        2, 11, 60, 5, 8, false, 'left', 1, false),
        (c.company_id, v_ver10, 'internal_code',64, 11, 34, 5, 8, false, 'right', 1, false),
        (c.company_id, v_ver10, 'nutrition_facts',2, 18, 60, 55, 7, false, 'left', 1, true),
        (c.company_id, v_ver10, 'ingredients', 64, 18, 34, 30, 6, false, 'left', 1, true),
        (c.company_id, v_ver10, 'allergens',   64, 50, 34, 12, 6, true,  'left', 1, true),
        (c.company_id, v_ver10, 'preservation', 2, 75, 60, 6, 7, false, 'left', 1, true),
        (c.company_id, v_ver10, 'lot',          2, 82, 28, 5, 7, false, 'left', 1, true),
        (c.company_id, v_ver10, 'manufacture_date', 32, 82, 30, 5, 7, false, 'left', 1, true),
        (c.company_id, v_ver10, 'expiry',       64, 82, 34, 5, 7, true, 'left', 1, true),
        (c.company_id, v_ver10, 'barcode',      2, 88, 60, 10, 7, false, 'left', 2, false),
        (c.company_id, v_ver10, 'qrcode',      78, 64, 20, 20, 7, false, 'left', 2, false);
    END IF;

    -- 10x15
    SELECT id INTO v_layout15 FROM public.label_layouts
      WHERE company_id=c.company_id AND name='Nutricional Padrão 10x15' LIMIT 1;
    IF v_layout15 IS NULL THEN
      INSERT INTO public.label_layouts(company_id, category_id, format_id, name, description, status, label_type, is_default, current_version)
      VALUES (c.company_id, v_cat, v_fmt15, 'Nutricional Padrão 10x15',
              'Modelo nutricional padrão 10x15 cm', 'ativo', 'nutricional', false, 1)
      RETURNING id INTO v_layout15;

      INSERT INTO public.label_layout_versions(company_id, layout_id, version, change_reason, snapshot)
      VALUES (c.company_id, v_layout15, 1, 'Versão inicial seed', '{}'::jsonb)
      RETURNING id INTO v_ver15;

      INSERT INTO public.label_layout_elements (company_id, version_id, element_type, pos_x, pos_y, width, height, font_size, bold, align, layer, required)
      VALUES
        (c.company_id, v_ver15, 'product_name', 2, 2, 96, 9, 13, true, 'left', 1, true),
        (c.company_id, v_ver15, 'brand',        2, 12, 60, 5, 9, false, 'left', 1, false),
        (c.company_id, v_ver15, 'internal_code',64, 12, 34, 5, 8, false, 'right', 1, false),
        (c.company_id, v_ver15, 'nutrition_facts',2, 20, 60, 80, 7, false, 'left', 1, true),
        (c.company_id, v_ver15, 'ingredients', 64, 20, 34, 45, 6, false, 'left', 1, true),
        (c.company_id, v_ver15, 'allergens',   64, 67, 34, 18, 6, true, 'left', 1, true),
        (c.company_id, v_ver15, 'preservation', 2, 104, 96, 6, 8, false, 'left', 1, true),
        (c.company_id, v_ver15, 'lot',          2, 112, 30, 5, 8, false, 'left', 1, true),
        (c.company_id, v_ver15, 'manufacture_date', 34, 112, 30, 5, 8, false, 'left', 1, true),
        (c.company_id, v_ver15, 'expiry',       66, 112, 32, 5, 8, true, 'left', 1, true),
        (c.company_id, v_ver15, 'weight',       2, 119, 30, 5, 8, false, 'left', 1, false),
        (c.company_id, v_ver15, 'barcode',      2, 128, 60, 12, 7, false, 'left', 2, false),
        (c.company_id, v_ver15, 'qrcode',      75, 128, 23, 23, 7, false, 'left', 2, false);
    END IF;
  END LOOP;
END $$;
