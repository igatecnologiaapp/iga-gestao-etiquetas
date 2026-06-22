
-- Expand nutrition_facts area in native Nutricional 10x10 and 10x15 layouts to fit all required rows (Fibra/Sódio/Observações).
-- Conservative reposition of other elements. No deletes, no RLS changes.

-- 10x10 layouts (IGA + Casa de Carnes Souza Aguiar)
WITH targets AS (
  SELECT v.id AS version_id
  FROM public.label_layout_versions v
  JOIN public.label_layouts l ON l.id = v.layout_id
  WHERE v.layout_id IN ('65400b98-0cfa-4e42-a133-07118ad0f1a2','de187fd9-8a65-416b-a3f7-371a6f633314')
    AND v.version = l.current_version
)
UPDATE public.label_layout_elements e SET
  pos_y = CASE e.element_type
    WHEN 'product_name' THEN 2
    WHEN 'brand' THEN 8.5
    WHEN 'nutrition_facts' THEN 12.5
    WHEN 'ingredients' THEN 69
    WHEN 'allergens' THEN 76.5
    WHEN 'preservation' THEN 80.5
    WHEN 'lot' THEN 84
    WHEN 'manufacture_date' THEN 84
    WHEN 'expiry' THEN 84
    WHEN 'weight' THEN 87.5
    WHEN 'barcode' THEN 91
    ELSE e.pos_y END,
  height = CASE e.element_type
    WHEN 'product_name' THEN 6
    WHEN 'brand' THEN 3.5
    WHEN 'nutrition_facts' THEN 56
    WHEN 'ingredients' THEN 7
    WHEN 'allergens' THEN 4
    WHEN 'preservation' THEN 3.5
    WHEN 'lot' THEN 3
    WHEN 'manufacture_date' THEN 3
    WHEN 'expiry' THEN 3
    WHEN 'weight' THEN 3
    WHEN 'barcode' THEN 7
    ELSE e.height END,
  font_size = CASE e.element_type
    WHEN 'nutrition_facts' THEN 6.5
    ELSE e.font_size END
WHERE e.version_id IN (SELECT version_id FROM targets);

-- 10x15 layouts (IGA + Casa de Carnes Souza Aguiar)
WITH targets AS (
  SELECT v.id AS version_id
  FROM public.label_layout_versions v
  JOIN public.label_layouts l ON l.id = v.layout_id
  WHERE v.layout_id IN ('4a9c648e-04a3-414d-a739-bba2a4454e36','a1c72b9c-cd89-4a22-b2e1-cf051d29df99')
    AND v.version = l.current_version
)
UPDATE public.label_layout_elements e SET
  pos_y = CASE e.element_type
    WHEN 'product_name' THEN 3
    WHEN 'brand' THEN 11
    WHEN 'nutrition_facts' THEN 16
    WHEN 'ingredients' THEN 92
    WHEN 'allergens' THEN 105
    WHEN 'preservation' THEN 113
    WHEN 'lot' THEN 119
    WHEN 'manufacture_date' THEN 119
    WHEN 'expiry' THEN 119
    WHEN 'weight' THEN 124
    WHEN 'barcode' THEN 130
    WHEN 'qrcode' THEN 130
    ELSE e.pos_y END,
  height = CASE e.element_type
    WHEN 'product_name' THEN 7
    WHEN 'brand' THEN 4
    WHEN 'nutrition_facts' THEN 75
    WHEN 'ingredients' THEN 12
    WHEN 'allergens' THEN 7
    WHEN 'preservation' THEN 5
    WHEN 'lot' THEN 4
    WHEN 'manufacture_date' THEN 4
    WHEN 'expiry' THEN 4
    WHEN 'weight' THEN 4
    WHEN 'barcode' THEN 14
    WHEN 'qrcode' THEN 14
    ELSE e.height END,
  font_size = CASE e.element_type
    WHEN 'nutrition_facts' THEN 7.5
    WHEN 'product_name' THEN 11
    ELSE e.font_size END
WHERE e.version_id IN (SELECT version_id FROM targets);
