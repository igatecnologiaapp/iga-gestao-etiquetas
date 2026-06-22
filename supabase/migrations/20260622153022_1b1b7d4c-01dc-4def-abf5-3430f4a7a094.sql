-- Remove duplicate 'observations' element from native 10x15 nutritional layouts.
-- Observações now renders ONLY inside the nutrition_facts table (NutritionMini/renderNutritionTable already prints notes).
DELETE FROM public.label_layout_elements
WHERE id IN (
  '6926aef3-6b37-4282-a698-a549f8e47fb1',
  '23926155-eaf8-4e9b-b493-e2c995040438'
);