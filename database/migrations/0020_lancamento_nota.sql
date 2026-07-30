-- Adiciona coluna 'nota' para observações livres nos lançamentos
ALTER TABLE lancamentos ADD COLUMN nota TEXT DEFAULT '';
