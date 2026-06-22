-- 1) Reativar IGA
UPDATE public.companies
   SET status = 'ativo'
 WHERE id = '09bef0e3-2654-4ba5-9b83-8cf42509c758'
   AND status <> 'ativo';

-- 2) Clonagem idempotente IGA -> Casa de Carnes
DO $$
DECLARE
  SRC CONSTANT uuid := '09bef0e3-2654-4ba5-9b83-8cf42509c758';
  DST CONSTANT uuid := '7f3a22a8-56c4-48ec-94de-0bda0778efd8';
  fmt_map jsonb := '{}'::jsonb;
  cat_map jsonb := '{}'::jsonb;
  r record;
  new_id uuid;
  new_layout_id uuid;
  new_version_id uuid;
  src_version_id uuid;
BEGIN
  -- 2.1) categorias (sem dependências para FK)
  FOR r IN SELECT * FROM public.label_categories WHERE company_id = SRC LOOP
    SELECT id INTO new_id FROM public.label_categories
      WHERE company_id = DST AND name = r.name LIMIT 1;
    IF new_id IS NULL THEN
      INSERT INTO public.label_categories
        (company_id, name, description, is_native, status, label_type, created_by)
      VALUES
        (DST, r.name, r.description, r.is_native, r.status, r.label_type, r.created_by)
      RETURNING id INTO new_id;
    END IF;
    cat_map := cat_map || jsonb_build_object(r.id::text, new_id::text);
  END LOOP;

  -- 2.2) formatos (podem referenciar categoria; remapeia)
  FOR r IN SELECT * FROM public.label_formats WHERE company_id = SRC LOOP
    SELECT id INTO new_id FROM public.label_formats
      WHERE company_id = DST AND name = r.name LIMIT 1;
    IF new_id IS NULL THEN
      INSERT INTO public.label_formats (
        company_id, branch_id, category_id, name,
        width, height, unit,
        margin_top, margin_bottom, margin_left, margin_right,
        spacing_h, spacing_v, columns, rows,
        orientation, status, is_native, notes, created_by
      )
      VALUES (
        DST, NULL,
        CASE WHEN r.category_id IS NOT NULL
             THEN (cat_map->>r.category_id::text)::uuid ELSE NULL END,
        r.name,
        r.width, r.height, r.unit,
        r.margin_top, r.margin_bottom, r.margin_left, r.margin_right,
        r.spacing_h, r.spacing_v, r.columns, r.rows,
        r.orientation, r.status, r.is_native, r.notes, r.created_by
      )
      RETURNING id INTO new_id;
    END IF;
    fmt_map := fmt_map || jsonb_build_object(r.id::text, new_id::text);
  END LOOP;

  -- 2.3) layouts ativos com versão vigente + elementos
  FOR r IN
    SELECT * FROM public.label_layouts
     WHERE company_id = SRC AND status = 'ativo'
  LOOP
    IF EXISTS (SELECT 1 FROM public.label_layouts
                WHERE company_id = DST AND name = r.name) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.label_layouts (
      company_id, branch_id, category_id, format_id, name, description,
      status, is_default, current_version, locked, label_type, created_by
    )
    VALUES (
      DST, NULL,
      CASE WHEN r.category_id IS NOT NULL
           THEN (cat_map->>r.category_id::text)::uuid ELSE NULL END,
      (fmt_map->>r.format_id::text)::uuid,
      r.name, r.description, r.status, r.is_default,
      r.current_version, r.locked, r.label_type, r.created_by
    )
    RETURNING id INTO new_layout_id;

    SELECT id INTO src_version_id
      FROM public.label_layout_versions
     WHERE layout_id = r.id AND version = r.current_version
     LIMIT 1;

    IF src_version_id IS NOT NULL THEN
      INSERT INTO public.label_layout_versions
        (company_id, layout_id, version, change_reason, snapshot, created_by)
      SELECT DST, new_layout_id, version, change_reason, snapshot, created_by
        FROM public.label_layout_versions WHERE id = src_version_id
      RETURNING id INTO new_version_id;

      INSERT INTO public.label_layout_elements (
        company_id, version_id, element_type, bound_field, fixed_text,
        custom_field_id, pos_x, pos_y, width, height, layer,
        font_family, font_size, color, bold, align, visible, required, extra
      )
      SELECT DST, new_version_id, element_type, bound_field, fixed_text,
             NULL, pos_x, pos_y, width, height, layer,
             font_family, font_size, color, bold, align, visible, required, extra
        FROM public.label_layout_elements
       WHERE version_id = src_version_id;
    END IF;
  END LOOP;
END $$;