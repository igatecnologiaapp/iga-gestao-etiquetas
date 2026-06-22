-- 1. Adiciona o valor 'observations' ao enum (idempotente)
ALTER TYPE public.label_element_type ADD VALUE IF NOT EXISTS 'observations';

-- (commit implícito) — inserts em transação separada via DO block deferido
