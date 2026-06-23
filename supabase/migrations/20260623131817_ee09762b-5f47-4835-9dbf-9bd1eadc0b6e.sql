-- Fix: Conservação (preservation) field was being clipped on native nutritional layouts.
-- Causes:
--  - 10x10: height of 3.5mm with font 5.5 fits only one line; longer storage text wraps and gets clipped.
--  - 10x15: height of 5mm with font 7 fits only one line; width was 60mm (too narrow), so wraps and clips.
-- Fix: expand height/width of the `preservation` element within the gap already available
-- (above the `weight` element). No other elements are moved.

UPDATE label_layout_elements e
SET height = 6.5, width = 96, updated_at = now()
FROM label_layout_versions lv
JOIN label_layouts l ON l.id = lv.layout_id
WHERE e.version_id = lv.id
  AND l.name = 'Layout Nutricional padrão 10x10'
  AND e.element_type = 'preservation';

UPDATE label_layout_elements e
SET height = 10, width = 90, updated_at = now()
FROM label_layout_versions lv
JOIN label_layouts l ON l.id = lv.layout_id
WHERE e.version_id = lv.id
  AND l.name = 'Layout Nutricional Padrão 10x15'
  AND e.element_type = 'preservation';
