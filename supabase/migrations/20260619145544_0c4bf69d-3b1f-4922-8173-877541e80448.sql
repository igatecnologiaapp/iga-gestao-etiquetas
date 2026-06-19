-- Reposiciona o elemento "ingredients" para logo abaixo do quadro "nutrition_facts"
-- nos layouts nutricionais existentes (10x15 e 10x10), sem alterar outros elementos.

-- 10x15 (version 1a727a9d): nutrition_facts y=22 h=50 (ends 72); ingredients vai para y=73 h=18 (ends 91); allergens y=92 (inalterado)
UPDATE public.label_layout_elements
SET pos_y = 22, height = 50
WHERE version_id = '1a727a9d-2d69-4aac-8fba-da5bd88b1e78' AND element_type = 'nutrition_facts';

UPDATE public.label_layout_elements
SET pos_y = 73, height = 18
WHERE version_id = '1a727a9d-2d69-4aac-8fba-da5bd88b1e78' AND element_type = 'ingredients';

-- 10x10 (version ed1d57a6): nutrition_facts y=14 h=42 (ends 56); ingredients y=57 h=10 (ends 67); allergens y=68 (inalterado)
UPDATE public.label_layout_elements
SET pos_y = 14, height = 42
WHERE version_id = 'ed1d57a6-2a9d-41b1-8a05-d056eb412915' AND element_type = 'nutrition_facts';

UPDATE public.label_layout_elements
SET pos_y = 57, height = 10
WHERE version_id = 'ed1d57a6-2a9d-41b1-8a05-d056eb412915' AND element_type = 'ingredients';
