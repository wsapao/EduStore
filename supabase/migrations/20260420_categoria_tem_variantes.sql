-- Indica se a categoria exige grade de tamanhos (ex: uniforme/farda)
ALTER TABLE categorias_produto ADD COLUMN IF NOT EXISTS tem_variantes boolean NOT NULL DEFAULT false;
