-- Substitui produto_id (unico) por produtos_ids (multiplos)
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS produtos_ids uuid[];

-- Migra dados existentes (se houver)
UPDATE vouchers SET produtos_ids = ARRAY[produto_id] WHERE produto_id IS NOT NULL AND produtos_ids IS NULL;

-- Remove a coluna antiga após a migração
ALTER TABLE vouchers DROP COLUMN IF EXISTS produto_id;

-- Atualiza a cache do PostgREST
NOTIFY pgrst, 'reload schema';
