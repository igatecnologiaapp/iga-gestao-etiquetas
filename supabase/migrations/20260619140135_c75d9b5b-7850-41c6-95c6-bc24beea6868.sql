
UPDATE public.label_layouts SET label_type = 'nutricional'::label_type WHERE id = '65400b98-0cfa-4e42-a133-07118ad0f1a2';
DELETE FROM public.label_layout_elements WHERE version_id = 'ed1d57a6-2a9d-41b1-8a05-d056eb412915';
INSERT INTO public.label_layout_elements
  (company_id, version_id, element_type, bound_field, pos_x, pos_y, width, height, layer, font_size, bold, align, visible, required)
VALUES
  ('09bef0e3-2654-4ba5-9b83-8cf42509c758','ed1d57a6-2a9d-41b1-8a05-d056eb412915','product_name','name',2,2,96,7,1,10,true,'left',true,false),
  ('09bef0e3-2654-4ba5-9b83-8cf42509c758','ed1d57a6-2a9d-41b1-8a05-d056eb412915','brand','brand',2,9,96,4,1,7,false,'left',true,false),
  ('09bef0e3-2654-4ba5-9b83-8cf42509c758','ed1d57a6-2a9d-41b1-8a05-d056eb412915','ingredients','ingredients',2,14,96,10,1,5.5,false,'left',true,false),
  ('09bef0e3-2654-4ba5-9b83-8cf42509c758','ed1d57a6-2a9d-41b1-8a05-d056eb412915','nutrition_facts','nutrition',2,25,96,42,1,5.5,false,'left',true,false),
  ('09bef0e3-2654-4ba5-9b83-8cf42509c758','ed1d57a6-2a9d-41b1-8a05-d056eb412915','allergens','allergens',2,68,96,5,1,6,true,'left',true,false),
  ('09bef0e3-2654-4ba5-9b83-8cf42509c758','ed1d57a6-2a9d-41b1-8a05-d056eb412915','preservation','preservation',2,74,96,4,1,5.5,false,'left',true,false),
  ('09bef0e3-2654-4ba5-9b83-8cf42509c758','ed1d57a6-2a9d-41b1-8a05-d056eb412915','lot','lot',2,79,30,4,1,5.5,false,'left',true,false),
  ('09bef0e3-2654-4ba5-9b83-8cf42509c758','ed1d57a6-2a9d-41b1-8a05-d056eb412915','manufacture_date','manufactured_at',34,79,30,4,1,5.5,false,'left',true,false),
  ('09bef0e3-2654-4ba5-9b83-8cf42509c758','ed1d57a6-2a9d-41b1-8a05-d056eb412915','expiry','expires_at',66,79,32,4,1,5.5,false,'left',true,false),
  ('09bef0e3-2654-4ba5-9b83-8cf42509c758','ed1d57a6-2a9d-41b1-8a05-d056eb412915','weight','weight',2,84,40,4,1,5.5,false,'left',true,false),
  ('09bef0e3-2654-4ba5-9b83-8cf42509c758','ed1d57a6-2a9d-41b1-8a05-d056eb412915','barcode','sku',2,89,55,9,1,6,false,'left',true,false),
  ('09bef0e3-2654-4ba5-9b83-8cf42509c758','ed1d57a6-2a9d-41b1-8a05-d056eb412915','qrcode','sku',88,89,10,9,1,6,false,'left',true,false);
